import type { Sortie, Sport } from '../../core/db/repos/sorties'
import { dateIsoLocale } from '../../core/common/dates'
import { bornesPeriode, type PeriodeId } from '../stats/periode'
import { lundiDe } from '../home/semaine'

// Statistiques d'un sport sur une période, pour l'écran Statistiques. Fonctions pures sur les sorties déjà lues.

export interface RecordsEndurance {
  plusLongue: { distanceM: number; date: string } | null
  /** Sortie la plus longue en durée. */
  plusLongueDuree: { dureeS: number; date: string } | null
  /** Course : meilleure allure (secondes par km) sur une sortie d'au moins 3 km. */
  meilleureAllure: { secParKm: number; date: string } | null
  /** Vélo : meilleure vitesse moyenne (km/h) sur une sortie d'au moins 10 km. */
  meilleureVitesse: { kmh: number; date: string } | null
  /** Plus gros dénivelé positif sur une sortie. */
  plusGrandDenivele: { m: number; date: string } | null
}

export interface StatsEndurance {
  sport: Sport
  nombre: number
  distanceM: number
  dureeS: number
  denivelePosM: number
  /** Allure globale (course, s/km) ou vitesse globale (vélo, km/h) : distance totale sur durée totale. */
  rythmeGlobal: number | null
  fcMoy: number | null
  puissanceMoyW: number | null
  /** Sorties par semaine, sur la durée couverte (de la première sortie à aujourd'hui, 1 semaine au moins). */
  parSemaine: number
  /** Distance par mois (yyyy-MM), les 12 derniers mois au plus, mois vides compris. */
  mois: { mois: string; distanceM: number; sorties: number }[]
  /** Sorties par jour de la semaine, lundi en premier. */
  parJour: number[]
  records: RecordsEndurance
}

const arr = (n: number) => Math.round(n)

function plusGrand<T>(liste: T[], valeur: (x: T) => number | null): T | null {
  let meilleur: T | null = null
  let v0 = -Infinity
  for (const x of liste) {
    const v = valeur(x)
    if (v !== null && v > v0) {
      v0 = v
      meilleur = x
    }
  }
  return meilleur
}

export function calculerStatsEndurance(sorties: Sortie[], sport: Sport, periode: PeriodeId, maintenant: Date): StatsEndurance {
  const { from, to } = bornesPeriode(periode, maintenant)
  const dans = sorties.filter((s) => s.sport === sport && s.date >= from && s.date <= to)
  const somme = (f: (s: Sortie) => number | null) => dans.reduce((t, s) => t + (f(s) ?? 0), 0)
  const distanceM = somme((s) => s.distanceM)
  // Le rythme global ne compte que les sorties qui ont distance ET durée (sinon il serait faussé)
  const completes = dans.filter((s) => s.distanceM && s.dureeS)
  const dComp = completes.reduce((t, s) => t + (s.distanceM as number), 0)
  const tComp = completes.reduce((t, s) => t + (s.dureeS as number), 0)
  const rythmeGlobal = dComp > 0 && tComp > 0 ? (sport === 'course' ? tComp / (dComp / 1000) : dComp / 1000 / (tComp / 3600)) : null
  const fcs = dans.map((s) => s.fcMoy).filter((v): v is number => v !== null)
  const watts = dans.map((s) => s.puissanceMoyW).filter((v): v is number => v !== null)

  const aujourdhui = dateIsoLocale(maintenant)
  const premiere = dans.length ? dans.reduce((m, s) => (s.date < m ? s.date : m), dans[0].date) : aujourdhui
  const semaines = Math.max(1, (Date.parse(`${lundiDe(aujourdhui)}T00:00:00Z`) - Date.parse(`${lundiDe(premiere)}T00:00:00Z`)) / (7 * 86_400_000) + 1)

  // Douze derniers mois au plus
  const [a, m] = [maintenant.getFullYear(), maintenant.getMonth()]
  const nbMois = periode === 'tout' || periode === '12m' ? 12 : periode === '3m' ? 3 : periode === '30j' ? 2 : 1
  const mois = Array.from({ length: nbMois }, (_, i) => {
    const d = new Date(a, m - (nbMois - 1 - i), 1)
    const cle = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const duMois = dans.filter((s) => s.date.startsWith(cle))
    return { mois: cle, distanceM: duMois.reduce((t, s) => t + (s.distanceM ?? 0), 0), sorties: duMois.length }
  })

  const parJour = Array.from({ length: 7 }, () => 0)
  for (const s of dans) parJour[(new Date(`${s.date}T00:00:00Z`).getUTCDay() + 6) % 7] += 1

  const longue = plusGrand(dans, (s) => s.distanceM)
  const duree = plusGrand(dans, (s) => s.dureeS)
  const deniv = plusGrand(dans, (s) => s.denivelePosM)
  const allure = sport === 'course' ? plusGrand(dans.filter((s) => (s.distanceM ?? 0) >= 3000 && s.dureeS), (s) => -((s.dureeS as number) / ((s.distanceM as number) / 1000))) : null
  const vitesse = sport === 'velo' ? plusGrand(dans.filter((s) => (s.distanceM ?? 0) >= 10_000 && s.dureeS), (s) => (s.distanceM as number) / 1000 / ((s.dureeS as number) / 3600)) : null

  return {
    sport,
    nombre: dans.length,
    distanceM,
    dureeS: somme((s) => s.dureeS),
    denivelePosM: somme((s) => s.denivelePosM),
    rythmeGlobal,
    fcMoy: fcs.length ? arr(fcs.reduce((x, y) => x + y, 0) / fcs.length) : null,
    puissanceMoyW: watts.length ? arr(watts.reduce((x, y) => x + y, 0) / watts.length) : null,
    parSemaine: Math.round((dans.length / semaines) * 10) / 10,
    mois,
    parJour,
    records: {
      plusLongue: longue ? { distanceM: longue.distanceM as number, date: longue.date } : null,
      plusLongueDuree: duree ? { dureeS: duree.dureeS as number, date: duree.date } : null,
      meilleureAllure: allure ? { secParKm: (allure.dureeS as number) / ((allure.distanceM as number) / 1000), date: allure.date } : null,
      meilleureVitesse: vitesse ? { kmh: (vitesse.distanceM as number) / 1000 / ((vitesse.dureeS as number) / 3600), date: vitesse.date } : null,
      plusGrandDenivele: deniv && (deniv.denivelePosM ?? 0) > 0 ? { m: arr(deniv.denivelePosM as number), date: deniv.date } : null,
    },
  }
}
