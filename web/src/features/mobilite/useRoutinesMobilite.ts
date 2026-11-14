import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../core/auth/AuthProvider'
import { dateIsoLocale } from '../../core/common/dates'
import { getDb } from '../../core/db/client'
import type { Db } from '../../core/db/Db'
import { lireSorties, type Sortie } from '../../core/db/repos/sorties'
import { grilleQuatreSemaines, serieJours, totauxQuatreSemaines } from './regularite'
import { ecrireRoutines, lireRoutines, preparerSeance, renommerRoutine, retirerRoutine } from './routines'
import type { ChoixMobilite } from './stockage'
import { suggerer } from './suggestion'
import { useHistoriqueMobilite } from './useHistoriqueMobilite'

const MAINTENANT = () => new Date()

// Écran des routines : régularité (jours de suite, quatre semaines), suggestion du jour après une grosse sortie, et gestion
// des routines (lancer, renommer, supprimer). Historique synchronisé ; routines propres à l'appareil.
export function useRoutinesMobilite({ maintenant = MAINTENANT, db }: { maintenant?: () => Date; db?: Db } = {}) {
  const { session } = useAuth()
  const historique = useHistoriqueMobilite({ db, userId: session?.user.id })
  const [routines, setRoutines] = useState(lireRoutines)
  const [sorties, setSorties] = useState<Pick<Sortie, 'sport' | 'date' | 'dureeS'>[]>([])

  // Les sorties ne servent qu'à la suggestion : une lecture qui échoue la masque sans bloquer l'écran
  useEffect(() => {
    let annule = false
    lireSorties(db ?? getDb(), { limite: 20 })
      .then((l) => {
        if (!annule) setSorties(l)
      })
      .catch((e: unknown) => console.error('Lecture des sorties impossible', e))
    return () => {
      annule = true
    }
  }, [db])

  const aujourdhui = dateIsoLocale(maintenant())
  const regularite = useMemo(
    () => ({ serie: serieJours(historique, aujourdhui), grille: grilleQuatreSemaines(historique, aujourdhui), totaux: totauxQuatreSemaines(historique, aujourdhui) }),
    [historique, aujourdhui],
  )
  const suggestion = useMemo(() => suggerer(sorties, historique, routines, aujourdhui), [sorties, historique, routines, aujourdhui])

  const appliquer = useCallback((suite: typeof routines) => {
    ecrireRoutines(suite)
    setRoutines(suite)
  }, [])
  const renommer = useCallback((id: string, nom: string) => appliquer(renommerRoutine(routines, id, nom)), [routines, appliquer])
  const supprimer = useCallback((id: string) => appliquer(retirerRoutine(routines, id)), [routines, appliquer])
  /** Prépare la séance du choix (comme « Générer ») ; l'appelant ouvre l'aperçu. */
  const lancer = useCallback((choix: ChoixMobilite) => preparerSeance(choix), [])

  return { routines, historique, regularite, suggestion, renommer, supprimer, lancer }
}
