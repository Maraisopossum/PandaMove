import { useCallback, useState } from 'react'
import type { Seance } from '../../core/db/types'
import type { Historique, ModeSuppression } from './suppression'

// État du dialogue de suppression. Le dialogue n'apparaît qu'une fois les effectifs connus
// (il adapte son contenu : sans historique, une seule confirmation). `compter` et `supprimer`
// viennent de useSeanceList, qui porte déjà les messages d'erreur.
export function useSuppression(
  compter: (seanceId: string) => Promise<Historique | null>,
  supprimer: (seanceId: string, mode: ModeSuppression) => Promise<boolean>,
) {
  const [cible, setCible] = useState<Seance | null>(null)
  const [historique, setHistorique] = useState<Historique | null>(null)
  const [enCours, setEnCours] = useState(false)

  const ouvrir = useCallback(
    async (seance: Seance) => {
      const h = await compter(seance.id)
      if (!h) return
      setHistorique(h)
      setCible(seance)
    },
    [compter],
  )

  const fermer = useCallback(() => {
    setCible(null)
    setHistorique(null)
  }, [])

  const confirmer = useCallback(
    async (mode: ModeSuppression) => {
      if (!cible || enCours) return
      setEnCours(true)
      try {
        // Succès ou échec, le dialogue se ferme : l'erreur éventuelle s'affiche dans la liste
        await supprimer(cible.id, mode)
        fermer()
      } finally {
        setEnCours(false)
      }
    },
    [cible, enCours, supprimer, fermer],
  )

  return { cible, historique, enCours, ouvrir, fermer, confirmer }
}
