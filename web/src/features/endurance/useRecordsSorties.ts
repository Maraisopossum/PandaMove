import { useEffect, useMemo, useState } from 'react'
import { getDb } from '../../core/db/client'
import type { DbLecture } from '../../core/db/Db'
import { lireSorties, type Sortie, type Sport } from '../../core/db/repos/sorties'
import { analyserSortie, badgesParSortie, calculerRecords, type AnalyseSortie, type RecordsSport } from './recordsSorties'

// Records d'un sport à partir des sorties déjà lues : l'analyse de la série (300 échantillons par sortie) n'est refaite que si la
// liste change.
export function useRecordsSorties(sorties: Sortie[], sport: Sport): { analyses: AnalyseSortie[]; records: RecordsSport; badges: Record<string, string[]> } {
  const duSport = useMemo(() => sorties.filter((s) => s.sport === sport), [sorties, sport])
  const analyses = useMemo(() => duSport.map(analyserSortie), [duSport])
  const records = useMemo(() => calculerRecords(duSport, analyses, sport), [duSport, analyses, sport])
  const badges = useMemo(() => badgesParSortie(duSport, records, sport), [duSport, records, sport])
  return { analyses, records, badges }
}

/** Toutes les sorties (les deux sports), pour les écrans qui s'appuient sur l'ensemble : records et comparaisons. */
export function useToutesLesSorties({ db }: { db?: DbLecture } = {}) {
  const [sorties, setSorties] = useState<Sortie[]>([])
  const [charge, setCharge] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  useEffect(() => {
    let annule = false
    lireSorties(db ?? getDb())
      .then((l) => {
        if (!annule) setSorties(l)
      })
      .catch((e: unknown) => {
        console.error('Lecture des sorties impossible', e)
        if (!annule) setErreur('Le chargement des sorties a échoué.')
      })
      .finally(() => {
        if (!annule) setCharge(true)
      })
    return () => {
      annule = true
    }
  }, [db])
  return { sorties, charge, erreur }
}
