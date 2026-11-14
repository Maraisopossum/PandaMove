import { rmEstime, type PointHistorique } from '../stats/statsQueries'

// « Dernière fois → cible du jour » d'un exercice de la séance type : dernière performance et indication quand la cible dépasse la
// dernière fois (charge en hausse, une répétition de plus) ou le meilleur 1RM estimé (« Record à battre »). Fonctions pures sur
// l'historique de l'exercice ; la cible vient de la surcharge progressive (objectif courant), jamais recalculée ici.

export interface InfoExercice {
  /** « 100 kg × 6 » ; null sans séance chargée terminée. */
  derniere: string | null
  /** Pastille : « Record à battre », « Charge +2,5 kg », « Une rep de plus », « +2 reps » ; null sans écart notable. */
  etiquette: { texte: string; record: boolean } | null
}

const FORMAT = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 })

export function infoExercice(historique: readonly PointHistorique[], chargeCibleKg: number | null, repsCible: number | null): InfoExercice {
  const chargees = historique.filter((p) => p.maxChargeKg > 0 && !p.enSecondes)
  const dernier = chargees[chargees.length - 1]
  if (!dernier) return { derniere: null, etiquette: null }
  const derniere = `${FORMAT.format(dernier.maxChargeKg)} kg × ${dernier.reps}`
  if (chargeCibleKg === null || chargeCibleKg <= 0) return { derniere, etiquette: null }
  if (repsCible !== null && repsCible > 0) {
    const meilleur = Math.max(...chargees.map((p) => p.rmEstimeKg))
    if (rmEstime(chargeCibleKg, repsCible) > meilleur) return { derniere, etiquette: { texte: 'Record à battre', record: true } }
  }
  if (chargeCibleKg > dernier.maxChargeKg) return { derniere, etiquette: { texte: `Charge +${FORMAT.format(Math.round((chargeCibleKg - dernier.maxChargeKg) * 100) / 100)} kg`, record: false } }
  if (chargeCibleKg === dernier.maxChargeKg && repsCible !== null && repsCible > dernier.reps) {
    const de = repsCible - dernier.reps
    return { derniere, etiquette: { texte: de === 1 ? 'Une rep de plus' : `+${de} reps`, record: false } }
  }
  return { derniere, etiquette: null }
}
