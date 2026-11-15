import type { Session } from '@supabase/auth-js'
import type { ClientSupabase } from '../db/clientSupabase'

// Administration technique : métadonnées des comptes seulement (voir migration 0016). Aucune donnée d'entraînement. Les fonctions
// serveur refusent tout compte sans le rôle administrateur ; ce contrôle côté client ne sert qu'à masquer l'entrée et rediriger.

/** Rôle administrateur du JWT (`app_metadata.role`, posé à la main dans Supabase, non modifiable par l'utilisateur). */
export const estAdmin = (session: Session | null): boolean => session?.user.app_metadata?.role === 'admin'

export interface CompteAdmin {
  userId: string
  email: string | null
  inscritAt: string
  derniereConnexionAt: string | null
  derniereSynchroAt: string | null
  versionApp: string | null
  statut: 'actif' | 'suspendu'
}

export interface ResumeAdmin {
  inscrits: number
  actifs7j: number
  actifs30j: number
  suspendus: number
}

export interface EntreeJournal {
  id: string
  adminId: string
  action: string
  cibleUserId: string | null
  at: string
  detail: string | null
}

type Ligne = Record<string, unknown>
const txt = (v: unknown): string | null => (v == null ? null : String(v))

async function appeler(supabase: ClientSupabase, fonction: string, args?: Record<string, unknown>): Promise<Ligne[]> {
  const { data, error } = await supabase.rpc(fonction, args)
  if (error) throw new Error(error.message)
  return Array.isArray(data) ? (data as Ligne[]) : data ? [data as Ligne] : []
}

export async function listerComptes(supabase: ClientSupabase): Promise<CompteAdmin[]> {
  return (await appeler(supabase, 'admin_lister_comptes')).map((l) => ({
    userId: String(l.user_id), email: txt(l.email), inscritAt: String(l.inscrit_at), derniereConnexionAt: txt(l.derniere_connexion_at),
    derniereSynchroAt: txt(l.derniere_synchro_at), versionApp: txt(l.version_app), statut: l.statut === 'suspendu' ? 'suspendu' : 'actif',
  }))
}

export async function lireResume(supabase: ClientSupabase): Promise<ResumeAdmin> {
  const l = (await appeler(supabase, 'admin_resume'))[0] ?? {}
  return { inscrits: Number(l.inscrits ?? 0), actifs7j: Number(l.actifs_7j ?? 0), actifs30j: Number(l.actifs_30j ?? 0), suspendus: Number(l.suspendus ?? 0) }
}

export async function lireJournal(supabase: ClientSupabase, limite = 100): Promise<EntreeJournal[]> {
  return (await appeler(supabase, 'admin_lire_journal', { p_limite: limite })).map((l) => ({
    id: String(l.id), adminId: String(l.admin_id), action: String(l.action), cibleUserId: txt(l.cible_user_id), at: String(l.at), detail: txt(l.detail),
  }))
}

/**
 * Battement : version de l'application et horodatage, RIEN d'autre (aucune donnée d'entraînement). Les erreurs sont ignorées : hors ligne,
 * ou avant l'application de la migration, l'application fonctionne exactement comme avant.
 */
export async function envoyerBattement(supabase: ClientSupabase, version: string, synchro = false): Promise<void> {
  try {
    await supabase.rpc('enregistrer_battement', { p_version: version, p_synchro: synchro })
  } catch {
    // sans conséquence
  }
}
