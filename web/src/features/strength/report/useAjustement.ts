import { useState } from 'react'

// Brouillon du choix « Ajuster » du récap : un seul exercice à la fois, charge saisie (kg).
// Une saisie vide donne NaN, que useReport refuse avec un message français.
export function useAjustement() {
  const [exerciceId, setExerciceId] = useState<string | null>(null)
  const [chargeKg, setChargeKg] = useState<number | null>(null)
  return {
    exerciceId,
    chargeKg,
    setChargeKg,
    ouvrir: (id: string, initiale: number | null) => {
      setExerciceId(id)
      setChargeKg(initiale)
    },
    fermer: () => setExerciceId(null),
    valeur: (): number => chargeKg ?? Number.NaN,
  }
}
