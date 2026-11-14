import { LIBELLES_GROUPE } from '../../core/catalogue/muscleToGroup'
import type { DbLecture } from '../../core/db/Db'
import type { MuscleGroup } from '../../core/db/types'
import { ajouterJours } from '../endurance/calculCharge'
import { rangZone, type ZoneCorps } from '../mobilite/donnees'
import { musclePrincipal, type BlocTonnage, type ResumeInstanceJouee } from '../stats/statsQueries'

// Suggestions de l'écran Renforcement : séance du jour d'après les muscles les moins travaillés, alerte de charge, dernière fois et
// tendance de chaque séance type, zones d'échauffement. Fonctions pures sur des données déjà lues, sauf `lireGroupesParSeance`.
// Indicatif : ne remplace ni un programme ni les sensations.

async function lireGroupes(db: DbLecture, seanceId: string | null): Promise<Map<string, MuscleGroup[]>> {
  const lignes = await db.getAll<{ seance_id: string; muscle_groups: string | null; muscle_primary: string | null }>(
    `SELECT es.seance_id AS seance_id, e.muscle_groups AS muscle_groups, e.muscle_primary AS muscle_primary
     FROM exercices_seance es
     JOIN seances s ON s.id = es.seance_id AND s.deleted_at IS NULL ${seanceId === null ? 'AND s.is_archived = 0' : ''}
     JOIN exercises e ON e.id = es.exercise_id AND e.deleted_at IS NULL
     WHERE es.instance_seance_id IS NULL AND es.deleted_at IS NULL ${seanceId === null ? '' : 'AND es.seance_id = ?'}`,
    seanceId === null ? [] : [seanceId],
  )
  const m = new Map<string, MuscleGroup[]>()
  for (const l of lignes) {
    const g = musclePrincipal(l.muscle_groups, l.muscle_primary)
    const liste = m.get(l.seance_id) ?? []
    if (!liste.includes(g)) liste.push(g)
    m.set(l.seance_id, liste)
  }
  return m
}

/** Groupes musculaires de chaque séance type active (muscle principal de chacun de ses exercices). */
export const lireGroupesParSeance = (db: DbLecture) => lireGroupes(db, null)

/** Groupes musculaires d'une séance type (archivée comprise), dans l'ordre de ses exercices. */
export async function lireGroupesDeSeance(db: DbLecture, seanceId: string): Promise<MuscleGroup[]> {
  return (await lireGroupes(db, seanceId)).get(seanceId) ?? []
}

// ── Séance suggérée ──────────────────────────────────────────────────────────────────────────────────────────

/** Un groupe est « en retard » sous 35 % du volume du groupe le plus travaillé. */
const SEUIL_RETARD = 0.35
/** En dessous de ce nombre de séries sur la période, aucune suggestion : trop peu de données pour parler d'équilibre. */
export const SERIES_MIN_SUGGESTION = 8

export interface GroupeVolume {
  groupe: MuscleGroup
  libelle: string
  series: number
}

export interface SuggestionSeance {
  seanceId: string
  /** Groupes en retard que la séance travaille, du plus en retard au moins en retard. */
  enRetard: GroupeVolume[]
  /** Les groupes les plus travaillés sur la période (pour l'équilibre affiché). */
  plusTravailles: GroupeVolume[]
  /** « Quadriceps et fessiers sont les moins travaillés… » */
  explication: string
}

const libelle = (g: MuscleGroup) => LIBELLES_GROUPE[g]

function joindre(noms: string[]): string {
  return noms.length <= 1 ? (noms[0] ?? '') : `${noms.slice(0, -1).join(', ')} et ${noms[noms.length - 1]}`
}

/**
 * Séances types classées par ce qu'elles apportent aux groupes en retard (somme de leur retard relatif). Sans séance qui en touche
 * un, ou avec moins de 8 séries sur la période : liste vide. `volume` : séries par groupe (14 derniers jours).
 */
export function suggererSeances(volume: Record<MuscleGroup, number>, groupesParSeance: ReadonlyMap<string, readonly MuscleGroup[]>): SuggestionSeance[] {
  const groupes = Object.keys(volume) as MuscleGroup[]
  const total = groupes.reduce((t, g) => t + volume[g], 0)
  const max = Math.max(0, ...groupes.map((g) => volume[g]))
  if (total < SERIES_MIN_SUGGESTION || max === 0) return []
  const enRetard = (g: MuscleGroup) => g !== 'AUTRE' && volume[g] <= SEUIL_RETARD * max
  const plusTravailles = [...groupes].filter((g) => g !== 'AUTRE' && volume[g] > 0).sort((a, b) => volume[b] - volume[a]).slice(0, 3).map((g) => ({ groupe: g, libelle: libelle(g), series: volume[g] }))
  const resultats: (SuggestionSeance & { score: number })[] = []
  for (const [seanceId, gs] of groupesParSeance) {
    const touches = gs.filter(enRetard)
    const score = touches.reduce((t, g) => t + (1 - volume[g] / max), 0)
    if (score <= 0) continue
    const tries = [...touches].sort((a, b) => volume[a] - volume[b])
    const retard = tries.map((g) => ({ groupe: g, libelle: libelle(g), series: volume[g] }))
    const deux = retard.slice(0, 2)
    const memeNombre = deux.length === 2 && deux[0].series === deux[1].series
    const chiffres = memeNombre ? `${deux[0].series} séries chacun` : deux.map((d) => d.series).join(' et ') + ' séries'
    const top = plusTravailles[0]
    resultats.push({
      seanceId, enRetard: retard, plusTravailles, score,
      explication: `${joindre(deux.map((d, i) => (i === 0 ? d.libelle : d.libelle.toLowerCase())))} ${deux.length > 1 ? 'sont les moins travaillés' : 'est le moins travaillé'} ces deux semaines (${chiffres}${top ? ` contre ${top.series} pour ${top.libelle.toLowerCase()}` : ''}).`,
    })
  }
  return resultats.sort((a, b) => b.score - a.score || a.seanceId.localeCompare(b.seanceId)).map((r) => ({ seanceId: r.seanceId, enRetard: r.enRetard, plusTravailles: r.plusTravailles, explication: r.explication }))
}

// ── Charge de la semaine ─────────────────────────────────────────────────────────────────────────────────────

export interface AlerteCharge {
  /** Hausse du tonnage des 7 derniers jours sur la moyenne des quatre blocs de 7 jours précédents, en pourcents. */
  pourcentage: number
}

const SEUIL_ALERTE = 1.3

/**
 * Alerte quand les 7 derniers jours dépassent de 30 % ou plus la moyenne des blocs précédents. Au moins deux blocs précédents
 * avec du tonnage : sinon la « moyenne » ne signifierait rien (reprise, début d'utilisation).
 */
export function alerteCharge(blocs: readonly BlocTonnage[]): AlerteCharge | null {
  if (blocs.length < 3) return null
  const courant = blocs[blocs.length - 1]
  const precedents = blocs.slice(0, -1)
  if (precedents.filter((b) => b.tonnageKg > 0).length < 2) return null
  const moyenne = precedents.reduce((t, b) => t + b.tonnageKg, 0) / precedents.length
  if (moyenne <= 0 || courant.tonnageKg < SEUIL_ALERTE * moyenne) return null
  return { pourcentage: Math.round((courant.tonnageKg / moyenne - 1) * 100) }
}

// ── Dernière fois et tendance ────────────────────────────────────────────────────────────────────────────────

export interface ResumeSeanceType {
  /** Jour de la dernière séance terminée de ce modèle. */
  derniere: string
  /** Écart de tonnage avec l'avant-dernière, en pourcents ; null s'il n'y en a pas ou si l'un des deux est à zéro. */
  tendance: number | null
}

export function resumesParSeance(instances: readonly ResumeInstanceJouee[]): Map<string, ResumeSeanceType> {
  const parSeance = new Map<string, ResumeInstanceJouee[]>()
  for (const i of [...instances].sort((a, b) => b.date.localeCompare(a.date) || b.instanceId.localeCompare(a.instanceId))) {
    parSeance.set(i.seanceId, [...(parSeance.get(i.seanceId) ?? []), i])
  }
  const resumes = new Map<string, ResumeSeanceType>()
  for (const [seanceId, liste] of parSeance) {
    const [dernier, avant] = liste
    const tendance = avant && dernier.tonnageKg > 0 && avant.tonnageKg > 0 ? Math.round((dernier.tonnageKg / avant.tonnageKg - 1) * 100) : null
    resumes.set(seanceId, { derniere: dernier.date, tendance })
  }
  return resumes
}

/** « Aujourd'hui », « Hier », « il y a 4 jours ». */
export function libelleDernierePratique(dateIso: string, aujourdhuiIso: string): string {
  if (dateIso >= aujourdhuiIso) return 'Aujourd’hui'
  if (dateIso === ajouterJours(aujourdhuiIso, -1)) return 'Hier'
  const jours = Math.round((Date.UTC(+aujourdhuiIso.slice(0, 4), +aujourdhuiIso.slice(5, 7) - 1, +aujourdhuiIso.slice(8, 10)) - Date.UTC(+dateIso.slice(0, 4), +dateIso.slice(5, 7) - 1, +dateIso.slice(8, 10))) / 86_400_000)
  return `il y a ${jours} jours`
}

// ── Échauffement ─────────────────────────────────────────────────────────────────────────────────────────────

const ZONES_PAR_GROUPE: Record<MuscleGroup, ZoneCorps[]> = {
  PECTORAUX: ['poitrine', 'epaules'],
  DOS: ['haut_dos', 'bas_dos'],
  TRAPEZES: ['cou', 'haut_dos'],
  LOMBAIRES: ['bas_dos'],
  EPAULES: ['epaules', 'haut_dos'],
  BICEPS: ['epaules'],
  TRICEPS: ['epaules'],
  QUADRICEPS: ['quadriceps', 'hanches'],
  ISCHIO: ['ischios', 'hanches'],
  FESSIERS: ['fessiers', 'hanches'],
  ADDUCTEURS: ['adducteurs', 'hanches'],
  MOLLETS: ['mollets', 'chevilles'],
  ABDOMINAUX: ['bas_dos'],
  OBLIQUES: ['bas_dos'],
  AVANT_BRAS: ['epaules'],
  AUTRE: [],
}

/** Zones de mobilité à échauffer pour des groupes musculaires : dans l'ordre du corps, `max` au plus (les plus fréquentes d'abord). */
export function zonesEchauffement(groupes: readonly MuscleGroup[], max = 5): ZoneCorps[] {
  const compte = new Map<ZoneCorps, number>()
  for (const g of groupes) for (const z of ZONES_PAR_GROUPE[g]) compte.set(z, (compte.get(z) ?? 0) + 1)
  return [...compte.entries()]
    .sort((a, b) => b[1] - a[1] || rangZone(a[0]) - rangZone(b[0]))
    .slice(0, max)
    .map(([z]) => z)
    .sort((a, b) => rangZone(a) - rangZone(b))
}
