import { useCallback, useState } from 'react'
import { BORNES_DUREE, cyclesEffectifs, minutesParDefaut, type Methode, type ModeDuree } from './methodes'

// Méthode dépliée sur l'écran de choix et durée voulue : en cycles ou en minutes (le mode est commun à toutes les méthodes).
// Déplier une autre méthode remet sa valeur par défaut.
export function useChoixDuree() {
  const [ouverteId, setOuverteId] = useState<string | null>(null)
  const [mode, setModeEtat] = useState<ModeDuree>('cycles')
  const [saisie, setSaisie] = useState<number | null>(null)

  const basculer = useCallback((id: string) => {
    setOuverteId((courant) => (courant === id ? null : id))
    setSaisie(null)
  }, [])

  const setMode = useCallback((m: ModeDuree) => {
    setModeEtat(m)
    setSaisie(null)
  }, [])

  const valeurDe = useCallback(
    (m: Methode): number => saisie ?? (mode === 'cycles' ? m.cyclesDefaut : minutesParDefaut(m)),
    [saisie, mode],
  )

  const changer = useCallback(
    (m: Methode, delta: number) => {
      const { min, max } = BORNES_DUREE[mode]
      setSaisie(Math.min(max, Math.max(min, valeurDe(m) + delta)))
    },
    [mode, valeurDe],
  )

  /** Nombre de cycles à lancer pour la méthode, d'après la durée choisie. */
  const cyclesA = useCallback((m: Methode): number => cyclesEffectifs(m, mode, valeurDe(m)), [mode, valeurDe])

  return { ouverteId, mode, basculer, setMode, valeurDe, changer, cyclesA, bornes: BORNES_DUREE[mode] }
}
