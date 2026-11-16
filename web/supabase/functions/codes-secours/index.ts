// Fonction Supabase `codes-secours` (Deno) : codes de secours à usage unique de la double authentification.
//   generer : crée 8 nouveaux codes (les anciens cessent de fonctionner) ; exige une session qui a passé le code à 6 chiffres (aal2).
//   utiliser: consomme un code de secours et retire le second facteur du compte (téléphone perdu) ; accessible avec le seul mot de passe (aal1).
// Seule l'empreinte des codes est stockée. La clé de service ne sort jamais d'ici. Les règles sont dans codes.ts (testées sous Vitest).
//
// Secrets : SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont fournis par la plateforme.

import { createClient } from 'npm:@supabase/supabase-js@2'
import { ErreurCodes, executer, lireDemande, type PortsCodes } from './codes.ts'

const env = (nom: string): string => {
  const v = Deno.env.get(nom)
  if (!v) throw new Error(`Variable d'environnement manquante : ${nom}`)
  return v
}

const entetes = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
const reponse = (statut: number, corps: unknown) => new Response(JSON.stringify(corps), { status: statut, headers: entetes })

/** Niveau `aal` lu dans la charge du jeton (la signature a déjà été vérifiée par la plateforme et par getUser). */
function niveauDuJeton(jeton: string): 'aal1' | 'aal2' | null {
  try {
    const charge = JSON.parse(atob(jeton.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))) as { aal?: unknown }
    return charge.aal === 'aal2' ? 'aal2' : charge.aal === 'aal1' ? 'aal1' : null
  } catch {
    return null
  }
}

Deno.serve(async (requete) => {
  if (requete.method === 'OPTIONS') return new Response(null, { status: 204, headers: entetes })
  if (requete.method !== 'POST') return reponse(405, { erreur: 'Méthode non autorisée.' })

  try {
    const base = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false, autoRefreshToken: false } })
    const jeton = (requete.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
    const { data: appelant, error: erreurJeton } = await base.auth.getUser(jeton)
    if (erreurJeton || !appelant.user) return reponse(401, { erreur: 'Connexion requise.' })
    const userId = appelant.user.id
    const demande = lireDemande(await requete.json().catch(() => null))

    const ports: PortsCodes = {
      userId,
      niveau: niveauDuJeton(jeton),
      octets: (taille) => crypto.getRandomValues(new Uint8Array(taille)),
      async aUnFacteur() {
        const { data, error } = await base.auth.admin.mfa.listFactors({ userId })
        if (error) throw new Error(error.message)
        return (data.factors ?? []).some((f) => f.factor_type === 'totp' && f.status === 'verified')
      },
      async remplacerCodes(empreintes) {
        const { error: e1 } = await base.from('mfa_codes_secours').delete().eq('user_id', userId)
        if (e1) throw new Error(e1.message)
        const { error: e2 } = await base.from('mfa_codes_secours').insert(empreintes.map((code_hash) => ({ user_id: userId, code_hash })))
        if (e2) throw new Error(e2.message)
      },
      async consommerCode(empreinte) {
        // Une seule requête : le code n'est accepté qu'une fois même si deux appels arrivent en même temps
        const { data, error } = await base
          .from('mfa_codes_secours')
          .update({ utilise_at: new Date().toISOString() })
          .eq('user_id', userId)
          .eq('code_hash', empreinte)
          .is('utilise_at', null)
          .select('id')
        if (error) throw new Error(error.message)
        return (data ?? []).length > 0
      },
      async retirerFacteurs() {
        const { data, error } = await base.auth.admin.mfa.listFactors({ userId })
        if (error) throw new Error(error.message)
        const facteurs = data.factors ?? []
        for (const f of facteurs) {
          const { error: e } = await base.auth.admin.mfa.deleteFactor({ id: f.id, userId })
          if (e) throw new Error(e.message)
        }
        return facteurs.length
      },
    }

    return reponse(200, await executer(demande, ports))
  } catch (e) {
    if (e instanceof ErreurCodes) return reponse(e.statut, { erreur: e.message })
    console.error('codes-secours', e)
    return reponse(500, { erreur: 'Erreur du serveur.' })
  }
})
