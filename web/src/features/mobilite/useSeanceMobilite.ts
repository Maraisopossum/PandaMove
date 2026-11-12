import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { dateIsoLocale } from '../../core/common/dates'
import { getDb } from '../../core/db/client'
import type { Db } from '../../core/db/Db'
import { enregistrerSeanceMobilite } from '../../core/db/repos/mobilite'
import { useVeilleEcran } from '../respiration/useVeilleEcran'
import { creerAudio, ecrireSonActif, lireSonActif, type AudioMobilite } from './audio'
import { zonesCouvertes, type PlanSeance } from './generer'
import { decouperEnPhases } from './phases'
import { lireChoix } from './stockage'

export interface DepsSeance {
  /** Horloge en millisecondes (défaut : Date.now). Remplaçable dans les tests. */
  maintenant?: () => number
  /** Intervalle de vérification du chronomètre, en ms. */
  intervalleMs?: number
  /** Base où enregistrer la séance terminée (défaut : base de l'application). */
  db?: Db
}

const HORLOGE = () => Date.now()

// Séance en cours : chronomètre par phase fondé sur l'horloge (juste même si l'onglet ralentit), pause, passage à
// l'exercice suivant ou précédent, sons, écran maintenu allumé. À la fin, la séance est ajoutée à l'historique synchronisé
// (une seule fois). Quitter avant la fin n'enregistre rien.
export function useSeanceMobilite(plan: PlanSeance | null, { maintenant = HORLOGE, intervalleMs = 200, db }: DepsSeance = {}) {
  const phases = useMemo(() => (plan ? decouperEnPhases(plan) : []), [plan])
  const [index, setIndex] = useState(0)
  const [restantMs, setRestantMs] = useState(() => (phases[0]?.dureeS ?? 0) * 1000)
  const [enPause, setEnPause] = useState(false)
  const [termine, setTermine] = useState(false)
  const [son, setSon] = useState(lireSonActif)
  const fin = useRef(0)
  const audio = useRef<AudioMobilite | null>(null)
  const sonRef = useRef(son)
  const enregistre = useRef(false)

  useEffect(() => {
    sonRef.current = son
  }, [son])
  useVeilleEcran(!termine && phases.length > 0)

  const jouer = useCallback((type: 'phase' | 'cote' | 'fin') => {
    if (!sonRef.current) return
    audio.current ??= creerAudio()
    audio.current.jouer(type)
  }, [])

  // Passe à la phase `suivante` : démarre son chronomètre et joue le son qui lui correspond
  const aller = useCallback(
    (suivante: number) => {
      if (suivante >= phases.length) {
        setTermine(true)
        setRestantMs(0)
        jouer('fin')
        return
      }
      const p = phases[suivante]
      fin.current = maintenant() + p.dureeS * 1000
      setIndex(suivante)
      setRestantMs(p.dureeS * 1000)
      if (p.type === 'exercice' && p.cote === 'droite') jouer('cote')
      else jouer('phase')
    },
    [phases, maintenant, jouer],
  )

  // Chronomètre : à chaque pas, le temps restant vient de l'horloge ; à zéro, phase suivante
  useEffect(() => {
    if (termine || enPause || phases.length === 0) return
    if (fin.current === 0) fin.current = maintenant() + restantMs
    const pas = window.setInterval(() => {
      const reste = fin.current - maintenant()
      if (reste <= 0) aller(index + 1)
      else setRestantMs(reste)
    }, intervalleMs)
    return () => window.clearInterval(pas)
    // restantMs n'est lu qu'à la reprise : le relire à chaque pas relancerait l'intervalle sans cesse
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [termine, enPause, index, phases, aller, maintenant, intervalleMs])

  const basculerPause = useCallback(() => {
    if (termine) return
    if (enPause) fin.current = maintenant() + restantMs
    setEnPause(!enPause)
  }, [termine, enPause, maintenant, restantMs])

  // Exercice suivant / précédent : on saute à la première phase de l'exercice voulu
  const premierePhase = useCallback((etape: number) => phases.findIndex((p) => p.type === 'exercice' && p.etape === etape), [phases])
  const suivant = useCallback(() => {
    const courante = phases[index]
    if (!courante) return
    const prochaine = premierePhase(courante.etape + (courante.type === 'transition' ? 0 : 1))
    setEnPause(false)
    if (prochaine < 0) aller(phases.length)
    else aller(prochaine)
  }, [phases, index, premierePhase, aller])
  const precedent = useCallback(() => {
    const courante = phases[index]
    if (!courante) return
    setEnPause(false)
    if (courante.type === 'preparation') return aller(0)
    // Transition : retour à l'exercice qui vient de finir. Exercice : on le recommence, ou on remonte au précédent
    // quand on vient juste de le commencer.
    const ecoule = courante.dureeS - (fin.current - maintenant()) / 1000
    const versPrecedent = courante.type === 'transition' || (ecoule < 2 && premierePhase(courante.etape) === index)
    const cible = premierePhase(versPrecedent ? courante.etape - (courante.type === 'transition' ? 1 : 1) : courante.etape)
    aller(cible > 0 ? cible : premierePhase(0))
  }, [phases, index, premierePhase, aller, maintenant])

  // Fin : une seule inscription à l'historique
  useEffect(() => {
    if (!termine || enregistre.current || !plan) return
    enregistre.current = true
    enregistrerSeanceMobilite(db ?? getDb(), {
      date: dateIsoLocale(new Date()),
      dureeS: plan.dureeTotaleS,
      exercices: plan.etapes.length,
      zones: zonesCouvertes(plan.etapes),
      sport: lireChoix().sport,
    }).catch((e: unknown) => console.error('Enregistrement de la séance de mobilité impossible', e))
  }, [termine, plan, db])

  useEffect(
    () => () => {
      audio.current?.liberer()
      audio.current = null
    },
    [],
  )

  const basculerSon = useCallback(() => {
    setSon((s) => {
      ecrireSonActif(!s)
      return !s
    })
  }, [])

  const phase = phases[Math.min(index, phases.length - 1)] ?? null
  const etapeActuelle = phase && plan ? plan.etapes[phase.etape] : null
  const ecouleS = phases.slice(0, index).reduce((t, p) => t + p.dureeS, 0) + (phase ? phase.dureeS - restantMs / 1000 : 0)
  const totalS = phases.reduce((t, p) => t + p.dureeS, 0)

  return {
    pret: phases.length > 0,
    phase,
    etape: etapeActuelle,
    numeroEtape: phase ? phase.etape + 1 : 0,
    nbEtapes: plan?.etapes.length ?? 0,
    prochaine: phase?.type === 'transition' || phase?.type === 'preparation' ? null : (plan?.etapes[(phase?.etape ?? 0) + 1] ?? null),
    restantS: Math.max(0, Math.ceil(restantMs / 1000)),
    progression: totalS > 0 ? Math.min(1, ecouleS / totalS) : 0,
    enPause,
    termine,
    son,
    basculerPause,
    suivant,
    precedent,
    basculerSon,
  }
}
