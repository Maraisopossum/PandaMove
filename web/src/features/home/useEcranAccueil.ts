import { useEffect, useState } from 'react'
import { useAuth } from '../../core/auth/AuthProvider'
import { dateIsoLocale } from '../../core/common/dates'
import { getDb } from '../../core/db/client'
import type { DbLecture } from '../../core/db/Db'
import { useImagePanda } from '../../core/images/usePandaVariante'
import { lireEvenementsPlage, lireEvenementsProchains } from '../calendar/calendrier'
import type { EvenementAgenda } from '../calendar/types'
import { lireSorties } from '../../core/db/repos/sorties'
import { lireReglagesCharge } from '../endurance/useChargeEntrainement'
import { lireProgressionObjectifs, type ProgressionObjectif } from '../profile/objectifs'
import { fenetresBilan, indicateursBilan, lireBilan, type Indicateur } from './bilanSemaine'
import { lirePropositions, type Proposition } from './propositionsDuJour'
import { calculerFormeJour, lireDerniereActivite, type DerniereActivite, type FormeJour } from './donneesAccueil'
import { bornesSemaine, construireSemaine, libelleJour, type Semaine } from './semaine'

export interface ProchaineSeance {
  evenement: EvenementAgenda
  /** « Aujourd'hui », « Demain » ou « vendredi 6 nov. ». */
  quand: string
}

// « Jeudi 5 novembre » : jour de la semaine et date, première lettre en capitale.
export function dateLongue(d: Date): string {
  const texte = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).format(d)
  return texte.charAt(0).toUpperCase() + texte.slice(1)
}

export interface DepsAccueil {
  /** Base à lire (défaut : base de l'application, résolue à l'usage). */
  db?: DbLecture
  maintenant?: () => Date
}

// Accueil : panda joyeux de la variante choisie dans le profil, prochaine séance (tous sports) et rythme de la semaine.
// Les deux blocs d'agenda n'apparaissent que s'il y a quelque chose à montrer ; une lecture qui échoue les masque sans
// bloquer l'accueil.
export function useEcranAccueil({ db, maintenant = () => new Date() }: DepsAccueil = {}) {
  const { session } = useAuth()
  const panda = useImagePanda('joy', { userId: session?.user.id, taille: 'sm' })
  const [prochaine, setProchaine] = useState<ProchaineSeance | null>(null)
  const [semaine, setSemaine] = useState<Semaine | null>(null)
  const [indicateurs, setIndicateurs] = useState<Indicateur[] | null>(null)
  const [forme, setForme] = useState<FormeJour | null>(null)
  const [derniere, setDerniere] = useState<DerniereActivite | null>(null)
  const [propositions, setPropositions] = useState<Proposition[]>([])
  const [objectifs, setObjectifs] = useState<ProgressionObjectif[]>([])
  const [date] = useState(() => dateLongue(maintenant()))

  useEffect(() => {
    let annule = false
    const aujourdhui = dateIsoLocale(maintenant())
    const base = db ?? getDb()
    const { debut, fin } = bornesSemaine(aujourdhui)
    void Promise.all([lireEvenementsProchains(base, aujourdhui, 1), lireEvenementsPlage(base, debut, fin)])
      .then(([prochains, evenements]) => {
        if (annule) return
        setProchaine(prochains[0] ? { evenement: prochains[0], quand: libelleJour(prochains[0].dateIso, aujourdhui) } : null)
        const s = construireSemaine(aujourdhui, evenements)
        setSemaine(s.total > 0 ? s : null)
      })
      .catch((e: unknown) => console.error("Lecture de l'agenda de l'accueil impossible", e))
    return () => {
      annule = true
    }
    // La date du jour est lue une fois au montage : l'accueil se recharge à chaque visite
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db])

  // Bilan chiffré, forme et dernière activité : chaque carte se masque seule si sa lecture échoue
  useEffect(() => {
    let annule = false
    const aujourdhui = dateIsoLocale(maintenant())
    const base = db ?? getDb()
    const { courante, precedente } = fenetresBilan(aujourdhui)
    void Promise.all([lireBilan(base, courante), lireBilan(base, precedente), lireEvenementsPlage(base, bornesSemaine(aujourdhui).debut, bornesSemaine(aujourdhui).fin)])
      .then(([c, p, evenements]) => {
        if (!annule) setIndicateurs(indicateursBilan(c, p, evenements.length))
      })
      .catch((e: unknown) => console.error('Bilan de la semaine impossible', e))
    void lireSorties(base)
      .then((sorties) => {
        if (!annule) setForme(calculerFormeJour(sorties, lireReglagesCharge(), aujourdhui))
      })
      .catch((e: unknown) => console.error('Forme du jour impossible', e))
    void lirePropositions(base, maintenant())
      .then((p) => {
        if (!annule) setPropositions(p)
      })
      .catch((e: unknown) => console.error('Propositions du jour impossibles', e))
    void lireProgressionObjectifs(base, maintenant())
      .then((o) => {
        if (!annule) setObjectifs(o)
      })
      .catch((e: unknown) => console.error('Objectifs de la semaine impossibles', e))
    void lireDerniereActivite(base, aujourdhui)
      .then((d) => {
        if (!annule) setDerniere(d)
      })
      .catch((e: unknown) => console.error('Dernière activité impossible', e))
    return () => {
      annule = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db])

  return { panda, prochaine, semaine, date, indicateurs, forme, derniere, propositions, objectifs }
}
