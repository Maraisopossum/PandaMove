import { useCallback, useEffect, useRef, useState } from 'react'
import { getDb } from '../../core/db/client'
import type { Db } from '../../core/db/Db'
import { ErreurSortie, lireSortie, lireSorties, supprimerSortie, type Sortie, type Sport } from '../../core/db/repos/sorties'

export interface DepsSorties {
  /** Base à utiliser (défaut : base de l'application, résolue à l'usage). */
  db?: Db
}

// Liste des sorties d'un sport, les plus récentes d'abord. La base n'expose pas d'observation : relue après chaque action.
export function useSorties(sport: Sport, { db }: DepsSorties = {}) {
  const [sorties, setSorties] = useState<Sortie[]>([])
  const [charge, setCharge] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const sequence = useRef(0)

  const lire = useCallback(async () => {
    const numero = ++sequence.current
    const liste = await lireSorties(db ?? getDb(), { sport })
    if (numero === sequence.current) setSorties(liste)
  }, [db, sport])

  useEffect(() => {
    let annule = false
    lire()
      .catch((e: unknown) => {
        console.error('Chargement des sorties impossible', e)
        if (!annule) setErreur('Le chargement des sorties a échoué.')
      })
      .finally(() => {
        if (!annule) setCharge(true)
      })
    return () => {
      annule = true
    }
  }, [lire])

  return { sorties, charge, erreur }
}

// Une sortie (écran de détail) : chargement, introuvable, suppression. `supprimer` renvoie true si la sortie est supprimée.
export function useSortie(id: string | undefined, { db }: DepsSorties = {}) {
  const [sortie, setSortie] = useState<Sortie | null>(null)
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState<string | null>(null)

  useEffect(() => {
    if (id === undefined) return
    let annule = false
    lireSortie(db ?? getDb(), id)
      .then((s) => {
        if (!annule) setSortie(s)
      })
      .catch((e: unknown) => {
        console.error('Chargement de la sortie impossible', e)
        if (!annule) setErreur('Le chargement de la sortie a échoué.')
      })
      .finally(() => {
        if (!annule) setChargement(false)
      })
    return () => {
      annule = true
    }
  }, [id, db])

  const supprimer = useCallback(async (): Promise<boolean> => {
    if (id === undefined) return false
    setErreur(null)
    try {
      await supprimerSortie(db ?? getDb(), id)
      return true
    } catch (e) {
      if (e instanceof ErreurSortie) setErreur(e.message)
      else {
        console.error('Suppression de la sortie impossible', e)
        setErreur('La suppression de la sortie a échoué.')
      }
      return false
    }
  }, [id, db])

  return { sortie, chargement, introuvable: !chargement && sortie === null && erreur === null, erreur, supprimer }
}
