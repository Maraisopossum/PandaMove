import type { RepsType } from '../../../core/db/types'
import type { ExerciceDraft } from '../draft'

// Mise en forme pure des champs de la carte d'exercice (résumé replié, durée min/sec, charge).

/** Répétitions ou durée affichée : « 8-12 », « 45s », « 1:30 » ; « — » si vide (Android formatRepsDisplay). */
export function formatReps(repsCibles: string, repsType: RepsType): string {
  const texte = repsCibles.trim()
  if (repsType === 'DURATION') {
    if (!/^\d+$/.test(texte)) return texte === '' ? '—' : texte
    const secondes = Number(texte)
    return secondes >= 60 ? `${Math.floor(secondes / 60)}:${String(secondes % 60).padStart(2, '0')}` : `${secondes}s`
  }
  return texte === '' ? '—' : texte
}

/** Résumé d'une ligne affiché carte repliée, ex. « 3 × 8–12 · 20 kg » (Android exerciceSummaryLine). */
export function resumeExercice(e: ExerciceDraft): string {
  const plage =
    e.progressionActivee && e.systemeProgression === 'DOUBLE' && e.repsMin !== null && e.repsMax !== null
      ? `${e.repsMin}–${e.repsMax}`
      : formatReps(e.repsCibles, e.repsType)
  const parties = [`${e.nombreSeriesPrevues} × ${plage}`]
  if (e.isBodyweight) parties.push('PDC')
  else if (e.chargeCible.trim() !== '') parties.push(e.chargeCible.trim())
  return parties.join(' · ')
}

const deuxChiffres = (s: string) => s.replace(/\D/g, '').slice(0, 2)

/** Total de secondes (texte, stocké dans repsCibles) -> champs minutes / secondes ; vide si absent ou nul. */
export function decouperDuree(repsCibles: string): { min: string; sec: string } {
  const total = /^\d+$/.test(repsCibles.trim()) ? Number(repsCibles.trim()) : 0
  if (total <= 0) return { min: '', sec: '' }
  return { min: String(Math.floor(total / 60)), sec: String(total % 60) }
}

/** Minutes + secondes saisies -> total de secondes (texte) ; vide si les deux sont vides ou nulles. */
export function assemblerDuree(min: string, sec: string): string {
  const m = deuxChiffres(min)
  const s = deuxChiffres(sec)
  if (m === '' && s === '') return ''
  const total = (m === '' ? 0 : Number(m)) * 60 + (s === '' ? 0 : Number(s))
  return total > 0 ? String(total) : ''
}

/**
 * Charge cible telle que le moteur de progression la relit (parseChargeKg) : virgule décimale -> point,
 * « 20kg » / « 20 KG » -> « 20 kg ». Le texte libre (« PDC », « Élastique ») et les saisies incomplètes
 * (« 20 k ») sont laissés intacts.
 */
export function normaliserCharge(saisie: string): string {
  const avecPoint = saisie.replace(/^(\s*\d+),(\d*)/, '$1.$2')
  const complete = /^(\d+(?:\.\d+)?)\s*kg$/i.exec(avecPoint.trim())
  return complete ? `${complete[1]} kg` : avecPoint
}
