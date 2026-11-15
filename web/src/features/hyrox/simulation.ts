import { STATIONS, type CleStation } from './stations'

// Règles pures du module Hyrox : forme d'une simulation, répartition du temps visé, bilan et records. Aucune lecture en base ici.

export type FormeSimulation = 'complete' | 'partielle' | 'station'
export const FORMES: readonly FormeSimulation[] = ['complete', 'partielle', 'station']
export const LIBELLE_FORME: Record<FormeSimulation, string> = {
  complete: 'Complète · 8 × 1 km + 8 stations',
  partielle: 'Partielle · 4 × 1 km + 4 stations',
  station: 'Une station seule',
}

export interface PlanSegment {
  /** De 1 à 16. */
  rang: number
  type: 'course' | 'station'
  station: CleStation | null
}

/** Part du temps de course consacrée aux 8 km (le reste va aux stations), en pourcentage. */
export const PART_COURSES_DEFAUT = 55
export const PART_COURSES_MIN = 30
export const PART_COURSES_MAX = 70
/** Écart (en %) entre l'objectif et l'estimation au-delà duquel on prévient, sans jamais refuser. */
export const SEUIL_ECART_OBJECTIF_PCT = 5

/** Segments de la course complète : 1 km puis une station, huit fois. */
export const SEGMENTS_COMPLETS: readonly PlanSegment[] = STATIONS.flatMap((s, i) => [
  { rang: 2 * i + 1, type: 'course' as const, station: null },
  { rang: 2 * i + 2, type: 'station' as const, station: s.cle },
])

export function segmentsDeForme(forme: FormeSimulation, station?: CleStation | null): PlanSegment[] {
  if (forme === 'complete') return SEGMENTS_COMPLETS.map((s) => ({ ...s }))
  if (forme === 'partielle') return SEGMENTS_COMPLETS.slice(0, 8).map((s) => ({ ...s }))
  if (!station) throw new Error('Choisissez la station à simuler.')
  return [{ rang: 1, type: 'station', station }]
}

/** Cibles (en secondes) des 16 segments de la course complète pour un temps total visé. */
export function ciblesCourseComplete(totalS: number, partCoursesPct: number): number[] {
  const part = Math.min(PART_COURSES_MAX, Math.max(PART_COURSES_MIN, partCoursesPct)) / 100
  const poidsTotal = STATIONS.reduce((t, s) => t + s.poids, 0)
  return SEGMENTS_COMPLETS.map((seg) => {
    if (seg.type === 'course') return Math.round((totalS * part) / 8)
    const poids = STATIONS.find((s) => s.cle === seg.station)!.poids
    return Math.round((totalS * (1 - part) * poids) / poidsTotal)
  })
}

/** Cibles des segments d'une forme de simulation, ou null sans temps visé. */
export function ciblesPourSegments(segments: readonly PlanSegment[], totalS: number | null, partCoursesPct: number): (number | null)[] {
  if (totalS === null) return segments.map(() => null)
  const toutes = ciblesCourseComplete(totalS, partCoursesPct)
  return segments.map((s) => {
    const i = SEGMENTS_COMPLETS.findIndex((c) => c.type === s.type && c.station === s.station)
    // Les courses de la forme partielle portent la cible d'un kilomètre quelconque (elles sont toutes égales)
    return s.type === 'course' ? toutes[0] : i >= 0 ? toutes[i] : null
  })
}

/** Réglage de la répartition, enregistré dans `repartition_json` de l'objectif. */
export interface Repartition {
  partCoursesPct: number
}

export function lireRepartition(json: string | null | undefined): Repartition {
  try {
    const v = json ? (JSON.parse(json) as { partCoursesPct?: unknown }) : null
    const p = v && typeof v.partCoursesPct === 'number' && Number.isFinite(v.partCoursesPct) ? v.partCoursesPct : PART_COURSES_DEFAUT
    return { partCoursesPct: Math.min(PART_COURSES_MAX, Math.max(PART_COURSES_MIN, Math.round(p))) }
  } catch {
    return { partCoursesPct: PART_COURSES_DEFAUT }
  }
}

/** Écrit la répartition dans le JSON de l'objectif en gardant les autres champs (réglages du plan de préparation). */
export function ecrireRepartition(r: Repartition, existant?: string | null): string {
  let base: Record<string, unknown> = {}
  try {
    const v = existant ? (JSON.parse(existant) as unknown) : null
    if (v && typeof v === 'object' && !Array.isArray(v)) base = v as Record<string, unknown>
  } catch {
    base = {}
  }
  return JSON.stringify({ ...base, partCoursesPct: Math.round(r.partCoursesPct) })
}

export interface SegmentMesure {
  rang: number
  type: 'course' | 'station'
  station: CleStation | null
  cibleS: number | null
  reelS: number | null
}

export interface Bilan {
  totalS: number
  /** Temps cible cumulé des segments terminés ; null sans cible. */
  cibleS: number | null
  /** Écart total à la cible (positif = plus lent) ; null sans cible. */
  ecartS: number | null
  /** Segments terminés avec leur écart, du plus en retard au plus en avance (écart relatif à la cible, ou absolu sans cible). */
  classement: { segment: SegmentMesure; ecartS: number | null }[]
  forts: SegmentMesure[]
  faibles: SegmentMesure[]
  /** Temps de chaque kilomètre, dans l'ordre : montre la dérive de course. */
  kilometres: number[]
}

const termines = (segments: readonly SegmentMesure[]) => segments.filter((s) => s.reelS !== null)

export function bilanSimulation(segments: readonly SegmentMesure[]): Bilan | null {
  const faits = termines(segments)
  if (faits.length === 0) return null
  const totalS = faits.reduce((t, s) => t + (s.reelS ?? 0), 0)
  const avecCible = faits.filter((s) => s.cibleS !== null)
  const cibleS = avecCible.length === faits.length ? avecCible.reduce((t, s) => t + (s.cibleS ?? 0), 0) : null
  const ecart = (s: SegmentMesure) => (s.cibleS !== null && s.reelS !== null ? s.reelS - s.cibleS : null)
  const relatif = (s: SegmentMesure) => (s.cibleS ? (s.reelS! - s.cibleS) / s.cibleS : -Infinity)
  const classement = faits
    .map((segment) => ({ segment, ecartS: ecart(segment) }))
    .sort((a, b) => relatif(b.segment) - relatif(a.segment))
  const mesurables = classement.filter((c) => c.ecartS !== null)
  return {
    totalS,
    cibleS,
    ecartS: cibleS === null ? null : totalS - cibleS,
    classement,
    faibles: mesurables.filter((c) => c.ecartS! > 0).slice(0, 3).map((c) => c.segment),
    forts: mesurables.filter((c) => c.ecartS! <= 0).slice(-3).reverse().map((c) => c.segment),
    kilometres: faits.filter((s) => s.type === 'course').map((s) => s.reelS!),
  }
}

/** Dérive de course : écart (en secondes) entre le dernier et le premier kilomètre ; null avec moins de deux kilomètres. */
export const deriveCourse = (kilometres: readonly number[]) => (kilometres.length < 2 ? null : kilometres[kilometres.length - 1] - kilometres[0])

export interface RecordsHyrox {
  parStation: Partial<Record<CleStation, number>>
  /** Meilleur kilomètre toutes simulations confondues. */
  meilleurKm: number | null
}

/** Meilleurs temps par station et meilleur kilomètre, à partir des segments terminés de simulations terminées. */
export function calculerRecords(segments: readonly SegmentMesure[]): RecordsHyrox {
  const parStation: Partial<Record<CleStation, number>> = {}
  let meilleurKm: number | null = null
  for (const s of termines(segments)) {
    if (s.reelS === null || s.reelS <= 0) continue
    if (s.type === 'course') meilleurKm = meilleurKm === null ? s.reelS : Math.min(meilleurKm, s.reelS)
    else if (s.station && (parStation[s.station] === undefined || s.reelS < parStation[s.station]!)) parStation[s.station] = s.reelS
  }
  return { parStation, meilleurKm }
}

/** Estimation du temps de course : total d'une simulation complète terminée, avec une fourchette de ± 3 %. */
export function estimerTemps(totalS: number): { basS: number; hautS: number } {
  return { basS: Math.round(totalS * 0.97), hautS: Math.round(totalS * 1.03) }
}

/** Écart relatif (en %) entre le temps visé et l'estimation ; positif quand l'objectif est plus ambitieux que l'estimation. */
export const ecartObjectifPct = (objectifS: number, estimationS: number) => ((estimationS - objectifS) / estimationS) * 100

export function formaterChrono(secondes: number): string {
  const s = Math.max(0, Math.round(secondes))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = s % 60
  const deux = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${deux(m)}:${deux(r)}` : `${m}:${deux(r)}`
}

export function formaterEcart(secondes: number): string {
  const signe = secondes > 0 ? '+' : secondes < 0 ? '−' : ''
  return `${signe}${formaterChrono(Math.abs(secondes))}`
}

/** Temps saisi (« 1:10:00 », « 48:30 ») en secondes, ou null s'il est illisible. */
export function lireTempsHyrox(texte: string): number | null {
  const m = /^\s*(?:(\d{1,3}):)?(\d{1,2}):(\d{2})\s*$/.exec(texte)
  if (!m) return null
  const h = m[1] === undefined ? 0 : Number(m[1])
  const min = Number(m[2])
  const s = Number(m[3])
  if (s > 59 || (m[1] !== undefined && min > 59)) return null
  return h * 3600 + min * 60 + s
}

/** Intitulé d'un segment de course dans les listes. */
export const NOM_COURSE_COURT = 'Course 1 km'
