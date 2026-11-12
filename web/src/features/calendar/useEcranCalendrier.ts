import { useCallback, useRef, useState } from 'react'
import { useAuth } from '../../core/auth/AuthProvider'
import { useImagePanda } from '../../core/images/usePandaVariante'
import { moisDe, moisPrecedent, moisSuivant, formaterJourLong, formaterMois, isoDepuisParties, type Mois } from './grille'
import {
  brouillonDepuis, brouillonVide, type BrouillonSeanceCardio, type ChampBrouillon, type ErreursSaisie, validerBrouillon,
} from './seancesCardio/saisieCardio'
import type { EvenementAgenda, EvenementCardio } from './types'
import { useCalendar, type DepsCalendrier } from './useCalendar'

/** Dialogue de saisie d'une séance de cardio : création, ou modification d'une séance existante. */
export interface EtatSaisie {
  mode: 'creation' | 'edition'
  brouillon: BrouillonSeanceCardio
  erreurs: ErreursSaisie
}

// Orchestration de l'écran : mois affiché, jour choisi, dialogues « changer la date », « supprimer » et saisie d'une
// séance de cardio (création ou modification).
// Aucune logique dans les composants : ils ne font qu'afficher cet état.
export function useEcranCalendrier(deps: DepsCalendrier = {}) {
  const maintenant = (deps.nowFn ?? (() => new Date()))()
  const aujourdhui = isoDepuisParties(maintenant.getFullYear(), maintenant.getMonth() + 1, maintenant.getDate())

  const [mois, setMois] = useState<Mois>(() => moisDe(aujourdhui))
  const [jourChoisi, setJourChoisi] = useState<string | null>(null)
  const cal = useCalendar(mois, deps)
  const { session } = useAuth()
  const pandaRepos = useImagePanda('pose_sitting', { db: deps.db, userId: session?.user.id, taille: 'sm' })
  const { deplacer, supprimer, verifierDeplacement } = cal

  // Sans choix explicite, le jour sélectionné est aujourd'hui s'il est dans le mois affiché
  const jourSelectionne =
    jourChoisi ?? cal.jours.find((j) => j.estAujourdhui && j.dansLeMois)?.dateIso ?? null
  const detail = cal.jours.find((j) => j.dateIso === jourSelectionne) ?? null

  const aller = useCallback((m: Mois) => {
    setMois(m)
    setJourChoisi(null)
  }, [])

  const [cibleDate, setCibleDate] = useState<EvenementAgenda | null>(null)
  const [dateSaisie, setDateSaisie] = useState('')
  const [cibleSuppression, setCibleSuppression] = useState<EvenementAgenda | null>(null)
  const [enCours, setEnCours] = useState(false)
  // Suppression de toutes les séances de cardio programmées : nombre à confirmer (null : dialogue fermé)
  const [nbAEffacer, setNbAEffacer] = useState<number | null>(null)

  // Un événement qui ne peut pas bouger (séance de cardio validée) n'ouvre pas le dialogue : le message s'affiche à la place.
  const ouvrirDate = (e: EvenementAgenda) => {
    if (!verifierDeplacement(e)) return
    setDateSaisie(e.dateIso)
    setCibleDate(e)
  }
  const fermerDate = () => setCibleDate(null)
  const fermerSuppression = () => setCibleSuppression(null)

  // Succès ou échec, le dialogue se ferme : l'erreur éventuelle s'affiche en haut de l'écran.
  const confirmerDate = useCallback(async () => {
    if (!cibleDate || enCours) return
    setEnCours(true)
    try {
      await deplacer(cibleDate, dateSaisie)
      setCibleDate(null)
    } finally {
      setEnCours(false)
    }
  }, [cibleDate, dateSaisie, enCours, deplacer])

  const confirmerSuppression = useCallback(async () => {
    if (!cibleSuppression || enCours) return
    setEnCours(true)
    try {
      await supprimer(cibleSuppression)
      setCibleSuppression(null)
    } finally {
      setEnCours(false)
    }
  }, [cibleSuppression, enCours, supprimer])

  // Saisie d'une séance de cardio. Le brouillon est validé ici, avant tout envoi : un message par champ.
  const [saisie, setSaisie] = useState<EtatSaisie | null>(null)
  const [cibleEdition, setCibleEdition] = useState<EvenementCardio | null>(null)
  const enregistrementEnCours = useRef(false)

  const ouvrirAjout = () => {
    cal.effacerErreur()
    setCibleEdition(null)
    setSaisie({ mode: 'creation', brouillon: brouillonVide(jourSelectionne ?? aujourdhui), erreurs: {} })
  }
  // Une séance de renforcement se modifie depuis ses séances, pas ici.
  const ouvrirEdition = (e: EvenementAgenda) => {
    if (e.genre === 'renfo') return
    cal.effacerErreur()
    setCibleEdition(e)
    setSaisie({ mode: 'edition', brouillon: brouillonDepuis(e), erreurs: {} })
  }
  const changerBrouillon = (partiel: Partial<BrouillonSeanceCardio>) =>
    setSaisie((s) => {
      if (!s) return s
      const erreurs = { ...s.erreurs }
      for (const champ of Object.keys(partiel)) delete erreurs[champ as ChampBrouillon]
      return { ...s, brouillon: { ...s.brouillon, ...partiel }, erreurs }
    })
  const fermerSaisie = () => {
    setSaisie(null)
    setCibleEdition(null)
  }

  // Valide, puis crée ou modifie. En cas d'échec d'écriture le dialogue reste ouvert (le message est dans `erreur`).
  // Après une création, l'écran affiche le mois et le jour de la nouvelle séance. Un second envoi pendant le premier est ignoré.
  const enregistrer = async () => {
    if (!saisie || enregistrementEnCours.current) return
    const resultat = validerBrouillon(saisie.brouillon, saisie.mode)
    if (!resultat.ok) {
      setSaisie({ ...saisie, erreurs: resultat.erreurs })
      return
    }
    enregistrementEnCours.current = true
    setEnCours(true)
    try {
      const creation = saisie.mode === 'creation'
      const reussi = creation
        ? await cal.creerCardio(saisie.brouillon.genre, resultat.saisie)
        : cibleEdition !== null && (await cal.modifierCardio(cibleEdition, resultat.champs))
      if (!reussi) return
      if (creation) {
        const m = moisDe(resultat.saisie.date)
        if (m.year !== mois.year || m.month !== mois.month) setMois(m)
        setJourChoisi(resultat.saisie.date)
      }
      fermerSaisie()
    } finally {
      enregistrementEnCours.current = false
      setEnCours(false)
    }
  }

  const { compterCardioProgrammees, supprimerCardioProgrammees } = cal
  const ouvrirEffacerProgrammees = async () => {
    try {
      setNbAEffacer(await compterCardioProgrammees())
    } catch (e) {
      console.error('Décompte des séances programmées impossible', e)
    }
  }
  const confirmerEffacerProgrammees = async () => {
    if (enCours) return
    setEnCours(true)
    try {
      await supprimerCardioProgrammees()
      setNbAEffacer(null)
    } finally {
      setEnCours(false)
    }
  }

  const nbEvenementsMois = cal.jours.filter((j) => j.dansLeMois).reduce((n, j) => n + j.evenements.length, 0)

  return {
    ...cal,
    titreMois: formaterMois(mois),
    precedent: () => aller(moisPrecedent(mois)),
    suivant: () => aller(moisSuivant(mois)),
    auj: () => aller(moisDe(aujourdhui)),
    choisirJour: setJourChoisi,
    jourSelectionne,
    titreDetail: detail ? formaterJourLong(detail.dateIso) : null,
    detail,
    aucuneSeanceCeMois: nbEvenementsMois === 0,
    pandaRepos,
    cibleDate, dateSaisie, setDateSaisie, ouvrirDate, fermerDate, confirmerDate,
    cibleSuppression, ouvrirSuppression: setCibleSuppression, fermerSuppression, confirmerSuppression,
    saisie, ouvrirAjout, ouvrirEdition, changerBrouillon, fermerSaisie, enregistrer,
    enCours,
    nbAEffacer, ouvrirEffacerProgrammees, fermerEffacerProgrammees: () => setNbAEffacer(null), confirmerEffacerProgrammees,
  }
}
