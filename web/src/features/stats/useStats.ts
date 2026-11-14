import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getDb } from '../../core/db/client'
import type { Db } from '../../core/db/Db'
import type { MuscleGroup } from '../../core/db/types'
import { usePandaVariante } from '../../core/images/usePandaVariante'
import { imageHeatmap, type VueHeatmap } from './heatmapZones'
import { ecrireExerciceDefaut, lireExerciceDefaut } from './exerciceDefaut'
import { bornesPeriode, bornesPeriodePrecedente, ecrirePeriode, lirePeriode, type PeriodeId } from './periode'
import { construireGraphique, groupesVue, type MesureHistorique } from './presentation'
import { dateIsoLocale } from '../../core/common/dates'
import {
  exercicesAvecHistorique, historiqueExercice, recordsPersonnels, resumePeriode, tonnageParSemaine, volumeParMuscle, volumeVide,
  type ExerciceHistorique, type PointHistorique, type Record1RM, type ResumePeriode, type TonnageSemaine,
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
  /** Période de même durée juste avant (comparaison des tendances) ; null pour « Tout ». */
  precedent: ResumePeriode | null
  volume: Record<MuscleGroup, number>
}

const ECHEC_HISTORIQUE = "Le chargement de l'historique a échoué."
const AUCUN_POINT: PointHistorique[] = []
const RESUME_VIDE: ResumePeriode = { tonnageKg: 0, seancesTerminees: 0, seriesTotal: 0, repsTotal: 0 }

// Statistiques renforcement : période retenue dans localStorage, résumé, volume par muscle (heatmap
// face / dos), historique d'un exercice choisi. Lecture à l'ouverture et à chaque changement.
export function useStats({ db, nowFn, userId }: DepsStats = {}) {
  const [periode, setPeriode] = useState<PeriodeId>(lirePeriode)
  const [vue, setVue] = useState<VueHeatmap>('face')
  // Variante du panda (lecture partagée avec les autres écrans) ; male pendant la lecture
  const variante = usePandaVariante({ db, userId }) ?? 'male'
  const [donnees, setDonnees] = useState<DonneesPeriode>({ resume: RESUME_VIDE, precedent: null, volume: volumeVide() })
  const [cleChargee, setCleChargee] = useState<string | null>(null)
  // Erreur rattachée à la plage qui l'a produite : un nouveau chargement (autre plage) la masque d'office,
  // et un chargement réussi l'efface
  const [erreurPeriode, setErreurPeriode] = useState<{ cle: string; message: string } | null>(null)
  const [erreurHistorique, setErreurHistorique] = useState<string | null>(null)
  const [exercices, setExercices] = useState<ExerciceHistorique[]>([])
  const [exerciceChoisi, setExerciceChoisi] = useState<string | null>(null)
  // Historique avec l'exercice auquel il appartient : jamais celui d'un exercice précédent
  const [historique, setHistorique] = useState<{ id: string; points: PointHistorique[] } | null>(null)
  const sequence = useRef(0)

  const maintenant = (nowFn ?? (() => new Date()))()
  const { from, to } = bornesPeriode(periode, maintenant)
  const precedente = bornesPeriodePrecedente(periode, maintenant)
  const cle = `${from}|${to}`
  const chargement = cleChargee !== cle

  // Résumé et volume de la période ; seule la dernière demande est appliquée (changements rapides)
  useEffect(() => {
    let annule = false
    const numero = ++sequence.current
    const base = db ?? getDb()
    Promise.all([
      resumePeriode(base, from, to),
      volumeParMuscle(base, from, to),
      precedente ? resumePeriode(base, precedente.from, precedente.to) : Promise.resolve(null),
    ])
      .then(([resume, volume, precedent]) => {
        if (annule || numero !== sequence.current) return
        setDonnees({ resume, precedent, volume })
        setErreurPeriode(null)
      })
      .catch((e: unknown) => {
        console.error('Chargement des statistiques impossible', e)
        if (!annule && numero === sequence.current) {
          setErreurPeriode({ cle: `${from}|${to}`, message: 'Le chargement des statistiques a échoué.' })
        }
      })
      .finally(() => {
        if (!annule) setCleChargee(`${from}|${to}`)
      })
    return () => {
      annule = true
    }
    // `precedente` découle de la période et de la date du jour, comme from et to
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, from, to])

  // Exercices disponibles pour l'historique (toutes dates)
  useEffect(() => {
    let annule = false
    const base = db ?? getDb()
    exercicesAvecHistorique(base)
      .then((liste) => {
        if (!annule) setExercices(liste)
      })
      .catch((e: unknown) => {
        console.error('Chargement des exercices impossible', e)
        if (!annule) setErreurHistorique(ECHEC_HISTORIQUE)
      })
    return () => {
      annule = true
    }
  }, [db])

  // Records et tonnage des dernières semaines : indépendants de la période choisie
  const [records, setRecords] = useState<Record1RM[]>([])
  const [semaines, setSemaines] = useState<TonnageSemaine[]>([])
  useEffect(() => {
    let annule = false
    const base = db ?? getDb()
    const aujourdhui = dateIsoLocale((nowFn ?? (() => new Date()))())
    Promise.all([recordsPersonnels(base, aujourdhui), tonnageParSemaine(base, aujourdhui, 4)])
      .then(([r, s]) => {
        if (annule) return
        setRecords(r)
        setSemaines(s)
      })
      .catch((e: unknown) => console.error('Chargement des records impossible', e))
    return () => {
      annule = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db])

  // Exercice montré en premier : réglage d'appareil. Ordre de priorité : choix de la session, exercice défini par défaut
  // (s'il existe encore), puis le premier de la liste.
  const [exerciceDefaut, setExerciceDefautEtat] = useState<string | null>(lireExerciceDefaut)
  const existe = (id: string | null) => id !== null && exercices.some((e) => e.id === id)
  const exerciceId = existe(exerciceChoisi) ? exerciceChoisi : existe(exerciceDefaut) ? exerciceDefaut : (exercices[0]?.id ?? null)
  const definirExerciceDefaut = useCallback((id: string | null) => {
    ecrireExerciceDefaut(id)
    setExerciceDefautEtat(id)
  }, [])
  const [mesure, choisirMesure] = useState<MesureHistorique>('charge')

  useEffect(() => {
    if (!exerciceId) return
    let annule = false
    historiqueExercice(db ?? getDb(), exerciceId)
      .then((h) => {
        if (annule) return
        setHistorique({ id: exerciceId, points: h })
        setErreurHistorique(null)
      })
      .catch((e: unknown) => {
        console.error("Chargement de l'historique impossible", e)
        if (!annule) setErreurHistorique(ECHEC_HISTORIQUE)
      })
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
  const graphique = useMemo(() => construireGraphique(historiqueAffiche, mesure), [historiqueAffiche, mesure])

  const erreur = erreurPeriode && erreurPeriode.cle === cle ? erreurPeriode.message : null

  return {
    periode, choisirPeriode, chargement, erreur, erreurHistorique,
    // Vrai dès la première lecture terminée : ensuite les chiffres restent affichés pendant un rechargement
    pret: cleChargee !== null,
    resume: donnees.resume,
    precedent: donnees.precedent,
    precedente,
    from, to,
    records, semaines,
    // Jamais « vide » sur une erreur : le résumé à 0 n'est alors pas une donnée lue
    vide: !chargement && erreur === null && donnees.resume.seancesTerminees === 0,
    groupes,
    // Groupes tracés sur la vue affichée (un groupe peut l'être sur les deux vues)
    zonesVue: groupes.filter((g) => g.traces[vue] !== undefined),
    vue, setVue, variante, image: imageHeatmap(variante, vue),
    exercices, exerciceId, choisirExercice: setExerciceChoisi,
    exerciceDefaut, definirExerciceDefaut, mesure, choisirMesure,
    historique: historiqueAffiche, graphique,
  }
}
