import { ecart, type Ecart } from '../../core/common/ecart'
import type { DbLecture } from '../../core/db/Db'
import { ajouterJours } from '../endurance/calculCharge'
import { lireEvenementsPlage } from '../calendar/calendrier'
import { formaterTonnage } from '../stats/presentation'
import { tonnagePeriode } from '../stats/statsQueries'
import { lundiDe } from './semaine'

// Bilan chiffré de la semaine à l'accueil : séances terminées, temps de sport, distance (course et vélo) et tonnage de
// renforcement. Comparé au MÊME point de la semaine précédente (du lundi à ce même jour) : comparer trois jours de
// semaine à sept jours pleins afficherait une baisse permanente en début de semaine.

export interface Bilan {
  terminees: number
  dureeS: number
  distanceM: number
  tonnageKg: number
}

export interface FenetreBilan {
  debut: string
  fin: string
}

export function fenetresBilan(aujourdhuiIso: string): { courante: FenetreBilan; precedente: FenetreBilan } {
  const debut = lundiDe(aujourdhuiIso)
  return {
    courante: { debut, fin: aujourdhuiIso },
    precedente: { debut: ajouterJours(debut, -7), fin: ajouterJours(aujourdhuiIso, -7) },
  }
}

export async function lireBilan(db: DbLecture, { debut, fin }: FenetreBilan): Promise<Bilan> {
  const [evenements, sorties, renfo, tonnageKg] = await Promise.all([
    lireEvenementsPlage(db, debut, fin),
    db.get<{ duree: number | null; distance: number | null }>(
      'SELECT SUM(duree_s) AS duree, SUM(distance_m) AS distance FROM sorties WHERE deleted_at IS NULL AND date BETWEEN ? AND ?',
      [debut, fin],
    ),
    db.get<{ duree: number | null }>(
      'SELECT SUM(duration_seconds) AS duree FROM instances_seance WHERE is_completed = 1 AND deleted_at IS NULL AND date BETWEEN ? AND ?',
      [debut, fin],
    ),
    tonnagePeriode(db, debut, fin),
  ])
  return {
    terminees: evenements.filter((e) => e.etat === 'terminee').length,
    dureeS: (sorties.duree ?? 0) + (renfo.duree ?? 0),
    distanceM: sorties.distance ?? 0,
    tonnageKg,
  }
}

export { ecart, type Ecart, type SensEcart } from '../../core/common/ecart'

export interface Indicateur {
  id: 'seances' | 'duree' | 'distance' | 'tonnage'
  valeur: string
  libelle: string
  ecart: Ecart
}

const FORMAT_UN = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 })

// 19 200 s -> « 5 h 20 » ; 2 100 s -> « 35 min » ; 0 -> « 0 min »
export function duree(secondes: number): string {
  const minutes = Math.round(secondes / 60)
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, '0')}`
}
const km = (metres: number) => `${FORMAT_UN.format(metres / 1000)} km`
const kg = (x: number) => (x >= 1000 ? `${FORMAT_UN.format(x / 1000)} t` : formaterTonnage(x))

export function indicateursBilan(c: Bilan, p: Bilan, totalPrevu: number): Indicateur[] {
  return [
    {
      id: 'seances',
      valeur: totalPrevu > c.terminees ? `${c.terminees} sur ${totalPrevu}` : String(c.terminees),
      libelle: c.terminees > 1 ? 'séances terminées' : 'séance terminée',
      ecart: ecart(c.terminees, p.terminees, (n) => String(n)),
    },
    { id: 'duree', valeur: duree(c.dureeS), libelle: 'de sport', ecart: ecart(c.dureeS, p.dureeS, duree) },
    { id: 'distance', valeur: km(c.distanceM), libelle: 'course et vélo', ecart: ecart(c.distanceM, p.distanceM, km) },
    { id: 'tonnage', valeur: kg(c.tonnageKg), libelle: 'tonnage', ecart: ecart(c.tonnageKg, p.tonnageKg, kg) },
  ]
}
