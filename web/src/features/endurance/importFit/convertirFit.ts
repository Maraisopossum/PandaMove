import { dateIsoLocale } from '../../../core/common/dates'
import { LIMITES_SORTIE, TITRE_PAR_DEFAUT, type SaisieSortie, type SourceSortie, type Sport } from '../../../core/db/repos/sorties'

// Conversion d'une activité FIT déjà décodée (objet produit par fit-file-parser) en saisie de sortie. Fonction pure, sans
// accès au fichier ni à la base : le décodage binaire est dans lireFichier.ts. Les trois sources diffèrent :
//   - Suunto (course) : session complète (FC, puissance, cadence en foulées par minute), tours au kilomètre ;
//   - Garmin (vélo de route) : session sans vitesse ni FC moyennes, parfois sans capteur de FC ni de puissance ;
//   - MyWoosh (vélo virtuel) : capteurs complets mais GPS fictif (parcours du jeu), donc sortie « en salle » sans tracé.

export interface EnregistrementFit {
  timestamp?: Date | string
  position_lat?: number
  position_long?: number
  distance?: number
  heart_rate?: number
  power?: number
  cadence?: number
  speed?: number
  enhanced_speed?: number
  altitude?: number
  enhanced_altitude?: number
}

export interface TourFit {
  total_distance?: number
  total_timer_time?: number
  avg_heart_rate?: number
}

export interface SessionFit {
  sport?: string
  sub_sport?: string
  start_time?: Date | string
  total_elapsed_time?: number
  total_timer_time?: number
  total_distance?: number
  total_ascent?: number
  total_descent?: number
  avg_heart_rate?: number
  max_heart_rate?: number
  avg_power?: number
  max_power?: number
  normalized_power?: number
  avg_cadence?: number
}

export interface ActiviteFit {
  file_ids?: { manufacturer?: string; time_created?: Date | string }[]
  sessions?: SessionFit[]
  laps?: TourFit[]
  records?: EnregistrementFit[]
}

export class ErreurImportFit extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ErreurImportFit'
  }
}

const SPORTS: Record<string, Sport> = { running: 'course', cycling: 'velo' }
const SOUS_SPORTS_EN_SALLE = new Set(['virtual_activity', 'indoor_cycling', 'treadmill', 'indoor_running', 'spin'])
const MAX_POINTS = 300

const instant = (v: Date | string | undefined): Date | null => {
  if (v === undefined) return null
  const d = v instanceof Date ? v : new Date(v)
  return Number.isNaN(d.getTime()) ? null : d
}
const fini = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const arrondi = (v: number | undefined, max: number): number | null => (fini(v) && v >= 0 && v <= max ? Math.round(v) : null)

// n éléments au plus, régulièrement espacés (premier et dernier conservés).
export function reduire<T>(liste: T[], n: number): T[] {
  if (liste.length <= n) return liste
  const pas = (liste.length - 1) / (n - 1)
  return Array.from({ length: n }, (_, i) => liste[Math.round(i * pas)])
}

const moyenne = (valeurs: number[]): number | null => (valeurs.length === 0 ? null : valeurs.reduce((a, b) => a + b, 0) / valeurs.length)

function sourceDe(fabricant: string | undefined): SourceSortie {
  const f = (fabricant ?? '').toLowerCase()
  if (f === 'mywhoosh') return 'mywoosh'
  if (f === 'suunto' || f === 'garmin') return f
  return 'manuel'
}

export function convertirActiviteFit(fit: ActiviteFit): SaisieSortie {
  const session = fit.sessions?.[0]
  if (!session) throw new ErreurImportFit("Ce fichier ne contient pas d'activité (session absente).")
  const sport = SPORTS[session.sport ?? '']
  if (!sport) throw new ErreurImportFit(`Sport « ${session.sport ?? 'inconnu'} » non pris en charge (course à pied et vélo seulement).`)
  const debut = instant(session.start_time) ?? instant(fit.file_ids?.[0]?.time_created)
  if (!debut) throw new ErreurImportFit('Date de départ introuvable dans le fichier.')

  const enregistrements = fit.records ?? []
  const source = sourceDe(fit.file_ids?.[0]?.manufacturer)
  const avecGps = enregistrements.filter((r) => fini(r.position_lat) && fini(r.position_long))
  const enSalle = SOUS_SPORTS_EN_SALLE.has(session.sub_sport ?? '') || source === 'mywoosh' || avecGps.length < 2

  // Fréquence cardiaque : session, sinon calculée sur les points (absente sans cardiofréquencemètre).
  const fcPoints = enregistrements.map((r) => r.heart_rate).filter((v): v is number => fini(v) && v >= LIMITES_SORTIE.fc.min && v <= LIMITES_SORTIE.fc.max)
  const fcMoy = arrondi(session.avg_heart_rate, LIMITES_SORTIE.fc.max) ?? (fcPoints.length ? Math.round(moyenne(fcPoints) as number) : null)
  const fcMax = arrondi(session.max_heart_rate, LIMITES_SORTIE.fc.max) ?? (fcPoints.length ? Math.max(...fcPoints) : null)

  // Puissance : session, sinon moyenne des points (zéros compris) si un capteur existe.
  const wattsPoints = enregistrements.map((r) => r.power).filter(fini)
  const aPuissance = wattsPoints.some((w) => w > 0)
  const puissanceMoyW = arrondi(session.avg_power, LIMITES_SORTIE.puissanceMoyW) ?? (aPuissance ? Math.round(moyenne(wattsPoints) as number) : null)
  const puissanceMaxW = arrondi(session.max_power, LIMITES_SORTIE.puissanceMaxW) ?? (aPuissance ? Math.max(...wattsPoints) : null)

  // Cadence : en course, le FIT donne des foulées par minute (un pied) : on double pour obtenir des pas par minute.
  const facteurCadence = sport === 'course' ? 2 : 1
  const cadencePoints = enregistrements.map((r) => r.cadence).filter((v): v is number => fini(v) && v > 0)
  const cadenceBrute = fini(session.avg_cadence) && session.avg_cadence > 0 ? session.avg_cadence : moyenne(cadencePoints)
  const cadenceMoy = cadenceBrute === null ? null : arrondi(cadenceBrute * facteurCadence, LIMITES_SORTIE.cadence)

  const dernier = enregistrements[enregistrements.length - 1]
  const dureeS = fini(session.total_elapsed_time) ? Math.round(session.total_elapsed_time) : null
  const deplacement = fini(session.total_timer_time) ? Math.round(session.total_timer_time) : null
  const distance = fini(session.total_distance) ? session.total_distance : fini(dernier?.distance) ? dernier.distance : null

  return {
    sport,
    date: dateIsoLocale(debut),
    debutAt: debut.toISOString(),
    titre: enSalle ? `${TITRE_PAR_DEFAUT[sport]} en salle` : TITRE_PAR_DEFAUT[sport],
    dureeS,
    dureeDeplacementS: dureeS !== null && deplacement !== null ? Math.min(deplacement, dureeS) : deplacement,
    distanceM: distance !== null ? Math.round(distance) : null,
    denivelePosM: arrondi(session.total_ascent, LIMITES_SORTIE.deniveleM),
    deniveleNegM: arrondi(session.total_descent, LIMITES_SORTIE.deniveleM),
    fcMoy,
    fcMax: fcMoy !== null && fcMax !== null && fcMax < fcMoy ? fcMoy : fcMax,
    puissanceMoyW,
    puissanceMaxW,
    puissanceNormW: arrondi(session.normalized_power, LIMITES_SORTIE.puissanceNormW),
    cadenceMoy,
    enSalle,
    source,
    empreinte: `${sport}|${debut.toISOString()}|${dureeS ?? 0}`,
    tours: JSON.stringify(toursDe(fit.laps ?? [])),
    serie: JSON.stringify(serieDe(enregistrements, debut)),
    trace: enSalle ? null : JSON.stringify(reduire(avecGps, MAX_POINTS).map((r) => [Number((r.position_lat as number).toFixed(5)), Number((r.position_long as number).toFixed(5))])),
  }
}

// Tours (au kilomètre chez Suunto, aux 5 km chez Garmin) : distance, durée et FC moyenne.
function toursDe(tours: TourFit[]) {
  return tours
    .filter((t) => fini(t.total_distance) && fini(t.total_timer_time))
    .map((t) => ({ distanceM: Math.round(t.total_distance as number), dureeS: Math.round(t.total_timer_time as number), fcMoy: fini(t.avg_heart_rate) ? Math.round(t.avg_heart_rate) : null }))
}

// Échantillons réduits : t (s depuis le départ), fc, w (watts), v (m/s), a (altitude, m), c (cadence brute).
function serieDe(enregistrements: EnregistrementFit[], debut: Date) {
  return reduire(enregistrements, MAX_POINTS).map((r) => {
    const t = instant(r.timestamp)
    const vitesse = r.enhanced_speed ?? r.speed
    const altitude = r.enhanced_altitude ?? r.altitude
    return {
      t: t ? Math.round((t.getTime() - debut.getTime()) / 1000) : null,
      fc: fini(r.heart_rate) && r.heart_rate > 0 ? Math.round(r.heart_rate) : null,
      w: fini(r.power) ? Math.round(r.power) : null,
      v: fini(vitesse) ? Number(vitesse.toFixed(2)) : null,
      a: fini(altitude) ? Number(altitude.toFixed(1)) : null,
      c: fini(r.cadence) ? Math.round(r.cadence) : null,
    }
  })
}
