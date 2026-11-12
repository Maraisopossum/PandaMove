import { useEffect, useMemo, useState } from 'react'
import { getDb } from '../../core/db/client'
import type { DbLecture } from '../../core/db/Db'
import { exercicesAvecHistorique, historiqueExercice, type ExerciceHistorique, type PointHistorique } from '../stats/statsQueries'
import { pointsDeLaPeriode, resumerProgression, type PeriodeProgression } from './progression'

export interface DepsProgression {
  db?: DbLecture
  maintenant?: () => Date
}

const MAINTENANT = () => new Date()

// Écran Progression : exercices jouables, exercice choisi (le premier par défaut), période, courbe et record.
export function useProgression({ db, maintenant = MAINTENANT }: DepsProgression = {}) {
  const [exercices, setExercices] = useState<ExerciceHistorique[] | null>(null)
  const [choisi, setChoisi] = useState<string | null>(null)
  const [periode, setPeriode] = useState<PeriodeProgression>('3m')
  const [historique, setHistorique] = useState<{ id: string; points: PointHistorique[] } | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)

  useEffect(() => {
    let annule = false
    exercicesAvecHistorique(db ?? getDb())
      .then((liste) => !annule && setExercices(liste))
      .catch((e: unknown) => {
        console.error('Lecture des exercices impossible', e)
        if (!annule) setErreur('Le chargement des exercices a échoué.')
      })
    return () => {
      annule = true
    }
  }, [db])

  const exerciceId = choisi && exercices?.some((e) => e.id === choisi) ? choisi : (exercices?.[0]?.id ?? null)

  useEffect(() => {
    if (!exerciceId) return
    let annule = false
    historiqueExercice(db ?? getDb(), exerciceId)
      .then((points) => !annule && setHistorique({ id: exerciceId, points }))
      .catch((e: unknown) => {
        console.error("Lecture de l'historique impossible", e)
        if (!annule) setErreur("Le chargement de l'historique a échoué.")
      })
    return () => {
      annule = true
    }
  }, [db, exerciceId])

  const resume = useMemo(() => {
    const points = historique && historique.id === exerciceId ? historique.points : []
    return resumerProgression(pointsDeLaPeriode(points, periode, maintenant()))
  }, [historique, exerciceId, periode, maintenant])

  return { pret: exercices !== null, exercices: exercices ?? [], exerciceId, choisirExercice: setChoisi, periode, setPeriode, resume, erreur }
}
