import { useEffect, useMemo, useState } from 'react'
import { getDb } from '../../core/db/client'
import type { DbLecture } from '../../core/db/Db'
import { lireSorties, type Sortie, type Sport } from '../../core/db/repos/sorties'
import { bornesPeriode, ecrirePeriode, lirePeriode, type PeriodeId } from '../stats/periode'
import { calculerCarte, lieuxFrequentes, tracesDe } from './carteSorties'
import { calculerStatsEndurance } from './calculsEndurance'

export interface DepsStatsEndurance {
  db?: DbLecture
  maintenant?: () => Date
}

const MAINTENANT = () => new Date()

// Statistiques d'un sport (Course ou Vélo) dans l'écran Statistiques : sorties lues une fois, période choisie (partagée avec
// le renforcement via le même réglage enregistré), statistiques, heatmap des tracés et lieux de départ les plus fréquents.
export function useStatsEndurance(sport: Sport, { db, maintenant = MAINTENANT }: DepsStatsEndurance = {}) {
  const [sorties, setSorties] = useState<Sortie[] | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [periode, setPeriode] = useState<PeriodeId>(lirePeriode)

  useEffect(() => {
    let annule = false
    lireSorties(db ?? getDb(), { sport })
      .then((l) => !annule && setSorties(l))
      .catch((e: unknown) => {
        console.error('Lecture des sorties impossible', e)
        if (!annule) setErreur('Le chargement des sorties a échoué.')
      })
    return () => {
      annule = true
    }
  }, [db, sport])

  const calculs = useMemo(() => {
    if (!sorties) return null
    const now = maintenant()
    const { from, to } = bornesPeriode(periode, now)
    const dansLaPeriode = sorties.filter((s) => s.date >= from && s.date <= to)
    return {
      stats: calculerStatsEndurance(sorties, sport, periode, now),
      carte: calculerCarte(tracesDe(dansLaPeriode)),
      lieux: lieuxFrequentes(dansLaPeriode),
      sortiesGps: tracesDe(dansLaPeriode).length,
    }
  }, [sorties, sport, periode, maintenant])

  return {
    pret: sorties !== null || erreur !== null,
    erreur,
    periode,
    choisirPeriode: (p: PeriodeId) => {
      setPeriode(p)
      ecrirePeriode(p)
    },
    ...(calculs ?? { stats: null, carte: null, lieux: [], sortiesGps: 0 }),
  }
}
