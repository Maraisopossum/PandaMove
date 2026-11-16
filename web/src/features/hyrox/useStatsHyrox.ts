import { useEffect, useMemo, useState } from 'react'
import { getDb } from '../../core/db/client'
import type { DbLecture } from '../../core/db/Db'
import { lireSimulations, type SimulationHyrox } from '../../core/db/repos/hyrox'
import { ecrirePeriode, lirePeriode, type PeriodeId } from '../stats/periode'
import { calculerStatsHyrox } from './calculsStatsHyrox'

export interface DepsStatsHyrox {
  db?: DbLecture
  maintenant?: () => Date
}

const MAINTENANT = () => new Date()

// Statistiques Hyrox : simulations lues une fois, période choisie (le même réglage que le renforcement, la course et le vélo).
export function useStatsHyrox({ db, maintenant = MAINTENANT }: DepsStatsHyrox = {}) {
  const [simulations, setSimulations] = useState<SimulationHyrox[] | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [periode, setPeriode] = useState<PeriodeId>(lirePeriode)

  useEffect(() => {
    let annule = false
    lireSimulations(db ?? getDb())
      .then((l) => !annule && setSimulations(l))
      .catch((e: unknown) => {
        console.error('Lecture des simulations Hyrox impossible', e)
        if (!annule) setErreur('Le chargement des simulations a échoué.')
      })
    return () => {
      annule = true
    }
  }, [db])

  const stats = useMemo(() => (simulations ? calculerStatsHyrox(simulations, periode, maintenant()) : null), [simulations, periode, maintenant])

  return {
    pret: simulations !== null || erreur !== null,
    erreur,
    periode,
    choisirPeriode: (p: PeriodeId) => {
      setPeriode(p)
      ecrirePeriode(p)
    },
    stats,
  }
}
