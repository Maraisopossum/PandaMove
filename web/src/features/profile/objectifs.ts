import { dateIsoLocale } from '../../core/common/dates'
import type { DbLecture } from '../../core/db/Db'
import { lireSeancesMobilite } from '../../core/db/repos/mobilite'
import { lireSeancesDepuis } from '../../core/db/repos/respiration'
import { lireSorties, type Sport } from '../../core/db/repos/sorties'
import { lireEvenementsPlage } from '../calendar/calendrier'
import { ajouterJours } from '../endurance/calculCharge'
import { lireObjectif } from '../endurance/objectif'
import { bilanHebdo, joursRestants } from '../endurance/recordsSorties'
import { lundiDe } from '../home/semaine'
import { lireObjectifQuotidien } from '../respiration/reglages'
import { bilanSemaine as bilanRespiration } from '../respiration/statsRespiration'

// Objectifs personnels : réglages d'appareil (localStorage), jamais synchronisés. Trois sont propres à cet écran (séances par
// semaine, distance de l'année, séances de mobilité par semaine) ; les autres existent déjà dans leur module et sont seulement
// rassemblés ici : distance hebdomadaire de course et de vélo, objectif quotidien de respiration. Toute lecture tolère un
// stockage absent ou corrompu.

export const CLE_OBJECTIFS = 'pandamove.objectifs'

export interface ObjectifsPerso {
  /** Séances terminées par semaine (tous modules de l'agenda), 1 à 14. */
  seancesSemaine: number | null
  /** Distance course et vélo de l'année civile, en kilomètres, 10 à 20 000. */
  distanceAnnee: number | null
  /** Séances de mobilité par semaine, 1 à 14. */
  mobiliteSemaine: number | null
}

export const LIMITES_OBJECTIFS = { seancesSemaine: [1, 14], distanceAnnee: [10, 20_000], mobiliteSemaine: [1, 14] } as const

const entierDans = (v: unknown, [min, max]: readonly [number, number]): number | null =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max ? v : null

export function lireObjectifsPerso(): ObjectifsPerso {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(CLE_OBJECTIFS) ?? 'null')
    const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>
    return {
      seancesSemaine: entierDans(o.seancesSemaine, LIMITES_OBJECTIFS.seancesSemaine),
      distanceAnnee: entierDans(o.distanceAnnee, LIMITES_OBJECTIFS.distanceAnnee),
      mobiliteSemaine: entierDans(o.mobiliteSemaine, LIMITES_OBJECTIFS.mobiliteSemaine),
    }
  } catch {
    return { seancesSemaine: null, distanceAnnee: null, mobiliteSemaine: null }
  }
}

/** Retient les objectifs ; une valeur hors limites est refusée (renvoie false, rien n'est écrit). `null` retire un objectif. */
export function ecrireObjectifsPerso(o: ObjectifsPerso): boolean {
  for (const cle of Object.keys(LIMITES_OBJECTIFS) as (keyof ObjectifsPerso)[]) {
    if (o[cle] !== null && entierDans(o[cle], LIMITES_OBJECTIFS[cle]) === null) return false
  }
  try {
    localStorage.setItem(CLE_OBJECTIFS, JSON.stringify(o))
  } catch {
    // Stockage indisponible : les objectifs valent pour la session seulement
  }
  return true
}

export type IdObjectif = 'seances' | 'course' | 'velo' | 'distance-annee' | 'mobilite' | 'respiration'

export interface ProgressionObjectif {
  id: IdObjectif
  nom: string
  /** Pastille du menu (public/icons/menu/<icone>.webp). */
  icone: string
  /** « 3 sur 4 », « 16 sur 35 km ». */
  valeur: string
  /** Avancement, 0 à 100 (plafonné). */
  pct: number
  detail: string
  atteint: boolean
}

const FORMAT = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 })
const km = (m: number) => `${FORMAT.format(m / 1000)}`
const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`
const pct = (v: number, cible: number) => Math.max(0, Math.min(100, Math.round((v / cible) * 100)))

function resteSemaine(aujourdhui: string): string {
  const j = joursRestants(aujourdhui)
  return j === 0 ? 'dernier jour de la semaine' : `il reste ${pluriel(j, 'jour')}`
}

/**
 * Avancement de chaque objectif défini, d'après les données locales. L'ordre est celui de l'écran : séances, course, vélo, distance
 * de l'année, mobilité, respiration. Respiration n'apparaît qu'après une première séance (son objectif quotidien existe toujours).
 */
export async function lireProgressionObjectifs(db: DbLecture, maintenant: Date, perso: ObjectifsPerso = lireObjectifsPerso()): Promise<ProgressionObjectif[]> {
  const aujourdhui = dateIsoLocale(maintenant)
  const debutSemaine = lundiDe(aujourdhui)
  const finSemaine = ajouterJours(debutSemaine, 6)
  const [evenements, sorties, mobilite, respiration] = await Promise.all([
    perso.seancesSemaine !== null ? lireEvenementsPlage(db, debutSemaine, finSemaine) : Promise.resolve([]),
    lireSorties(db),
    perso.mobiliteSemaine !== null ? lireSeancesMobilite(db) : Promise.resolve([]),
    lireSeancesDepuis(db, '0000-01-01'),
  ])
  const liste: ProgressionObjectif[] = []

  if (perso.seancesSemaine !== null) {
    const n = evenements.filter((e) => e.etat === 'terminee').length
    const cible = perso.seancesSemaine
    liste.push({
      id: 'seances', nom: 'Séances par semaine', icone: 'halteres', valeur: `${n} sur ${cible}`, pct: pct(n, cible), atteint: n >= cible,
      detail: n >= cible ? 'Objectif atteint cette semaine.' : `Il reste ${pluriel(cible - n, 'séance')} d’ici dimanche.`,
    })
  }

  for (const sport of ['course', 'velo'] as Sport[]) {
    const cible = lireObjectif(sport)
    if (cible === null) continue
    const b = bilanHebdo(sorties, sport, aujourdhui)
    const reste = Math.max(0, cible * 1000 - b.distanceM)
    liste.push({
      id: sport, nom: sport === 'course' ? 'Course, cette semaine' : 'Vélo, cette semaine', icone: sport, valeur: `${km(b.distanceM)} sur ${FORMAT.format(cible)} km`,
      pct: pct(b.distanceM, cible * 1000), atteint: reste === 0,
      detail: reste === 0 ? 'Objectif atteint cette semaine.' : `Encore ${km(reste)} km, ${resteSemaine(aujourdhui)}.`,
    })
  }

  if (perso.distanceAnnee !== null) {
    const annee = aujourdhui.slice(0, 4)
    const parcouru = sorties.filter((s) => s.date.startsWith(annee)).reduce((t, s) => t + (s.distanceM ?? 0), 0)
    const cible = perso.distanceAnnee
    const joursEcoules = Math.max(1, Math.round((Date.UTC(+aujourdhui.slice(0, 4), +aujourdhui.slice(5, 7) - 1, +aujourdhui.slice(8, 10)) - Date.UTC(+annee, 0, 0)) / 86_400_000))
    const projection = (parcouru / 1000 / joursEcoules) * 365
    liste.push({
      id: 'distance-annee', nom: 'Distance de l’année', icone: 'velo', valeur: `${FORMAT.format(Math.round(parcouru / 1000))} sur ${FORMAT.format(cible)} km`,
      pct: pct(parcouru, cible * 1000), atteint: parcouru >= cible * 1000,
      detail: parcouru >= cible * 1000 ? 'Objectif de l’année atteint.' : `Au rythme actuel : ${FORMAT.format(Math.round(projection))} km au 31 décembre.`,
    })
  }

  if (perso.mobiliteSemaine !== null) {
    const n = mobilite.filter((s) => s.date >= debutSemaine && s.date <= finSemaine).length
    const cible = perso.mobiliteSemaine
    liste.push({
      id: 'mobilite', nom: 'Mobilité', icone: 'mobilite', valeur: `${n} sur ${cible} séance${cible > 1 ? 's' : ''}`, pct: pct(n, cible), atteint: n >= cible,
      detail: n >= cible ? 'Objectif atteint cette semaine.' : `Il reste ${pluriel(cible - n, 'séance')}, ${resteSemaine(aujourdhui)}.`,
    })
  }

  if (respiration.length > 0) {
    const objectif = lireObjectifQuotidien()
    const atteints = bilanRespiration(respiration, aujourdhui, objectif).joursAtteints
    liste.push({
      id: 'respiration', nom: 'Respiration', icone: 'souffle', valeur: `${atteints} sur 7 jours`, pct: pct(atteints, 7), atteint: atteints >= 7,
      detail: `Objectif quotidien : ${objectif} min.`,
    })
  }
  return liste
}
