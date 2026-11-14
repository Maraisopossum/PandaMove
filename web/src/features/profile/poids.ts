import { dateIsoValide } from '../../core/common/dates'

// Suivi du poids : pesées et objectif, réglage d'appareil (localStorage, clé `pandamove.poids`), jamais synchronisé. Donnée de santé :
// elle ne quitte pas l'appareil, et l'export complet ne la contient pas. Toute lecture tolère un stockage absent ou corrompu.

export const CLE_POIDS = 'pandamove.poids'
export const POIDS_MIN_KG = 20
export const POIDS_MAX_KG = 300
export const PESEES_MAX = 730

export interface Pesee {
  /** Jour yyyy-MM-dd. */
  date: string
  kg: number
}

export interface SuiviPoids {
  objectifKg: number | null
  /** Une pesée par jour au plus, de la plus ancienne à la plus récente. */
  pesees: Pesee[]
}

const kgValide = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= POIDS_MIN_KG && v <= POIDS_MAX_KG
const arrondi = (kg: number) => Math.round(kg * 10) / 10

export function lireSuiviPoids(): SuiviPoids {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(CLE_POIDS) ?? 'null')
    const o = (v && typeof v === 'object' ? v : {}) as { objectifKg?: unknown; pesees?: unknown }
    const brutes = Array.isArray(o.pesees) ? o.pesees : []
    const parJour = new Map<string, number>()
    for (const p of brutes as Partial<Pesee>[]) if (p && typeof p.date === 'string' && dateIsoValide(p.date) && kgValide(p.kg)) parJour.set(p.date, arrondi(p.kg))
    return {
      objectifKg: kgValide(o.objectifKg) ? arrondi(o.objectifKg) : null,
      pesees: [...parJour.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, kg]) => ({ date, kg })).slice(-PESEES_MAX),
    }
  } catch {
    return { objectifKg: null, pesees: [] }
  }
}

function ecrire(s: SuiviPoids): void {
  try {
    localStorage.setItem(CLE_POIDS, JSON.stringify(s))
  } catch {
    // Stockage indisponible : le suivi vaut pour la session seulement
  }
}

/** Ajoute (ou remplace, pour le même jour) une pesée ; hors de 20 à 300 kg ou date invalide : refusé (null). */
export function ajouterPesee(s: SuiviPoids, date: string, kg: number): SuiviPoids | null {
  if (!dateIsoValide(date) || !kgValide(kg)) return null
  const pesees = [...s.pesees.filter((p) => p.date !== date), { date, kg: arrondi(kg) }].sort((a, b) => a.date.localeCompare(b.date)).slice(-PESEES_MAX)
  const suite = { ...s, pesees }
  ecrire(suite)
  return suite
}

export function retirerPesee(s: SuiviPoids, date: string): SuiviPoids {
  const suite = { ...s, pesees: s.pesees.filter((p) => p.date !== date) }
  ecrire(suite)
  return suite
}

/** `null` retire l'objectif ; hors de 20 à 300 kg : refusé (null renvoyé aussi, l'appelant distingue par l'état d'entrée). */
export function definirObjectifPoids(s: SuiviPoids, kg: number | null): SuiviPoids | null {
  if (kg !== null && !kgValide(kg)) return null
  const suite = { ...s, objectifKg: kg === null ? null : arrondi(kg) }
  ecrire(suite)
  return suite
}

export interface BilanPoids {
  derniere: Pesee | null
  /** Écart en kg avec la pesée de 30 jours plus tôt (la plus proche avant ce jour, sinon la plus ancienne dans la fenêtre) ; null sans point de comparaison. */
  ecart30j: number | null
  /** Pesées des `semaines` dernières semaines, pour la courbe. */
  recentes: Pesee[]
}

const jour = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 86_400_000

export function bilanPoids(s: SuiviPoids, aujourdhuiIso: string, semaines = 8): BilanPoids {
  const derniere = s.pesees[s.pesees.length - 1] ?? null
  const recentes = s.pesees.filter((p) => jour(aujourdhuiIso) - jour(p.date) <= semaines * 7 && p.date <= aujourdhuiIso)
  let ecart30j: number | null = null
  if (derniere) {
    // Pesée la plus proche de J-30 parmi celles qui précèdent la dernière d'au moins 7 jours
    const cible = jour(derniere.date) - 30
    const candidates = s.pesees.filter((p) => jour(derniere.date) - jour(p.date) >= 7 && jour(derniere.date) - jour(p.date) <= 45)
    const proche = candidates.sort((a, b) => Math.abs(jour(a.date) - cible) - Math.abs(jour(b.date) - cible))[0]
    if (proche) ecart30j = arrondi(derniere.kg - proche.kg)
  }
  return { derniere, ecart30j, recentes }
}
