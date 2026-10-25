import { useState } from 'react'
import { pasManuel } from './minuteurRepos'

// Durée choisie dans la feuille « Minuteur » : préréglages, ± 5 s. Reprend la dernière durée utilisée.
export function useSelectionMinuteur(initialeSec: number) {
  const [sec, setSec] = useState(initialeSec)
  return {
    sec,
    choisir: setSec,
    plus: () => setSec((s) => pasManuel(s, 1)),
    moins: () => setSec((s) => pasManuel(s, -1)),
  }
}
