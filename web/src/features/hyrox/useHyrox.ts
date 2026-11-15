import { useCallback, useEffect, useState } from 'react'
import { dateIsoLocale } from '../../core/common/dates'
import { getDb } from '../../core/db/client'
import type { DbLecture } from '../../core/db/Db'
import {
  lireObjectifHyrox, lireSegments, lireSegmentsMesures, lireSimulation, lireSimulationEnCours, lireSimulations, type CourseHyrox, type SegmentHyrox, type SimulationHyrox,
} from '../../core/db/repos/hyrox'
import { estCleStation } from './stations'
import { calculerRecords, estimerTemps, lireRepartition, type RecordsHyrox, type Repartition, type SegmentMesure } from './simulation'

export const versMesure = (s: SegmentHyrox): SegmentMesure => ({
  rang: s.rang, type: s.type, station: s.station && estCleStation(s.station) ? s.station : null, cibleS: s.cibleS, reelS: s.reelS,
})

export interface Estimation {
  /** Simulation d'où vient l'estimation (la référence, sinon la dernière complète terminée). */
  simulation: SimulationHyrox
  totalS: number
  basS: number
  hautS: number
}

export interface EtatHyrox {
  pret: boolean
  erreur: string
  objectif: CourseHyrox | null
  repartition: Repartition
  simulations: SimulationHyrox[]
  enCours: SimulationHyrox | null
  estimation: Estimation | null
  records: RecordsHyrox
  /** Jours avant la course ; null quand aucune date n'est fixée. */
  joursAvantCourse: number | null
}

const VIDE: EtatHyrox = {
  pret: false, erreur: '', objectif: null, repartition: lireRepartition(null), simulations: [], enCours: null, estimation: null,
  records: { parStation: {}, meilleurKm: null }, joursAvantCourse: null,
}

const joursEntre = (a: string, b: string) => Math.round((Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8)) - Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8))) / 86_400_000)

/** Estimation à partir de la simulation de référence, sinon de la dernière simulation complète terminée. */
export function choisirEstimation(simulations: readonly SimulationHyrox[]): Estimation | null {
  const completes = simulations.filter((s) => s.forme === 'complete' && s.statut === 'terminee' && s.totalS !== null)
  const s = completes.find((x) => x.reference) ?? completes[0]
  return s ? { simulation: s, totalS: s.totalS!, ...estimerTemps(s.totalS!) } : null
}

/** Données du module Hyrox : objectif (sans date obligatoire), simulations, estimation et records. */
export function useHyrox({ db, aujourdhui = dateIsoLocale(new Date()) }: { db?: DbLecture; aujourdhui?: string } = {}) {
  const [etat, setEtat] = useState<EtatHyrox>(VIDE)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let annule = false
    const base = db ?? getDb()
    Promise.all([lireObjectifHyrox(base), lireSimulations(base), lireSimulationEnCours(base), lireSegmentsMesures(base)])
      .then(([objectif, simulations, enCours, segments]) => {
        if (annule) return
        setEtat({
          pret: true, erreur: '', objectif, repartition: lireRepartition(objectif?.repartitionJson), simulations, enCours,
          estimation: choisirEstimation(simulations), records: calculerRecords(segments.map(versMesure)),
          joursAvantCourse: objectif?.date && objectif.resultatS === null ? joursEntre(aujourdhui, objectif.date) : null,
        })
      })
      .catch(() => {
        if (!annule) setEtat({ ...VIDE, pret: true, erreur: 'Impossible de lire les données Hyrox pour le moment.' })
      })
    return () => {
      annule = true
    }
  }, [db, aujourdhui, version])

  const recharger = useCallback(() => setVersion((v) => v + 1), [])
  return { ...etat, recharger }
}

/** Une simulation et ses segments (bilan). */
export function useBilanHyrox(id: string | undefined, db?: DbLecture) {
  const [simulation, setSimulation] = useState<SimulationHyrox | null>(null)
  const [segments, setSegments] = useState<SegmentHyrox[]>([])
  const [etat, setEtat] = useState<'chargement' | 'pret' | 'introuvable' | 'erreur'>('chargement')
  const [version, setVersion] = useState(0)

  useEffect(() => {
    if (!id) return
    let annule = false
    const base: DbLecture = db ?? getDb()
    Promise.all([lireSimulation(base, id), lireSegments(base, id)])
      .then(([sim, segs]) => {
        if (annule) return
        setSimulation(sim)
        setSegments(segs)
        setEtat(sim ? 'pret' : 'introuvable')
      })
      .catch(() => !annule && setEtat('erreur'))
    return () => {
      annule = true
    }
  }, [id, db, version])

  return { simulation, segments, etat, recharger: useCallback(() => setVersion((v) => v + 1), []) }
}
