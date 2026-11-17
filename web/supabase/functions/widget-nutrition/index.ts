// Fonction Supabase `widget-nutrition` (Deno) : totaux du jour pour le widget Android de nutrition, et ajout d'eau depuis le widget.
//   GET  ?date=YYYY-MM-DD            : totaux du jour (énergie, macros, eau, objectifs, énergie par repas). Aucun nom d'aliment.
//   POST { date, ml, cle }           : ajoute de l'eau (jeton avec l'option « eau » seulement) ; `cle` rend l'appel idempotent.
// Le widget s'authentifie par un JETON (`Authorization: Bearer pmw_…`) créé dans le Profil, pas par un JWT : cette fonction se déploie donc
// avec `--no-verify-jwt`. Le jeton n'est jamais stocké (empreinte SHA-256 seulement, table jetons_widget, migration 0021) ; il se révoque dans
// le Profil. La clé de service ne sort jamais d'ici ; chaque lecture est filtrée sur le `user_id` du jeton. Règles dans widget.ts.
//
// Secrets : SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont fournis par la plateforme.

import { createClient } from 'npm:@supabase/supabase-js@2'
import { DELAI_LECTURE_MS, ErreurWidget, traiterEau, traiterResume, type LigneJournal, type ObjectifsLus, type PortsWidget, type VerdictJeton } from './widget.ts'

const env = (nom: string): string => {
  const v = Deno.env.get(nom)
  if (!v) throw new Error(`Variable d'environnement manquante : ${nom}`)
  return v
}

const entetes = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
const reponse = (statut: number, corps: unknown, supplement: Record<string, string> = {}) =>
  new Response(JSON.stringify(corps), { status: statut, headers: { ...entetes, ...supplement } })

Deno.serve(async (requete) => {
  if (requete.method !== 'GET' && requete.method !== 'POST') return reponse(405, { erreur: 'Méthode non autorisée.', code: 'methode' }, { Allow: 'GET, POST' })

  try {
    const base = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false, autoRefreshToken: false } })
    const ports: PortsWidget = {
      maintenant: () => new Date(),
      async verifierJeton(empreinte, marquerLecture): Promise<VerdictJeton> {
        const { data, error } = await base.from('jetons_widget').select('id, user_id, ecriture_eau, revoque_at').eq('hash', empreinte).maybeSingle()
        if (error) throw new Error(error.message)
        if (!data) return { statut: 'inconnu' }
        if (data.revoque_at) return { statut: 'revoque' }
        if (marquerLecture) {
          // Mise à jour conditionnelle (atomique) : refusée si la lecture précédente date de moins de 20 s
          const limite = new Date(Date.now() - DELAI_LECTURE_MS).toISOString()
          const { data: lignes, error: e } = await base
            .from('jetons_widget')
            .update({ derniere_lecture_at: new Date().toISOString() })
            .eq('id', data.id)
            .is('revoque_at', null)
            .or(`derniere_lecture_at.is.null,derniere_lecture_at.lt.${limite}`)
            .select('id')
          if (e) throw new Error(e.message)
          if ((lignes ?? []).length === 0) return { statut: 'trop_vite' }
        }
        return { statut: 'ok', userId: data.user_id as string, ecritureEau: data.ecriture_eau === true }
      },
      async lireJour(userId, date): Promise<LigneJournal[]> {
        const { data, error } = await base.from('repas_entrees').select('id, repas, kcal, proteines, glucides, lipides, quantite_g').eq('user_id', userId).eq('date', date).is('deleted_at', null)
        if (error) throw new Error(error.message)
        return (data ?? []) as LigneJournal[]
      },
      async lireObjectifs(userId): Promise<ObjectifsLus | null> {
        const { data, error } = await base
          .from('objectifs_nutrition')
          .select('kcal, proteines_g, glucides_g, lipides_g, eau_ml')
          .eq('user_id', userId)
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(1)
        if (error) throw new Error(error.message)
        return ((data ?? [])[0] as ObjectifsLus | undefined) ?? null
      },
      async insererEau({ id, userId, date, ml, creeLe }) {
        const { data, error } = await base
          .from('repas_entrees')
          .upsert(
            { id, user_id: userId, date, repas: 'eau', nom: 'Eau', quantite_g: ml, kcal: 0, proteines: 0, glucides: 0, lipides: 0, source: 'eau', created_at: creeLe },
            { onConflict: 'id', ignoreDuplicates: true },
          )
          .select('id')
        if (error) throw new Error(error.message)
        return (data ?? []).length > 0
      },
    }

    const entete = requete.headers.get('Authorization')
    if (requete.method === 'GET') return reponse(200, await traiterResume(entete, new URL(requete.url).searchParams.get('date'), ports))
    return reponse(200, await traiterEau(entete, await requete.json().catch(() => null), ports))
  } catch (e) {
    if (e instanceof ErreurWidget) return reponse(e.statut, { erreur: e.message, code: e.code }, e.reessayerDansS ? { 'Retry-After': String(e.reessayerDansS) } : {})
    console.error('widget-nutrition', e)
    return reponse(500, { erreur: 'Erreur du serveur.', code: 'serveur' })
  }
})
