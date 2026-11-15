import { useCallback, useEffect, useRef, useState } from 'react'
import { getDb } from '../../core/db/client'
import type { Db } from '../../core/db/Db'
import {
  cloreSimulation, demarrerSimulation, enregistrerSegment, lireObjectifHyrox, lireSegments, lireSimulationEnCours,
  type CategorieHyroxDb, type CourseHyrox, type GenreHyroxDb, type SegmentHyrox, type SimulationHyrox,
} from '../../core/db/repos/hyrox'
import { bip, lireSonHyrox } from './bip'
import { ciblesPourSegments, lireRepartition, segmentsDeForme, type FormeSimulation } from './simulation'
import { chargeStation, type CleStation } from './stations'

export interface DemandeSimulation {
  forme: FormeSimulation
  station?: CleStation | null
  categorie: CategorieHyroxDb
  genre: GenreHyroxDb
}

/** Départ du segment en cours : début de la simulation + temps des segments déjà terminés. */
export function debutSegmentCourant(sim: SimulationHyrox, segments: readonly SegmentHyrox[]): number {
  return Date.parse(sim.debutAt) + segments.reduce((t, s) => t + (s.reelS ?? 0), 0) * 1000
}

/**
 * Simulation chronométrée. Le temps ne dépend d'aucune minuterie : chaque segment part de la fin du précédent (début de la simulation
 * + temps déjà enregistrés), donc on retrouve le chrono exact après un rechargement. Le segment courant est le premier sans temps.
 */
export function useSimulationHyrox({ db }: { db?: Db } = {}) {
  const [pret, setPret] = useState(false)
  const [objectif, setObjectif] = useState<CourseHyrox | null>(null)
  const [simulation, setSimulation] = useState<SimulationHyrox | null>(null)
  const [segments, setSegments] = useState<SegmentHyrox[]>([])
  const [maintenant, setMaintenant] = useState(() => Date.now())
  const [erreur, setErreur] = useState('')
  const [terminee, setTerminee] = useState<string | null>(null)
  const occupe = useRef(false)

  const base = useCallback(() => db ?? getDb(), [db])

  useEffect(() => {
    let annule = false
    const b = base()
    Promise.all([lireObjectifHyrox(b), lireSimulationEnCours(b)])
      .then(async ([o, enCours]) => {
        const segs = enCours ? await lireSegments(b, enCours.id) : []
        if (annule) return
        setObjectif(o)
        setSimulation(enCours)
        setSegments(segs)
        setPret(true)
      })
      .catch(() => {
        if (!annule) {
          setErreur('Impossible de lire la simulation pour le moment.')
          setPret(true)
        }
      })
    return () => {
      annule = true
    }
  }, [base])

  const courant = simulation ? (segments.find((s) => s.reelS === null) ?? null) : null
  const enMarche = simulation !== null && courant !== null

  useEffect(() => {
    if (!enMarche) return
    const minuterie = setInterval(() => setMaintenant(Date.now()), 250)
    return () => clearInterval(minuterie)
  }, [enMarche])

  const demarrer = useCallback(
    async (demande: DemandeSimulation) => {
      if (occupe.current) return
      occupe.current = true
      setErreur('')
      try {
        const b = base()
        const plan = segmentsDeForme(demande.forme, demande.station)
        const cibles = ciblesPourSegments(plan, objectif?.objectifS ?? null, lireRepartition(objectif?.repartitionJson).partCoursesPct)
        await demarrerSimulation(b, {
          courseId: objectif?.id ?? null, forme: demande.forme, categorie: demande.categorie, genre: demande.genre,
          segments: plan.map((s, i) => ({
            rang: s.rang, type: s.type, station: s.station, cibleS: cibles[i],
            chargeLabel: s.station ? chargeStation(s.station, demande.categorie, demande.genre) : null,
          })),
        })
        const enCours = await lireSimulationEnCours(b)
        setSimulation(enCours)
        setSegments(enCours ? await lireSegments(b, enCours.id) : [])
        setMaintenant(Date.now())
        if (lireSonHyrox()) bip(660, 220)
      } catch (e) {
        console.error('Démarrage de la simulation impossible', e)
        setErreur('La simulation n’a pas pu démarrer.')
      } finally {
        occupe.current = false
      }
    },
    [base, objectif],
  )

  const segmentSuivant = useCallback(async () => {
    if (!simulation || !courant || occupe.current) return
    occupe.current = true
    setErreur('')
    try {
      const b = base()
      const reel = Math.max(0, Math.round((Date.now() - debutSegmentCourant(simulation, segments)) / 1000))
      await enregistrerSegment(b, simulation.id, courant.rang, reel)
      const suivants = await lireSegments(b, simulation.id)
      setSegments(suivants)
      if (suivants.every((s) => s.reelS !== null)) {
        await cloreSimulation(b, simulation.id, 'terminee')
        if (lireSonHyrox()) bip(990, 400)
        setSimulation(null)
        setTerminee(simulation.id)
      } else if (lireSonHyrox()) {
        bip()
      }
    } catch (e) {
      console.error('Enregistrement du segment impossible', e)
      setErreur('Le temps du segment n’a pas pu être enregistré.')
    } finally {
      occupe.current = false
    }
  }, [base, simulation, courant, segments])

  const abandonner = useCallback(async () => {
    if (!simulation || occupe.current) return
    occupe.current = true
    try {
      await cloreSimulation(base(), simulation.id, 'abandonnee')
      setSimulation(null)
      setSegments([])
    } catch (e) {
      console.error('Abandon de la simulation impossible', e)
      setErreur('L’abandon n’a pas pu être enregistré.')
    } finally {
      occupe.current = false
    }
  }, [base, simulation])

  const ecoule = simulation && courant ? Math.max(0, Math.floor((maintenant - debutSegmentCourant(simulation, segments)) / 1000)) : 0
  return { pret, objectif, simulation, segments, courant, enMarche, ecoule, erreur, terminee, demarrer, segmentSuivant, abandonner }
}
