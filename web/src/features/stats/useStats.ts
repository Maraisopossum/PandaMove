import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getDb } from '../../core/db/client'
import type { Db } from '../../core/db/Db'
import { getSettings } from '../../core/db/repos/settings'
import type { MuscleGroup, PandaVariant } from '../../core/db/types'
import { imageHeatmap, type VueHeatmap } from './heatmapZones'
import { bornesPeriode, ecrirePeriode, lirePeriode, type PeriodeId } from './periode'
import { construireGraphique, groupesVue } from './presentation'
import {
  exercicesAvecHistorique, historiqueExercice, resumePeriode, volumeParMuscle, volumeVide,
  type ExerciceHistorique, type PointHistorique, type ResumePeriode,
} from './statsQueries'

export interface DepsStats {
  /** Base à utiliser (défaut : base de l'application, résolue à l'usage). */
  db?: Db
  /** Horloge injectable pour « aujourd'hui ». */
  nowFn?: () => Date
  /** Utilisateur connecté : sert à lire la variante du panda (défaut : male). */
  userId?: string
}

interface DonneesPeriode {
  resume: ResumePeriode
  volume: Record<MuscleGroup, number>
}

const AUCUN_POINT: PointHistorique[] = []
const RESUME_VIDE: ResumePeriode = { tonnageKg: 0, seancesTerminees: 0, seriesTotal: 0, repsTotal: 0 }

// Statistiques renforcement : période retenue dans localStorage, résumé, volume par muscle (heatmap
// face / dos), historique d'un exercice choisi. Lecture à l'ouverture et à chaque changement.
export function useStats({ db, nowFn, userId }: DepsStats = {}) {
  const [periode, setPeriode] = useState<PeriodeId>(lirePeriode)
  const [vue, setVue] = useState<VueHeatmap>('face')
  const [variante, setVariante] = useState<PandaVariant>('male')
  const [donnees, setDonnees] = useState<DonneesPeriode>({ resume: RESUME_VIDE, volume: volumeVide() })
  const [cleChargee, setCleChargee] = useState<string | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [exercices, setExercices] = useState<ExerciceHistorique[]>([])
  const [exerciceChoisi, setExerciceChoisi] = useState<string | null>(null)
  // Historique avec l'exercice auquel il appartient : jamais celui d'un exercice précédent
  const [historique, setHistorique] = useState<{ id: string; points: PointHistorique[] } | null>(null)
  const sequence = useRef(0)

  const { from, to } = bornesPeriode(periode, (nowFn ?? (() => new Date()))())
  const cle = `${from}|${to}`
  const chargement = cleChargee !== cle

  // Résumé et volume de la période ; seule la dernière demande est appliquée (changements rapides)
  useEffect(() => {
    let annule = false
    const numero = ++sequence.current
    const base = db ?? getDb()
    Promise.all([resumePeriode(base, from, to), volumeParMuscle(base, from, to)])
      .then(([resume, volume]) => {
        if (!annule && numero === sequence.current) setDonnees({ resume, volume })
      })
      .catch((e: unknown) => {
        console.error('Chargement des statistiques impossible', e)
        if (!annule) setErreur('Le chargement des statistiques a échoué.')
      })
      .finally(() => {
        if (!annule) setCleChargee(`${from}|${to}`)
      })
    return () => {
      annule = true
    }
  }, [db, from, to])

  // Exercices disponibles pour l'historique (toutes dates) et variante du panda
  useEffect(() => {
    let annule = false
    const base = db ?? getDb()
    exercicesAvecHistorique(base)
      .then((liste) => {
        if (!annule) setExercices(liste)
      })
      .catch((e: unknown) => console.error('Chargement des exercices impossible', e))
    if (userId) {
      getSettings(base, userId)
        .then((s) => {
          if (!annule) setVariante(s.pandaVariant)
        })
        .catch((e: unknown) => console.error('Lecture de la variante du panda impossible', e))
    }
    return () => {
      annule = true
    }
  }, [db, userId])

  // Sans choix explicite (ou choix disparu), le premier exercice de la liste
  const exerciceId =
    exerciceChoisi && exercices.some((e) => e.id === exerciceChoisi) ? exerciceChoisi : (exercices[0]?.id ?? null)

  useEffect(() => {
    if (!exerciceId) return
    let annule = false
    historiqueExercice(db ?? getDb(), exerciceId)
      .then((h) => {
        if (!annule) setHistorique({ id: exerciceId, points: h })
      })
      .catch((e: unknown) => console.error("Chargement de l'historique impossible", e))
    return () => {
      annule = true
    }
  }, [db, exerciceId])

  const choisirPeriode = useCallback((p: PeriodeId) => {
    ecrirePeriode(p)
    setPeriode(p)
  }, [])

  const groupes = useMemo(() => groupesVue(donnees.volume, variante), [donnees.volume, variante])
  const historiqueAffiche = historique && historique.id === exerciceId ? historique.points : AUCUN_POINT
  const graphique = useMemo(() => construireGraphique(historiqueAffiche), [historiqueAffiche])

  return {
    periode, choisirPeriode, chargement, erreur,
    // Vrai dès la première lecture terminée : ensuite les chiffres restent affichés pendant un rechargement
    pret: cleChargee !== null,
    resume: donnees.resume,
    vide: !chargement && donnees.resume.seancesTerminees === 0,
    groupes,
    zonesVue: groupes.filter((g) => g.vue === vue),
    vue, setVue, variante, image: imageHeatmap(variante, vue),
    exercices, exerciceId, choisirExercice: setExerciceChoisi,
    historique: historiqueAffiche, graphique,
  }
}
