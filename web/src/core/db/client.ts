import { PowerSyncDatabase } from '@powersync/web'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { AppSchema } from './schema'

// Les clients sont créés à la demande (et non à l'import) pour que les tests et le build
// fonctionnent sans variables d'environnement ; l'erreur n'apparaît qu'à l'usage réel.
function variable(nom: 'VITE_SUPABASE_URL' | 'VITE_SUPABASE_ANON_KEY' | 'VITE_POWERSYNC_URL'): string {
  const valeur = import.meta.env[nom] as string | undefined
  if (!valeur) {
    throw new Error(`Configuration manquante : la variable ${nom} n'est pas définie (voir web/.env.example).`)
  }
  return valeur
}

let supabase: SupabaseClient | undefined
let db: PowerSyncDatabase | undefined

export function getSupabase(): SupabaseClient {
  supabase ??= createClient(variable('VITE_SUPABASE_URL'), variable('VITE_SUPABASE_ANON_KEY'))
  return supabase
}

export function getPowerSyncUrl(): string {
  return variable('VITE_POWERSYNC_URL')
}

export function getDb(): PowerSyncDatabase {
  db ??= new PowerSyncDatabase({
    schema: AppSchema,
    database: { dbFilename: 'pandamove.db' },
  })
  return db
}
