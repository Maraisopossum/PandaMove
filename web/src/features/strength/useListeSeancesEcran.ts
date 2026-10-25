import { useCallback } from 'react'
import { useNavigate } from 'react-router'
import type { Seance } from '../../core/db/types'
import { useAffectation } from './useAffectation'
import { useLancement } from './useLancement'
import { useSeanceList } from './useSeanceList'
import { useSuppression } from './useSuppression'

// Orchestration de l'écran liste : liste, affectation à une date, lancement immédiat, archivage après confirmation,
// suppression avec choix du sort de l'historique.
export function useListeSeancesEcran() {
  const liste = useSeanceList()
  const { archiver } = liste
  const affectation = useAffectation(liste.assigner)
  const navigate = useNavigate()
  const ouvrirInstance = useCallback((id: string) => navigate(`/strength/instance/${id}`), [navigate])
  const lancement = useLancement(liste.lancer, ouvrirInstance)
  const suppression = useSuppression(liste.compterHistorique, liste.supprimer)

  const demanderArchivage = useCallback(
    async (seance: Seance) => {
      if (!window.confirm(`Archiver la séance « ${seance.nom} » ? Elle disparaîtra de la liste (ses données sont conservées).`)) return
      await archiver(seance.id)
    },
    [archiver],
  )

  return { ...liste, affectation, lancement, suppression, demanderArchivage }
}
