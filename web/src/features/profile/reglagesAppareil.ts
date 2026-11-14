import { CLE_EXERCICE_DEFAUT, lireExerciceDefaut } from '../stats/exerciceDefaut'
import { CLE_PERIODE, PERIODES, lirePeriode } from '../stats/periode'
import { CLE_FAVORITE, lireFavorite } from '../respiration/reglages'
import { METHODES_INTEGREES } from '../respiration/methodes'
import { CLE_REGLAGES_CHARGE, lireReglagesCharge } from '../endurance/useChargeEntrainement'
import { lireChoix } from '../mobilite/stockage'
import { CLE_REGLAGES_RAPPELS, lireReglages as lireReglagesRappels } from '../outils/rappels'

// Réglages d'appareil (localStorage, clés `pandamove.*`), rassemblés sur le profil : valeur actuelle de chacun, accès à son écran
// et remise à zéro. Aucun n'est synchronisé. La remise à zéro ne touche ni les objectifs, ni le poids, ni les rappels (l'autorisation de
// notifier se donne par appareil), ni le mode sombre, la variante du panda ou la décharge, qui ont leur place plus haut sur le profil.

export const CLES_REINITIALISABLES = [CLE_EXERCICE_DEFAUT, CLE_FAVORITE, CLE_REGLAGES_CHARGE, CLE_PERIODE, 'pandamove.mobilite.choix'] as const

export interface LigneReglage {
  id: 'exercice' | 'favorite' | 'zones' | 'rappels' | 'periode' | 'mobilite'
  nom: string
  detail: string
  valeur: string
  /** Écran où se règle ce réglage. */
  vers: string
}

/** Noms résolus en base (exercice, méthode personnalisée) : `null` quand le réglage pointe vers quelque chose qui n'existe plus. */
export interface NomsReglages {
  exercice: string | null
  methode: string | null
}

export function lireLignesReglages(noms: NomsReglages): LigneReglage[] {
  const charge = lireReglagesCharge()
  const zones = [charge.ftpW !== undefined ? `${charge.ftpW} W` : null, charge.fcMax !== undefined ? `${charge.fcMax} bpm` : null].filter(Boolean)
  const favorite = lireFavorite()
  const integree = METHODES_INTEGREES.find((m) => m.id === favorite)
  const periode = PERIODES.find((p) => p.id === lirePeriode())
  return [
    { id: 'exercice', nom: 'Exercice affiché en premier', detail: 'Statistiques de renforcement', valeur: lireExerciceDefaut() === null ? 'Aucun' : (noms.exercice ?? 'Aucun'), vers: '/stats' },
    { id: 'favorite', nom: 'Méthode de respiration favorite', detail: 'Écran Respiration', valeur: favorite === null ? 'Aucune' : (integree?.nom ?? noms.methode ?? 'Aucune'), vers: '/breathing' },
    { id: 'zones', nom: 'FTP et fréquence cardiaque max', detail: 'Zones et charge d’entraînement', valeur: zones.length > 0 ? zones.join(' · ') : 'Estimées', vers: '/stats' },
    { id: 'rappels', nom: 'Rappels de séance', detail: 'Veille et jour même', valeur: lireReglagesRappels(localStorage.getItem(CLE_REGLAGES_RAPPELS)).actif ? 'Activés' : 'Désactivés', vers: '/outils/rappels' },
    { id: 'periode', nom: 'Période des statistiques', detail: 'Renforcement, course, vélo', valeur: periode?.libelle ?? '1 mois', vers: '/stats' },
    { id: 'mobilite', nom: 'Dernier choix de mobilité', detail: 'Temps, zones, moment', valeur: `${lireChoix().minutes} min`, vers: '/mobility' },
  ]
}

/** Remet les réglages d'appareil listés à leur valeur par défaut. Renvoie le nombre de clés effectivement présentes qui ont été retirées. */
export function reinitialiserReglages(): number {
  let n = 0
  for (const cle of CLES_REINITIALISABLES) {
    try {
      if (localStorage.getItem(cle) !== null) n++
      localStorage.removeItem(cle)
    } catch {
      // Stockage indisponible : rien à remettre à zéro
    }
  }
  return n
}
