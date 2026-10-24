import type { PowerSyncBackendConnector, PowerSyncCredentials, PowerSyncDatabase } from '@powersync/web'
import { UpdateType } from '@powersync/web'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getPowerSyncUrl, getSupabase } from '../db/client'

// Erreurs Postgres qui ne se résoudront jamais en réessayant (données invalides, contrainte,
// droits RLS) : classes 22xxx, 23xxx et 42501. On les écarte pour ne pas bloquer la file d'envoi.
const ERREUR_DEFINITIVE = /^(22\d{3}|23\d{3}|42501)$/

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
    for (let tx = await database.getNextCrudTransaction(); tx; tx = await database.getNextCrudTransaction()) {
      try {
        for (const entry of tx.crud) {
          const table = supabase.from(entry.table)
          let resultat
          if (entry.op === UpdateType.PUT || entry.op === UpdateType.PATCH) {
            // PATCH = upsert : opData ne contient que les colonnes modifiées, fusionnées avec l'id
            resultat = await table.upsert({ ...entry.opData, id: entry.id })
          } else {
            // Suppression logique : la ligne reste en base avec deleted_at (voir spec)
            resultat = await table.update({ deleted_at: new Date().toISOString() }).eq('id', entry.id)
          }
          if (resultat.error) throw resultat.error
        }
        await tx.complete()
      } catch (e) {
        const code = (e as { code?: string }).code
        if (code && ERREUR_DEFINITIVE.test(code)) {
          // Erreur non récupérable : on abandonne cette transaction pour débloquer la file
          await tx.complete()
          continue
        }
        throw e
      }
    }
  }
}
