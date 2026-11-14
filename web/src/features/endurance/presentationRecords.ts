import type { Sport } from '../../core/db/repos/sorties'
import { formaterDuree } from './presentation'
import type { AutreRecord, RecordsSport } from './recordsSorties'

const FORMAT_KM = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 })

export interface LigneRecord {
  id: string
  libelle: string
  valeur: string
  date: string
  /** Sortie qui détient le record (lien) ; absent pour un record de semaine. */
  sortieId?: string
}

/** Valeur lisible d'un « autre record » : distance, durée ou dénivelé selon l'id. */
export function valeurAutre(a: AutreRecord): string {
  if (a.id === 'plus-longue' || a.id === 'meilleure-semaine') return `${FORMAT_KM.format(a.valeur / 1000)} km`
  if (a.id === 'plus-longue-duree') return formaterDuree(a.valeur)
  return `${Math.round(a.valeur)} m`
}

/** Records à mettre en avant pour un sport : trois au plus, ceux de l'analyse détaillée d'abord, sinon les records de base. */
export function recordsEnAvant(sport: Sport, records: RecordsSport): LigneRecord[] {
  const analyses: LigneRecord[] =
    sport === 'course'
      ? records.distances.flatMap(({ definition, record }) =>
          record && ['5k', '10k', 'semi'].includes(definition.id) ? [{ id: definition.id, libelle: definition.libelle, valeur: formaterDuree(record.dureeS), date: record.date, sortieId: record.sortieId }] : [],
        )
      : records.efforts.flatMap(({ definition, record }) =>
          record && ['5min', '20min', '60min'].includes(definition.id) ? [{ id: definition.id, libelle: definition.libelle, valeur: `${record.watts} W`, date: record.date, sortieId: record.sortieId }] : [],
        )
  if (analyses.length > 0) return analyses.slice(0, 3)
  return records.autres
    .filter((a) => a.id !== 'meilleure-semaine')
    .slice(0, 3)
    .map((a) => ({ id: a.id, libelle: a.nom, valeur: valeurAutre(a), date: a.date }))
}

export interface CourbeEvolution {
  largeur: number
  hauteur: number
  points: { x: number; y: number; dateIso: string; dureeS: number; mois: string }[]
  polyligne: string
  graduationsY: { y: number; libelle: string }[]
  graduationsX: { x: number; libelle: string }[]
  zone: { gauche: number; droite: number; haut: number; bas: number }
}

const ZONE = { gauche: 44, droite: 12, haut: 16, bas: 124 }
const PAS_POSSIBLES = [10, 15, 30, 60, 120, 300, 600]
const MOIS_COURTS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']

/**
 * Courbe d'évolution du meilleur temps (un point par mois) : le plus lent en haut, le meilleur en bas, avec des graduations rondes
 * (10 s à 10 min d'écart). null avec moins de deux points : une courbe d'un seul point n'apprend rien.
 */
export function courbeEvolution(points: { mois: string; dureeS: number }[]): CourbeEvolution | null {
  if (points.length < 2) return null
  const valeurs = points.map((p) => p.dureeS)
  const [min, max] = [Math.min(...valeurs), Math.max(...valeurs)]
  const pas = PAS_POSSIBLES.find((p) => (max - min) / p <= 4) ?? PAS_POSSIBLES[PAS_POSSIBLES.length - 1]
  const bas = Math.floor(min / pas) * pas
  const haut = Math.max(Math.ceil(max / pas) * pas, bas + pas)
  // Le temps le plus long en haut, le plus court (le meilleur) en bas
  const y = (v: number) => Math.round((ZONE.bas - ((v - bas) / (haut - bas)) * (ZONE.bas - ZONE.haut)) * 10) / 10
  const largeur = 330
  const pasX = (largeur - ZONE.gauche - ZONE.droite - 12) / (points.length - 1)
  const pts = points.map((p, i) => ({ x: Math.round((ZONE.gauche + 6 + i * pasX) * 10) / 10, y: y(p.dureeS), dateIso: p.mois, dureeS: p.dureeS, mois: MOIS_COURTS[Number(p.mois.slice(5, 7)) - 1] }))
  const graduationsY: CourbeEvolution['graduationsY'] = []
  for (let v = bas; v <= haut; v += pas) graduationsY.push({ y: y(v), libelle: formaterDuree(v) })
  return {
    largeur, hauteur: 150, points: pts, polyligne: pts.map((p) => `${p.x},${p.y}`).join(' '), graduationsY,
    graduationsX: pts.map((p) => ({ x: p.x, libelle: p.mois })), zone: ZONE,
  }
}

/** « Nouveau » pour un record de moins de 14 jours, sinon « il y a N j ». */
export function ancienneteRecord(dateIso: string, aujourdhuiIso: string): { texte: string; recent: boolean } {
  const jours = Math.round((Date.UTC(+aujourdhuiIso.slice(0, 4), +aujourdhuiIso.slice(5, 7) - 1, +aujourdhuiIso.slice(8, 10)) - Date.UTC(+dateIso.slice(0, 4), +dateIso.slice(5, 7) - 1, +dateIso.slice(8, 10))) / 86_400_000)
  return jours <= 14 ? { texte: 'Nouveau', recent: true } : { texte: `il y a ${jours} j`, recent: false }
}
