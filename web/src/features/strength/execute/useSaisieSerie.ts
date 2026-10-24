import { useState } from 'react'
import type { Mesures } from './vue'

export interface Brouillon {
  reps: number | null
  chargeKg: number | null
  rpe: number | null
}

// Brouillon d'une série (formulaire de saisie ou correction). Un champ répétitions vide donne NaN,
// que la validation de useExecute refuse avec un message français.
export function useSaisieSerie(initial: Brouillon) {
  const [reps, setReps] = useState(initial.reps)
  const [chargeKg, setChargeKg] = useState(initial.chargeKg)
  const [rpe, setRpe] = useState(initial.rpe)
  const mesures = (): Mesures => ({ reps: reps ?? Number.NaN, chargeKg, rpe })
  return { reps, setReps, chargeKg, setChargeKg, rpe, setRpe, mesures }
}
