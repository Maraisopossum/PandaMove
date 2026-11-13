// Fonction Supabase `envoyer-rappels` (Deno) : envoie les rappels de séance par notification push, application fermée.
// Appelée toutes les 5 minutes par une tâche planifiée (pg_cron + pg_net), voir README.md de ce dossier.
// La logique (qui reçoit quoi, quand) est dans rappels.ts, testée sous Vitest ; ce fichier ne fait que brancher Supabase
// (clé de service, qui contourne la RLS) et le service push (web-push).
//
// Secrets (jamais dans le dépôt) : VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto: ou https:), CRON_SECRET.
// SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont fournis par la plateforme.

import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'
import { traiterRappels, type Abonnement, type EvenementARappeler, type IssueEnvoi } from './rappels.ts'

const env = (nom: string): string => {
  const v = Deno.env.get(nom)
  if (!v) throw new Error(`Variable d'environnement manquante : ${nom}`)
  return v
}

// Comparaison à durée constante du secret de la tâche planifiée
function egal(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a)
  const eb = new TextEncoder().encode(b)
  if (ea.length !== eb.length) return false
  let diff = 0
  for (let i = 0; i < ea.length; i++) diff |= ea[i] ^ eb[i]
  return diff === 0
}

Deno.serve(async (requete) => {
  if (requete.method !== 'POST') return new Response('Méthode non autorisée', { status: 405 })
  if (!egal(requete.headers.get('x-cron-secret') ?? '', env('CRON_SECRET'))) return new Response('Non autorisé', { status: 401 })

  const base = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } })
  webpush.setVapidDetails(env('VAPID_SUBJECT'), env('VAPID_PUBLIC_KEY'), env('VAPID_PRIVATE_KEY'))

  // Mémoire anti-doublon : les clés de plus de 7 jours ne servent plus (les rappels ne concernent que la veille et le jour)
  await base.from('rappels_push_envoyes').delete().lt('envoye_le', new Date(Date.now() - 7 * 86_400_000).toISOString())

  const { data: lignes, error } = await base.from('push_abonnements').select('id, user_id, endpoint, cle_p256dh, cle_auth, fuseau')
  if (error) return new Response(`Lecture des abonnements impossible : ${error.message}`, { status: 500 })
  const abonnements: Abonnement[] = (lignes ?? []).map((l) => ({
    id: l.id, userId: l.user_id, endpoint: l.endpoint, p256dh: l.cle_p256dh, auth: l.cle_auth, fuseau: l.fuseau,
  }))

  const bilan = await traiterRappels({
    maintenant: new Date(),
    abonnements,

    async reglagesDe(userId) {
      const { data } = await base.from('user_settings').select('rappels_json').eq('user_id', userId).is('deleted_at', null).maybeSingle()
      return (data?.rappels_json as string | null | undefined) ?? null
    },

    async evenements(userId, debutIso, finIso): Promise<EvenementARappeler[]> {
      const resultat: EvenementARappeler[] = []
      // Renforcement : séances planifiées ou en cours (non terminées) ; le nom propre de la séance jouée prime sur celui du modèle
      const { data: instances } = await base
        .from('instances_seance').select('id, seance_id, date, nom')
        .eq('user_id', userId).is('deleted_at', null).eq('is_completed', false).gte('date', debutIso).lte('date', finIso)
      const ids = [...new Set((instances ?? []).map((i) => i.seance_id as string))]
      const noms = new Map<string, string>()
      if (ids.length > 0) {
        const { data: seances } = await base.from('seances').select('id, nom').in('id', ids)
        for (const s of seances ?? []) noms.set(s.id as string, s.nom as string)
      }
      for (const i of instances ?? []) {
        resultat.push({ id: i.id, dateIso: i.date, titre: (i.nom as string | null) || noms.get(i.seance_id as string) || 'Séance' })
      }
      // Cardio planifié : séances non validées
      for (const table of ['seances_course', 'seances_velo']) {
        const { data } = await base
          .from(table).select('id, titre, date')
          .eq('user_id', userId).is('deleted_at', null).eq('is_validated', false).gte('date', debutIso).lte('date', finIso)
        for (const s of data ?? []) resultat.push({ id: s.id, dateIso: s.date, titre: s.titre })
      }
      return resultat
    },

    async dejaEnvoyes(userId) {
      const { data } = await base.from('rappels_push_envoyes').select('cle').eq('user_id', userId)
      return new Set((data ?? []).map((l) => l.cle as string))
    },

    async envoyer(abo, rappel): Promise<IssueEnvoi> {
      try {
        await webpush.sendNotification(
          { endpoint: abo.endpoint, keys: { p256dh: abo.p256dh, auth: abo.auth } },
          JSON.stringify({ titre: rappel.titre, corps: rappel.corps, cle: rappel.cle }),
          { TTL: 3600, urgency: 'normal' },
        )
        return 'ok'
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode
        // 404 / 410 : abonnement désinscrit ou expiré, à supprimer
        if (code === 404 || code === 410) return 'expire'
        console.error('Envoi push refusé', code, (e as Error).message)
        return 'erreur'
      }
    },

    async marquerEnvoye(userId, cle) {
      await base.from('rappels_push_envoyes').upsert({ user_id: userId, cle }, { onConflict: 'user_id,cle', ignoreDuplicates: true })
    },

    async supprimerAbonnement(id) {
      await base.from('push_abonnements').delete().eq('id', id)
    },
  })

  return new Response(JSON.stringify(bilan), { headers: { 'Content-Type': 'application/json' } })
})
