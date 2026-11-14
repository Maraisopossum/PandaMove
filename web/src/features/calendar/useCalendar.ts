import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getDb } from '../../core/db/client'
import type { Db } from '../../core/db/Db'
import { compterProgrammees, supprimerProgrammees } from '../../core/db/repos/seancesCardio'
import type { ChampsSeanceCardio, GenreCardio, SaisieSeanceCardio } from '../../core/db/repos/seancesCardio'
import {
  creerSeanceCardio, deplacerEvenement, ErreurCalendrier, lireEvenementsPlage, lireEvenementsProchains, modifierSeanceCardio,
  supprimerEvenement, validerEvenement,
} from './calendrier'
import { messageRefusDeplacement, peutDeplacer } from './evenements'
import { construireGrille, isoDepuisParties, type Mois } from './grille'
import type { EvenementAgenda, Filtre, JourVue } from './types'

export interface DepsCalendrier {
  /** Base à utiliser (défaut : base de l'application, résolue à l'usage). */
  db?: Db
  /** Horloge injectable pour « aujourd'hui ». */
  nowFn?: () => Date
}

const NB_PROCHAINES = 10

interface Donnees {
  evenements: EvenementAgenda[]
  prochaines: EvenementAgenda[]
}

const aujourdhuiIso = (maintenant: Date) =>
  isoDepuisParties(maintenant.getFullYear(), maintenant.getMonth() + 1, maintenant.getDate())

// Calendrier du mois : grille de semaines (lundi en premier), événements (renforcement, course, vélo) rattachés à leur
// date planifiée, « prochaines séances », filtre de statut, et actions sur un événement (déplacer, supprimer, valider...).
// La base n'expose pas d'observation : les données sont relues après chaque action. Les actions renvoient true si elles
// ont réussi ; sinon le message français est dans `erreur` (jamais de rejet non géré).
export function useCalendar(mois: Mois, { db, nowFn }: DepsCalendrier = {}) {
  const { year, month } = mois
  const [donnees, setDonnees] = useState<Donnees>({ evenements: [], prochaines: [] })
  const [cleChargee, setCleChargee] = useState<string | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [filtre, setFiltreEtat] = useState<Filtre>({ statut: 'toutes' })
  const sequence = useRef(0)

  const aujourdhui = aujourdhuiIso((nowFn ?? (() => new Date()))())
  const squelette = useMemo(() => construireGrille({ year, month }, aujourdhui), [year, month, aujourdhui])
  const debut = squelette[0].dateIso
  const fin = squelette[squelette.length - 1].dateIso

  // Clé de la plage affichée : « chargement » tant que les données lues ne correspondent pas à elle
  const cle = `${debut}|${fin}|${aujourdhui}`
  const chargement = cleChargee !== cle

  // Lecture des trois sources en une passe ; seule la dernière demande est appliquée (changement de mois rapide).
  // Les lectures ne forment pas une transaction : une écriture entre deux lectures peut montrer une séance en double ou
  // manquante jusqu'à la relecture qui suit chaque action.
  const lire = useCallback(async () => {
    const numero = ++sequence.current
    const base = db ?? getDb()
    const [evenements, prochaines] = await Promise.all([
      lireEvenementsPlage(base, debut, fin),
      lireEvenementsProchains(base, aujourdhui, NB_PROCHAINES),
    ])
    if (numero === sequence.current) setDonnees({ evenements, prochaines })
  }, [db, debut, fin, aujourdhui])

  useEffect(() => {
    let annule = false
    lire()
      .catch((e: unknown) => {
        console.error('Chargement du calendrier impossible', e)
        if (!annule) setErreur('Le chargement du calendrier a échoué.')
      })
      .finally(() => {
        if (!annule) setCleChargee(cle)
      })
    return () => {
      annule = true
    }
  }, [lire, cle])

  // Exécute une écriture puis relit ; toute erreur finit dans `erreur`. Renvoie true si l'action a réussi.
  const agir = useCallback(
    async (ecrire: (base: Db) => Promise<unknown>, echec: string): Promise<boolean> => {
      setErreur(null)
      try {
        await ecrire(db ?? getDb())
        await lire()
        return true
      } catch (e) {
        if (e instanceof ErreurCalendrier) setErreur(e.message)
        else {
          console.error(echec, e)
          setErreur(echec)
        }
        return false
      }
    },
    [db, lire],
  )

  const deplacer = useCallback(
    (evenement: EvenementAgenda, dateIso: string) =>
      agir((base) => deplacerEvenement(base, evenement, dateIso), 'Le déplacement de la séance a échoué.'),
    [agir],
  )
  const supprimer = useCallback(
    (evenement: EvenementAgenda) => agir((base) => supprimerEvenement(base, evenement), 'La suppression de la séance a échoué.'),
    [agir],
  )
  // Séances de cardio programmées (toutes dates) : décompte pour la confirmation, puis suppression en une transaction.
  const compterCardioProgrammees = useCallback(() => compterProgrammees(db ?? getDb()), [db])
  const supprimerCardioProgrammees = useCallback(
    () => agir((base) => supprimerProgrammees(base), 'La suppression des séances programmées a échoué.'),
    [agir],
  )
  const validerCardio = useCallback(
    (evenement: EvenementAgenda) => agir((base) => validerEvenement(base, evenement, true), 'La validation de la séance a échoué.'),
    [agir],
  )
  const devaliderCardio = useCallback(
    (evenement: EvenementAgenda) => agir((base) => validerEvenement(base, evenement, false), 'La dévalidation de la séance a échoué.'),
    [agir],
  )
  const creerCardio = useCallback(
    (genre: GenreCardio, saisie: SaisieSeanceCardio) =>
      agir((base) => creerSeanceCardio(base, genre, saisie), "L'ajout de la séance a échoué."),
    [agir],
  )
  const modifierCardio = useCallback(
    (evenement: EvenementAgenda, champs: ChampsSeanceCardio) =>
      agir((base) => modifierSeanceCardio(base, evenement, champs), 'La modification de la séance a échoué.'),
    [agir],
  )

  // Avant d'ouvrir le dialogue de déplacement : si l'événement ne peut pas bouger (séance de cardio validée), le message
  // s'affiche à la place et le dialogue ne s'ouvre pas. Le déplacement relit de toute façon l'état à l'écriture.
  const verifierDeplacement = useCallback((evenement: EvenementAgenda): boolean => {
    if (peutDeplacer(evenement)) {
      setErreur(null)
      return true
    }
    setErreur(messageRefusDeplacement(evenement))
    return false
  }, [])

  // Efface le message d'une action précédente (à l'ouverture d'un dialogue de saisie).
  const effacerErreur = useCallback(() => setErreur(null), [])

  const setFiltre = useCallback((f: Filtre) => setFiltreEtat(f), [])

  const jours: JourVue[] = useMemo(() => {
    const garde = (e: EvenementAgenda) =>
      filtre.statut === 'toutes' || (filtre.statut === 'terminees' ? e.etat === 'terminee' : e.etat !== 'terminee')
    const parDate = new Map<string, EvenementAgenda[]>()
    for (const e of donnees.evenements.filter(garde)) parDate.set(e.dateIso, [...(parDate.get(e.dateIso) ?? []), e])
    return squelette.map((j) => ({ ...j, evenements: parDate.get(j.dateIso) ?? [] }))
  }, [squelette, donnees.evenements, filtre])

  return {
    chargement, erreur, jours, prochaines: donnees.prochaines, filtre, setFiltre,
    /** Tous les événements de la grille (filtre de statut non appliqué) et premier jour de la grille : charge estimée. */
    evenements: donnees.evenements, debutGrille: debut,
    deplacer, supprimer, compterCardioProgrammees, supprimerCardioProgrammees, validerCardio, devaliderCardio, creerCardio, modifierCardio, verifierDeplacement, effacerErreur,
  }
}
