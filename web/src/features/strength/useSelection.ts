import { useCallback, useMemo, useState } from 'react'

// Sélection multiple d'une liste (Android : appui long puis touches pour (dé)sélectionner). Le mode s'ouvre par
// « entrer » (bouton Sélectionner, ou appui long avec l'élément visé) et se ferme par « quitter » ou quand on retire le
// dernier élément choisi, comme l'Android.
export function useSelection() {
  const [mode, setMode] = useState(false)
  const [choisis, setChoisis] = useState<ReadonlySet<string>>(() => new Set())

  const entrer = useCallback((id?: string) => {
    setMode(true)
    if (id !== undefined) setChoisis((s) => new Set(s).add(id))
  }, [])

  const basculer = useCallback(
    (id: string) => {
      const suivant = new Set(choisis)
      if (suivant.has(id)) suivant.delete(id)
      else suivant.add(id)
      setChoisis(suivant)
      if (suivant.size === 0) setMode(false)
    },
    [choisis],
  )

  const quitter = useCallback(() => {
    setMode(false)
    setChoisis(new Set())
  }, [])

  const estSelectionne = useCallback((id: string) => choisis.has(id), [choisis])
  const identifiants = useMemo(() => [...choisis], [choisis])

  return { mode, nombre: choisis.size, identifiants, estSelectionne, entrer, basculer, quitter }
}
