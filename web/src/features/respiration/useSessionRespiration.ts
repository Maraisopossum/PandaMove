import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getDb } from '../../core/db/client'
import type { Db } from '../../core/db/Db'
import { dateIsoLocale } from '../../core/common/dates'
import { enregistrerSeance } from '../../core/db/repos/respiration'
import { audioMuet, creerAudio, type AudioRespiration } from './audio'
import { configDe, type Methode } from './methodes'
import { dureeTotaleMs, etatA, type EtatSession } from './moteur'

export type StatutSession = 'decompte' | 'en_cours' | 'pause' | 'termine'

export interface DepsSession {
  /** Base à utiliser (défaut : base de l'application, résolue à l'usage). */
  db?: Db
  /** Sons (défaut : Web Audio ; muet si le navigateur n'en a pas). */
  audio?: AudioRespiration
  /** Horloge en millisecondes. */
  maintenant?: () => number
  /** Jour de la séance enregistrée, au format yyyy-MM-dd. */
  aujourdhui?: () => string
  /** Pas de rafraîchissement de l'état (100 ms comme l'application Android). */
  pasMs?: number
  secondesDecompte?: number
}

const MESSAGE_ECHEC_ENREGISTREMENT = "La séance n'a pas pu être enregistrée dans l'historique."

const aujourdhuiParDefaut = () => dateIsoLocale(new Date())

// Séance de respiration : décompte (5 s par défaut), puis les cycles de la méthode, avec pause et reprise. Le temps écoulé se
// déduit de l'horloge (et non d'un compteur de ticks) : un onglet ralenti ne fait pas dériver la séance. Les sons suivent les
// changements de phase. La séance est enregistrée dans l'historique une seule fois, quand elle va jusqu'au bout ; la quitter
// avant la fin n'enregistre rien. Pour recommencer, l'écran remonte ce hook (nouvelle clé) : aucun état à remettre à zéro.
export function useSessionRespiration(methode: Methode | null, cycles: number, deps: DepsSession = {}) {
  // Dépendances figées à la création : des fonctions recréées à chaque rendu relanceraient les minuteries à chaque changement d'état
  const [{ db, maintenant, aujourdhui, pasMs, secondesDecompte }] = useState(() => ({
    db: deps.db,
    maintenant: deps.maintenant ?? (() => performance.now()),
    aujourdhui: deps.aujourdhui ?? aujourdhuiParDefaut,
    pasMs: deps.pasMs ?? 100,
    secondesDecompte: deps.secondesDecompte ?? 5,
  }))
  const config = useMemo(() => (methode ? configDe(methode, cycles) : null), [methode, cycles])
  const [audio] = useState<AudioRespiration>(() => deps.audio ?? (typeof window === 'undefined' ? audioMuet : creerAudio()))

  const [statut, setStatut] = useState<StatutSession>('decompte')
  const [decompte, setDecompte] = useState(secondesDecompte)
  const [etat, setEtat] = useState<EtatSession | null>(null)
  const [dureeSec, setDureeSec] = useState(0)
  const [erreurEnregistrement, setErreurEnregistrement] = useState<string | null>(null)

  const chrono = useRef({ debut: 0, accumule: 0 })
  const cleTon = useRef('')
  const enregistree = useRef(false)

  const ecoule = useCallback(() => chrono.current.accumule + (maintenant() - chrono.current.debut), [maintenant])

  const terminer = useCallback(() => {
    if (!config || !methode || enregistree.current) return
    enregistree.current = true
    // Durée de respiration (pauses exclues) : c'est la durée de la séance, que la séance ait été mise en pause ou non
    const duree = Math.max(1, Math.round(dureeTotaleMs(config) / 1000))
    setDureeSec(duree)
    setStatut('termine')
    enregistrerSeance(db ?? getDb(), { methodeId: methode.id, methodeNom: methode.nom, cycles: config.cycles, dureeSec: duree, date: aujourdhui() }).catch(
      (e: unknown) => {
        console.error("Enregistrement de la séance de respiration impossible", e)
        setErreurEnregistrement(MESSAGE_ECHEC_ENREGISTREMENT)
      },
    )
  }, [config, methode, db, aujourdhui])

  // Applique un état : l'affiche, déclenche le son à chaque nouvelle phase, termine la séance au dernier instant.
  const appliquer = useCallback(
    (e: EtatSession) => {
      setEtat(e)
      if (e.termine) {
        cleTon.current = ''
        audio.arreterTon()
        terminer()
        return
      }
      const cle = `${e.cycle}|${e.phase}`
      if (cle !== cleTon.current) {
        cleTon.current = cle
        audio.demarrerTon(e.phase, e.dureePhaseMs - e.progressionMs)
      }
    },
    [audio, terminer],
  )

  // Décompte 5 → 1, un bip par seconde, puis départ de la séance
  useEffect(() => {
    if (!config || statut !== 'decompte') return
    let restant = secondesDecompte
    audio.tic()
    const id = setInterval(() => {
      restant -= 1
      if (restant > 0) {
        setDecompte(restant)
        audio.tic()
        return
      }
      clearInterval(id)
      setDecompte(0)
      chrono.current = { debut: maintenant(), accumule: 0 }
      setStatut('en_cours')
      appliquer(etatA(config, 0))
    }, 1000)
    return () => clearInterval(id)
  }, [config, statut, secondesDecompte, audio, maintenant, appliquer])

  // Séance en cours : état recalculé à chaque pas
  useEffect(() => {
    if (!config || statut !== 'en_cours') return
    const id = setInterval(() => appliquer(etatA(config, ecoule())), pasMs)
    return () => clearInterval(id)
  }, [config, statut, pasMs, ecoule, appliquer])

  // Sortie de l'écran : plus de son
  useEffect(() => () => audio.liberer(), [audio])

  const pause = useCallback(() => {
    if (statut !== 'en_cours') return
    chrono.current = { debut: chrono.current.debut, accumule: ecoule() }
    cleTon.current = ''
    audio.arreterTon()
    setStatut('pause')
  }, [statut, ecoule, audio])

  const reprendre = useCallback(() => {
    if (statut !== 'pause' || !config) return
    chrono.current = { debut: maintenant(), accumule: chrono.current.accumule }
    setStatut('en_cours')
    // Le son reprend pour le temps restant de la phase en cours
    appliquer(etatA(config, chrono.current.accumule))
  }, [statut, config, maintenant, appliquer])

  return { statut, decompte, etat, config, dureeSec, erreurEnregistrement, pause, reprendre }
}
