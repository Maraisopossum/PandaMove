import { useEffect, useState } from 'react'
import { getDb } from '../../core/db/client'
import type { DbLecture } from '../../core/db/Db'
import { lireSeancesDepuis, type SeanceRespirationDatee } from '../../core/db/repos/respiration'

/** Toutes les séances de respiration datées (écran de statistiques) ; `db` permet aux tests d'injecter une base. */
export function useSeancesRespiration(db?: DbLecture): { seances: SeanceRespirationDatee[] | null; erreur: string | null } {
  const [seances, setSeances] = useState<SeanceRespirationDatee[] | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  useEffect(() => {
    let annule = false
    lireSeancesDepuis(db ?? getDb(), '0000-01-01')
      .then((l) => !annule && setSeances(l))
      .catch((e: unknown) => {
        console.error('Lecture des séances de respiration impossible', e)
        if (!annule) setErreur('Le chargement des statistiques a échoué.')
      })
    return () => {
      annule = true
    }
  }, [db])
  return { seances, erreur }
}
