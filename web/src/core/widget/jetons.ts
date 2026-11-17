import type { ClientSupabase } from '../db/clientSupabase'

// Widget Android de nutrition : jetons créés dans le Profil. Un jeton ne donne accès qu'à la fonction `widget-nutrition` (totaux du jour,
// aucun nom d'aliment ; ajout d'eau si l'option est cochée). Création et révocation passent par des fonctions SQL (migration 0021) ; le
// jeton n'est rendu qu'une fois, à sa création. La liste ne contient jamais l'empreinte.

export interface JetonWidget {
  id: string
  nom: string
  ecritureEau: boolean
  creeLe: string
  derniereLectureLe: string | null
}

interface LigneJeton {
  id: string
  nom: string
  ecriture_eau: boolean
  created_at: string
  derniere_lecture_at: string | null
}

const MESSAGE_SQL_ABSENT = 'Le widget n’est pas encore installé côté serveur (migration 0021 à appliquer).'

function erreurLisible(e: { message?: string; code?: string } | null): Error {
  // 42883 / PGRST202 : fonction absente ; 42P01 / PGRST205 : table absente
  if (e?.code && ['42883', 'PGRST202', '42P01', 'PGRST205'].includes(e.code)) return new Error(MESSAGE_SQL_ABSENT)
  return new Error(e?.message || 'L’action a échoué.')
}

/** Widgets reliés et non révoqués, du plus ancien au plus récent ; null si la liste est illisible (migration absente, hors ligne). */
export async function listerJetons(supabase: ClientSupabase): Promise<JetonWidget[] | null> {
  const { data, error } = await supabase.from('jetons_widget').select('id, nom, ecriture_eau, created_at, derniere_lecture_at').is('revoque_at', null).order('created_at', { ascending: true })
  if (error || !Array.isArray(data)) return null
  return (data as LigneJeton[]).map((l) => ({ id: l.id, nom: l.nom, ecritureEau: l.ecriture_eau, creeLe: l.created_at, derniereLectureLe: l.derniere_lecture_at }))
}

/** Crée un jeton et le rend (« pmw_… ») : il ne sera plus jamais affiché. */
export async function creerJeton(supabase: ClientSupabase, nom: string, ecritureEau: boolean): Promise<string> {
  const { data, error } = await supabase.rpc('creer_jeton_widget', { p_nom: nom.trim(), p_ecriture_eau: ecritureEau })
  if (error || typeof data !== 'string') throw erreurLisible(error)
  return data
}

export async function revoquerJeton(supabase: ClientSupabase, id: string): Promise<void> {
  const { error } = await supabase.rpc('revoquer_jeton_widget', { p_id: id })
  if (error) throw erreurLisible(error)
}

export async function reglerEauJeton(supabase: ClientSupabase, id: string, actif: boolean): Promise<void> {
  const { error } = await supabase.rpc('regler_eau_jeton_widget', { p_id: id, p_actif: actif })
  if (error) throw erreurLisible(error)
}

/** Adresse de la fonction à saisir dans le widget (déduite de l'adresse Supabase de l'application) ; null si elle n'est pas configurée. */
export function adresseFonctionWidget(base: string | undefined = import.meta.env.VITE_SUPABASE_URL): string | null {
  const url = (base ?? '').trim().replace(/\/+$/, '')
  return /^https?:\/\//i.test(url) ? `${url}/functions/v1/widget-nutrition` : null
}

/** « à l'instant », « il y a 12 min », « il y a 3 h », « il y a 2 j » ; null si la date est absente ou illisible. */
export function ilYaDepuis(iso: string | null, maintenant: Date): string | null {
  if (!iso) return null
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return null
  const minutes = Math.max(0, Math.round((maintenant.getTime() - t) / 60_000))
  if (minutes < 1) return 'à l’instant'
  if (minutes < 60) return `il y a ${minutes} min`
  if (minutes < 60 * 48) return `il y a ${Math.round(minutes / 60)} h`
  return `il y a ${Math.round(minutes / 1440)} j`
}
