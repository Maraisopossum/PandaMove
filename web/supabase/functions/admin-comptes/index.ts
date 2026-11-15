// Fonction Supabase `admin-comptes` (Deno) : actions d'administration technique (inviter, suspendre, rétablir, réinitialiser le mot de passe,
// supprimer un compte). Appelée par l'application depuis l'écran « Comptes » avec le jeton de l'administrateur connecté.
// La clé de service ne sort jamais d'ici. Les règles sont dans comptes.ts (testées sous Vitest) ; ce fichier ne fait que brancher Supabase.
//
// Sécurité : la plateforme vérifie la signature du jeton (verify_jwt par défaut) ; la fonction exige en plus `app_metadata.role = 'admin'`.
// Aucune lecture de données d'entraînement : seules des métadonnées de compte sont touchées, et la suppression vide les tables du compte.
//
// Secrets : SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont fournis par la plateforme. Facultatif : SITE_URL (adresse de l'application,
// pour les liens des e-mails d'invitation et de réinitialisation).

import { createClient } from 'npm:@supabase/supabase-js@2'
import { ErreurAdmin, executer, lireDemande, TABLES_UTILISATEUR, type PortsAdmin } from './comptes.ts'

const env = (nom: string): string => {
  const v = Deno.env.get(nom)
  if (!v) throw new Error(`Variable d'environnement manquante : ${nom}`)
  return v
}

const entetes = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
const reponse = (statut: number, corps: unknown) => new Response(JSON.stringify(corps), { status: statut, headers: entetes })

Deno.serve(async (requete) => {
  if (requete.method === 'OPTIONS') return new Response(null, { status: 204, headers: entetes })
  if (requete.method !== 'POST') return reponse(405, { erreur: 'Méthode non autorisée.' })

  try {
    const base = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false, autoRefreshToken: false } })
    const jeton = (requete.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
    const { data: appelant, error: erreurJeton } = await base.auth.getUser(jeton)
    if (erreurJeton || !appelant.user) return reponse(401, { erreur: 'Connexion requise.' })
    if (appelant.user.app_metadata?.role !== 'admin') return reponse(403, { erreur: 'Accès refusé.' })

    const demande = lireDemande(await requete.json().catch(() => null))
    const redirection = Deno.env.get('SITE_URL') || undefined
    const adminId = appelant.user.id

    const ports: PortsAdmin = {
      adminId,
      async trouverCompte(id) {
        const { data, error } = await base.auth.admin.getUserById(id)
        if (error || !data.user) return null
        return { id: data.user.id, email: data.user.email ?? null, admin: data.user.app_metadata?.role === 'admin' }
      },
      async inviter(email) {
        const { error } = await base.auth.admin.inviteUserByEmail(email, redirection ? { redirectTo: redirection } : undefined)
        if (error) throw new ErreurAdmin(400, `Invitation impossible : ${error.message}`)
      },
      async bannir(id, banni) {
        // ~100 ans : la connexion est refusée et les jetons de rafraîchissement ne sont plus acceptés
        const { error } = await base.auth.admin.updateUserById(id, { ban_duration: banni ? '876000h' : 'none' })
        if (error) throw new Error(error.message)
      },
      async marquerStatut(id, statut) {
        const { error } = await base.from('profils').upsert({ user_id: id, statut }, { onConflict: 'user_id' })
        if (error) throw new Error(error.message)
      },
      async envoyerReinitialisation(email) {
        const { error } = await base.auth.resetPasswordForEmail(email, redirection ? { redirectTo: redirection } : undefined)
        if (error) throw new ErreurAdmin(400, `Envoi impossible : ${error.message}`)
      },
      async revoquerSessions(id) {
        const { data, error } = await base.rpc('admin_revoquer_sessions', { p_user: id })
        if (error) throw new Error(error.message)
        return Number(data ?? 0)
      },
      async viderTables(id) {
        for (const table of TABLES_UTILISATEUR) {
          const { error } = await base.from(table).delete().eq('user_id', id)
          if (error) throw new Error(`Suppression des lignes de ${table} impossible : ${error.message}`)
        }
      },
      async supprimerUtilisateur(id) {
        const { error } = await base.auth.admin.deleteUser(id)
        if (error) throw new Error(error.message)
      },
      async journaliser(action, cibleId, detail) {
        const { error } = await base.from('journal_admin').insert({ admin_id: adminId, action, cible_user_id: cibleId, detail })
        if (error) throw new Error(`Journal d'audit impossible : ${error.message}`)
      },
    }

    return reponse(200, await executer(demande, ports))
  } catch (e) {
    if (e instanceof ErreurAdmin) return reponse(e.statut, { erreur: e.message })
    console.error('admin-comptes', e)
    return reponse(500, { erreur: 'Erreur du serveur.' })
  }
})
