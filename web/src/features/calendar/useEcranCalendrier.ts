import { useCallback, useState } from 'react'
import { useAuth } from '../../core/auth/AuthProvider'
import { useImagePanda } from '../../core/images/usePandaVariante'
import { moisDe, moisPrecedent, moisSuivant, formaterJourLong, formaterMois, isoDepuisParties, type Mois } from './grille'
import type { InstanceVue } from './types'
import { useCalendar, type DepsCalendrier } from './useCalendar'

// Orchestration de l'écran : mois affiché, jour choisi, dialogues « changer la date » et « supprimer ».
// Aucune logique dans les composants : ils ne font qu'afficher cet état.
export function useEcranCalendrier(deps: DepsCalendrier = {}) {
  const maintenant = (deps.nowFn ?? (() => new Date()))()
  const aujourdhui = isoDepuisParties(maintenant.getFullYear(), maintenant.getMonth() + 1, maintenant.getDate())

  const [mois, setMois] = useState<Mois>(() => moisDe(aujourdhui))
  const [jourChoisi, setJourChoisi] = useState<string | null>(null)
  const cal = useCalendar(mois, deps)
  const { session } = useAuth()
  const pandaRepos = useImagePanda('pose_sitting', { db: deps.db, userId: session?.user.id, taille: 'sm' })
  const { deplacer, supprimerInstance } = cal

  // Sans choix explicite, le jour sélectionné est aujourd'hui s'il est dans le mois affiché
  const jourSelectionne =
    jourChoisi ?? cal.jours.find((j) => j.estAujourdhui && j.dansLeMois)?.dateIso ?? null
  const detail = cal.jours.find((j) => j.dateIso === jourSelectionne) ?? null

  const aller = useCallback((m: Mois) => {
    setMois(m)
    setJourChoisi(null)
  }, [])

  const [cibleDate, setCibleDate] = useState<InstanceVue | null>(null)
  const [dateSaisie, setDateSaisie] = useState('')
  const [cibleSuppression, setCibleSuppression] = useState<InstanceVue | null>(null)
  const [enCours, setEnCours] = useState(false)

  const ouvrirDate = (i: InstanceVue) => {
    setDateSaisie(i.dateIso)
    setCibleDate(i)
  }
  const fermerDate = () => setCibleDate(null)
  const fermerSuppression = () => setCibleSuppression(null)

  // Succès ou échec, le dialogue se ferme : l'erreur éventuelle s'affiche en haut de l'écran.
  const confirmerDate = useCallback(async () => {
    if (!cibleDate || enCours) return
    setEnCours(true)
    try {
      await deplacer(cibleDate.id, dateSaisie)
      setCibleDate(null)
    } finally {
      setEnCours(false)
    }
  }, [cibleDate, dateSaisie, enCours, deplacer])

  const confirmerSuppression = useCallback(async () => {
    if (!cibleSuppression || enCours) return
    setEnCours(true)
    try {
      await supprimerInstance(cibleSuppression.id)
      setCibleSuppression(null)
    } finally {
      setEnCours(false)
    }
  }, [cibleSuppression, enCours, supprimerInstance])

  const nbInstancesMois = cal.jours.filter((j) => j.dansLeMois).reduce((n, j) => n + j.instances.length, 0)

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
    aucuneSeanceCeMois: nbInstancesMois === 0,
    pandaRepos,
    cibleDate, dateSaisie, setDateSaisie, ouvrirDate, fermerDate, confirmerDate,
    cibleSuppression, ouvrirSuppression: setCibleSuppression, fermerSuppression, confirmerSuppression,
    enCours,
  }
}
