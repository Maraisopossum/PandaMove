import { useCallback } from 'react'
import type { Seance } from '../../core/db/types'
import { useAffectation } from './useAffectation'
import { useSeanceList } from './useSeanceList'

// Orchestration de l'écran liste : liste, affectation à une date, archivage après confirmation.
export function useListeSeancesEcran() {
  const liste = useSeanceList()
  const { archiver } = liste
  const affectation = useAffectation(liste.assigner)

  const demanderArchivage = useCallback(
    async (seance: Seance) => {
      if (!window.confirm(`Archiver la séance « ${seance.nom} » ? Elle disparaîtra de la liste (ses données sont conservées).`)) return
      await archiver(seance.id)
    },
    [archiver],
  )

  return { ...liste, affectation, demanderArchivage }
}
