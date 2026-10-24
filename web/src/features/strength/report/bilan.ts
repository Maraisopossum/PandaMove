import { formaterCharge } from '../../../core/common/formaterCharge'
import type { ExerciceSeance, SerieRealisee } from '../../../core/db/types'
import { chargeLisible } from '../../../core/progression/chargeLisible'
import type { PropositionProgression } from '../../../core/progression/engine'

// Fonctions pures d'affichage du bilan de séance et du récap de progression (miroir
// d'InstanceReportScreen / ProgressionRecapDialog Android). L'évaluation elle-même vit dans
// ../progression (partagée avec la fin de séance).

export interface ResumeSeance {
  tonnageKg: number
  seriesTotal: number
  dureeSec: number
}

// Tonnage = Σ reps × charge des séries TERMINÉES ; une série DURATION contient des secondes, pas des
// répétitions : elle compte pour 0 (KNOWN_BUGS « tonnage renforcement »). Séries = toutes les séries
// terminées (tous types) des exercices de l'instance.
export function resumerSeance(
  exercices: Pick<ExerciceSeance, 'id' | 'repsType'>[],
  series: SerieRealisee[],
  dureeSec: number,
): ResumeSeance {
  const types = new Map(exercices.map((e) => [e.id, e.repsType]))
  let tonnageKg = 0
  let seriesTotal = 0
  for (const s of series) {
    const type = types.get(s.exerciceSeanceId)
    if (type === undefined || !s.isCompleted) continue
    seriesTotal++
    if (type !== 'DURATION' && s.repsRealisees !== null && s.chargeKg !== null) tonnageKg += s.repsRealisees * s.chargeKg
  }
  // Arrondi à 0,01 kg : absorbe le bruit des sommes décimales (0,1 + 0,2)
  return { tonnageKg: Number(tonnageKg.toFixed(2)), seriesTotal, dureeSec }
}

// ── Textes (strings.xml progression_recap_*) ──

const kg = (c: number) => `${formaterCharge(chargeLisible(c))} kg`

/** Libellé de la proposition, même priorité que ProgressionRecapDialog Android. */
export function texteProposition(p: PropositionProgression): string {
  if (p.nouveauNombreSeries !== null) return `Proposer +1 série (${p.nouveauNombreSeries}) — reps remis à ${p.nouveauRepsCible ?? 0}`
  if (p.nouvelleDureeCible !== null) return `Proposer ${p.nouvelleDureeCible} s`
  if (p.nouveauRepsCible !== null && p.nouvelleChargeCible !== null) return `Proposer ${p.nouveauRepsCible} reps à ${kg(p.nouvelleChargeCible)}`
  if (p.nouvelleChargeCible !== null) return `Proposer ${kg(p.nouvelleChargeCible)}`
  if (p.nouveauRepsCible !== null) return `Proposer ${p.nouveauRepsCible} reps`
  return ''
}

/** Explication du statut en langage courant. */
export function texteStatut(p: PropositionProgression): string {
  if (p.deload) return 'Réduction proposée de 10 % après échecs répétés.'
  switch (p.statut) {
    case 'SUCCES':
      return 'Cible atteinte sur toutes les séries : progression proposée.'
    case 'SUCCES_SANS_MARGE':
      return 'Cible atteinte mais RPE élevé — pas de marge, cible maintenue.'
    case 'ECHEC':
    case 'ECHEC_MARQUE':
      return `Cible manquée : cible maintenue (échec n° ${p.nouveauCompteurEchec}).`
    case 'NON_LOGGE':
      return 'Non loggé — aucune série enregistrée cette fois-ci.'
  }
}

/** Durée affichée : m:ss sous une heure, h:mm au-delà. */
export function formaterDureeBilan(dureeSec: number): string {
  const total = Math.max(0, Math.round(dureeSec))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const deux = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h} h ${deux(m)}` : `${deux(m)}:${deux(s)}`
}

/** Tonnage affiché : kg sous une tonne, t au-delà (comme InstanceReportScreen Android). */
export function formaterTonnage(tonnageKg: number): string {
  if (tonnageKg >= 1000) return `${(tonnageKg / 1000).toFixed(1).replace('.', ',')} t`
  return `${Math.round(tonnageKg)} kg`
}
