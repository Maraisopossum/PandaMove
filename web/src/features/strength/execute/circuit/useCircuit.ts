import { useCallback, useEffect, useRef, useState } from 'react'
import type { Brouillon, SerieHisto } from '../lignesSeries'
import { useWakeLock } from '../useWakeLock'
import type { ExerciceVue, Mesures } from '../vue'
import { creerSonneur, type Sonneur } from './audio'
import { affichage as calculerAffichage, arreter as arreterMachine, avancer, demarrer, INACTIF, type Affichage, type EffetValider, type EtatCircuit } from './machine'
import { construirePlan, type Cible } from './plan'
import { DEFAUTS, type ReglagesCircuit } from './reglages'
import { creerRetours, creerVibreur, creerVoix, type Retours, type Vibreur, type Voix } from './retours'

export interface EntreesCircuit {
  exercices: ExerciceVue[]
  precedentes: ReadonlyMap<string, SerieHisto[]>
  brouillons: Readonly<Record<string, Brouillon>>
  /** Validation d'une série : le même chemin d'écriture que le bouton « Valider » du tableau (useExecute.validerSerie). */
  valider: (exerciceId: string, mesures: Mesures, numero: number, cote: string) => Promise<boolean>
  /** Efface la saisie en cours d'une ligne que le circuit vient de valider. */
  oublierBrouillon: (exerciceId: string, numero: number) => void
  /** Démarre le chronomètre de séance s'il ne tourne pas encore (idempotent côté base). */
  demarrerSeance: () => Promise<boolean>
  /** Notifie l'exercice affiché par le circuit (l'écran le sélectionne dans la barre). */
  surExercice: (exerciceId: string) => void
  /** Son, vibration, voix (défauts si absent) */
  reglages?: ReglagesCircuit
}

export interface OptionsCircuit {
  nowFn?: () => number
  /** Période de recalcul de l'affichage (ms) : un déclencheur de rendu, jamais une source de temps. */
  tickMs?: number
  sonneur?: Sonneur
  vibreur?: Vibreur
  voix?: Voix
}

// Lit Date.now à chaque appel (et non une référence figée à l'import) : horloges simulées des tests comprises
const maintenantParDefaut = () => Date.now()

// Au-delà de cet écart entre deux recalculs (onglet suspendu, écran verrouillé), on ne rejoue pas les bips.
const ECART_BIPS_MS = 1500

const MESSAGES = {
  circuit: {
    terminee: 'Circuit terminé : toutes les séries sont enregistrées.',
    arretee: 'Circuit arrêté : les séries déjà validées sont conservées.',
    echec: "Circuit interrompu : la série n'a pas pu être enregistrée.",
  },
  seul: {
    terminee: 'Minuteur terminé : série enregistrée.',
    arretee: 'Minuteur arrêté.',
    echec: "Minuteur interrompu : la série n'a pas pu être enregistrée.",
  },
} as const

// Pilote la machine à états pure : horloge injectée, recalcul périodique ET au retour de visibilité,
// écritures des séries validées par la même voie que la validation manuelle (file sérialisée), bips,
// écran gardé allumé. L'état du circuit n'est pas persisté : un rechargement l'abandonne, les séries
// déjà écrites restent et le circuit se relance (à la première série restante) sans doublon.
export function useCircuit(entrees: EntreesCircuit, { nowFn = maintenantParDefaut, tickMs = 250, sonneur, vibreur, voix }: OptionsCircuit = {}) {
  const [aff, setAff] = useState<Affichage | null>(null)
  // Erreur de lancement, valable tant que les saisies n'ont pas changé (corriger la durée la fait disparaître)
  const [erreurLue, setErreur] = useState<{ message: string; brouillons: EntreesCircuit['brouillons'] } | null>(null)
  const [message, setMessage] = useState('')
  const [retours] = useState<Retours>(() =>
    creerRetours({ sonneur: sonneur ?? creerSonneur(), vibreur: vibreur ?? creerVibreur(), voix: voix ?? creerVoix() }),
  )

  const dernieres = useRef(entrees)
  useEffect(() => {
    dernieres.current = entrees
  })
  const etat = useRef<EtatCircuit>(INACTIF)
  const mode = useRef<'circuit' | 'seul'>('circuit')
  const affPrecedent = useRef<Affichage | null>(null)
  const instantPrecedent = useRef<number | null>(null)
  const exerciceSignale = useRef<string | null>(null)
  const file = useRef<Promise<unknown>>(Promise.resolve())
  // Un lancement = un lot : une écriture refusée coupe les écritures suivantes du MÊME lot seulement
  const lot = useRef({ echec: false })
  const vivant = useRef(true)

  const ecrire = useCallback((effet: EffetValider, courant: { echec: boolean }) => {
    const tache = async () => {
      if (courant.echec) return
      const e = dernieres.current
      let ok = false
      try {
        ok = await e.valider(effet.exerciceId, { reps: effet.secondes, chargeKg: effet.chargeKg, rpe: null }, effet.numero, effet.cote)
      } catch (err) {
        console.error('Validation automatique impossible', err)
      }
      if (ok) {
        e.oublierBrouillon(effet.exerciceId, effet.numero)
        return
      }
      courant.echec = true
      retours.arreter()
      if (!vivant.current) return
      etat.current = arreterMachine(etat.current)
      setMessage(MESSAGES[mode.current].echec)
      affPrecedent.current = null
      setAff(null)
    }
    file.current = file.current.then(tache, tache)
  }, [retours])

  // Recalcule depuis l'heure courante : fait avancer la machine, écrit les séries échues, sonne, rend.
  const recalculer = useCallback(() => {
    if (!vivant.current) return
    const maintenant = nowFn()
    const avant = etat.current
    const r = avancer(avant, maintenant)
    etat.current = r.etat
    for (const effet of r.effets) ecrire(effet, lot.current)
    const nouvelle = calculerAffichage(r.etat, maintenant)
    // Premier calcul d'un lancement (instant précédent inconnu) : on annonce le début
    const proche = instantPrecedent.current === null || maintenant - instantPrecedent.current <= ECART_BIPS_MS
    const termine = avant.phase !== 'inactif' && r.etat.phase === 'inactif' && r.etat.fin === 'terminee'
    if (proche) retours.appliquer(affPrecedent.current, nouvelle, { termine, mode: mode.current }, dernieres.current.reglages ?? DEFAUTS)
    instantPrecedent.current = maintenant
    if (avant.phase !== 'inactif' && r.etat.phase === 'inactif' && r.etat.fin) setMessage(MESSAGES[mode.current][r.etat.fin])
    if (nouvelle && nouvelle.phase !== 'repos' && nouvelle.exerciceId !== exerciceSignale.current) {
      exerciceSignale.current = nouvelle.exerciceId
      dernieres.current.surExercice(nouvelle.exerciceId)
    }
    const ancienne = affPrecedent.current
    affPrecedent.current = nouvelle
    if (!(ancienne && nouvelle && ancienne.cle === nouvelle.cle && ancienne.restantSec === nouvelle.restantSec)) setAff(nouvelle)
  }, [nowFn, ecrire, retours])

  const actif = aff !== null
  useEffect(() => {
    if (!actif) return
    const id = setInterval(recalculer, tickMs)
    const surVisibilite = () => {
      if (document.visibilityState === 'visible') recalculer()
    }
    document.addEventListener('visibilitychange', surVisibilite)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', surVisibilite)
    }
  }, [actif, recalculer, tickMs])

  useEffect(() => {
    vivant.current = true
    return () => {
      vivant.current = false
      retours.fermer()
    }
  }, [retours])

  useWakeLock(actif)

  const lancer = useCallback(
    (cible: Cible) => {
      if (etat.current.phase !== 'inactif') return
      const e = dernieres.current
      const r = construirePlan(cible, e.exercices, e.precedentes, e.brouillons)
      if ('erreur' in r) {
        setErreur({ message: r.erreur, brouillons: e.brouillons })
        return
      }
      setErreur(null)
      setMessage('')
      // Geste utilisateur (clic de lancement) : débloque audio et voix malgré les restrictions d'autoplay
      retours.preparer(e.reglages ?? DEFAUTS)
      void e.demarrerSeance()
      mode.current = r.plan.mode
      lot.current = { echec: false }
      exerciceSignale.current = null
      affPrecedent.current = null
      instantPrecedent.current = null
      etat.current = demarrer(r.plan, r.depart, nowFn())
      recalculer()
    },
    [nowFn, recalculer, retours],
  )

  const arreter = useCallback(() => {
    if (etat.current.phase === 'inactif') return
    // Écrit d'abord ce qui est déjà échu (un exercice fini entre deux recalculs ne doit pas être perdu)
    const r = avancer(etat.current, nowFn())
    for (const effet of r.effets) ecrire(effet, lot.current)
    const termine = r.etat.phase === 'inactif'
    etat.current = termine ? r.etat : arreterMachine(r.etat)
    retours.arreter()
    setMessage(MESSAGES[mode.current][termine ? 'terminee' : 'arretee'])
    affPrecedent.current = null
    setAff(null)
  }, [nowFn, ecrire, retours])

  const erreur = erreurLue && erreurLue.brouillons === entrees.brouillons ? erreurLue.message : null
  return { affichage: aff, actif, erreur, message, lancer, arreter }
}
