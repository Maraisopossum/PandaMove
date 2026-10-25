import type { PowerSyncBackendConnector, PowerSyncCredentials, PowerSyncDatabase } from '@powersync/web'
import { UpdateType } from '@powersync/web'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getPowerSyncUrl, getSupabase } from '../db/client'
import { rejetsEnvoi } from './rejetsEnvoi'

// Erreurs Postgres qui ne se résoudront jamais en réessayant (données invalides, contrainte,
// droits RLS) : classes 22xxx, 23xxx et 42501. On les écarte pour ne pas bloquer la file d'envoi.
const ERREUR_DEFINITIVE = /^(22\d{3}|23\d{3}|42501)$/

type Operation = { op: UpdateType; table: string; id: string }

// Une opération CRUD locale traduite en requête Supabase (payload fourni, pour pouvoir le réduire).
function envoyer(supabase: SupabaseClient, entry: Operation, opData: Record<string, unknown> | undefined) {
  const table = supabase.from(entry.table)
  if (entry.op === UpdateType.PUT) return table.upsert({ ...opData, id: entry.id })
  // opData est partiel : un upsert violerait les NOT NULL (23502), d'où un update ciblé
  if (entry.op === UpdateType.PATCH) return table.update({ ...opData }).eq('id', entry.id)
  // Suppression logique : la ligne reste en base avec deleted_at (voir spec)
  return table.update({ deleted_at: new Date().toISOString() }).eq('id', entry.id)
}

// PGRST204 = colonne inconnue du cache de schéma PostgREST. Seules les colonnes ajoutées par une migration récente
// sont tolérées (jamais une autre : une vraie erreur de schéma ne doit pas être masquée), table par table :
// validated_at (migration 0006), instances_seance.nom et exercices_seance.notes (migration 0007).
const COLONNES_TOLEREES: Record<string, { colonne: string; migration: string }> = {
  series_realisees: { colonne: 'validated_at', migration: '0006' },
  instances_seance: { colonne: 'nom', migration: '0007' },
  exercices_seance: { colonne: 'notes', migration: '0007' },
}

function colonneAbsenteTolerable(table: string, erreur: { code?: string; message?: string } | null): { colonne: string; migration: string } | null {
  const toleree = COLONNES_TOLEREES[table]
  if (!toleree || erreur?.code !== 'PGRST204') return null
  return new RegExp(`'${toleree.colonne}'`).test(erreur.message ?? '') ? toleree : null
}

export class SupabaseConnector implements PowerSyncBackendConnector {
  private readonly client: () => SupabaseClient

  constructor(client: () => SupabaseClient = getSupabase) {
    this.client = client
  }

  // Renvoie le JWT Supabase de la session courante (null si déconnecté)
  async fetchCredentials(): Promise<PowerSyncCredentials | null> {
    const { data, error } = await this.client().auth.getSession()
    if (error) throw error
    if (!data.session) return null
    return {
      endpoint: getPowerSyncUrl(),
      token: data.session.access_token,
      expiresAt: data.session.expires_at ? new Date(data.session.expires_at * 1000) : undefined,
    }
  }

  // Envoie les modifications locales vers Supabase, transaction par transaction
  async uploadData(database: PowerSyncDatabase): Promise<void> {
    const supabase = this.client()
    // Sans session valide, Supabase verrait un utilisateur anonyme (auth.uid() null) et les erreurs
    // 23502/42501 seraient prises à tort pour définitives : on réessaiera plus tard, sans rien perdre.
    const { data, error: erreurSession } = await supabase.auth.getSession()
    if (erreurSession) throw erreurSession
    if (!data.session) throw new Error('Envoi impossible : aucune session Supabase active (nouvel essai).')
    for (let tx = await database.getNextCrudTransaction(); tx; tx = await database.getNextCrudTransaction()) {
      for (const entry of tx.crud) {
        try {
          let resultat = await envoyer(supabase, entry, entry.opData)
          // Migration (0006, 0007) pas encore passée sur le serveur : une colonne récente n'existe pas (PGRST204). Sans ce
          // repli, TOUTE la file d'envoi resterait bloquée. On renvoie une fois sans cette colonne (le serveur ne l'aura
          // pas : repli sur updated_at pour validated_at ; nom propre / note d'exercice non synchronisés jusqu'à la migration).
          const absente = colonneAbsenteTolerable(entry.table, resultat.error)
          if (absente && entry.opData && absente.colonne in entry.opData) {
            console.warn(
              `Colonne ${absente.colonne} absente côté serveur : exécuter la migration ${absente.migration}. Envoi sans cette colonne.`,
              { table: entry.table, id: entry.id },
            )
            const { [absente.colonne]: _retiree, ...sansColonne } = entry.opData
            void _retiree
            resultat = await envoyer(supabase, entry, sansColonne)
          }
          if (resultat.error) throw resultat.error
        } catch (e) {
          const code = (e as { code?: string }).code
          // Erreur réessayable : on relance sans compléter, toute la transaction sera renvoyée
          // (les opérations déjà passées sont des upserts/updates idempotents)
          if (!code || !ERREUR_DEFINITIVE.test(code)) throw e
          // Erreur définitive : on abandonne CETTE opération seulement et on continue. PostgREST n'est
          // pas atomique entre requêtes : les opérations précédentes sont déjà appliquées côté serveur,
          // abandonner les suivantes les ferait disparaître de l'appareil au prochain point de synchro.
          console.error('Envoi PowerSync abandonné pour une opération (erreur Postgres définitive)', {
            code,
            message: (e as { message?: string }).message,
            operation: { table: entry.table, op: entry.op, id: entry.id },
          })
          // Surfacé à l'utilisateur (alerte non bloquante dans la coque) : cette modification est perdue
          rejetsEnvoi.signaler({ table: entry.table, operation: String(entry.op), code, dateMs: Date.now() })
        }
      }
      await tx.complete()
    }
  }
}
