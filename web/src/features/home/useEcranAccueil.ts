import { useEffect, useState } from 'react'
import { useAuth } from '../../core/auth/AuthProvider'
import { dateIsoLocale } from '../../core/common/dates'
import { getDb } from '../../core/db/client'
import type { DbLecture } from '../../core/db/Db'
import { useImagePanda } from '../../core/images/usePandaVariante'
import { lireEvenementsPlage, lireEvenementsProchains } from '../calendar/calendrier'
import type { EvenementAgenda } from '../calendar/types'
import { bornesSemaine, construireSemaine, libelleJour, type Semaine } from './semaine'

export interface ProchaineSeance {
  evenement: EvenementAgenda
  /** « Aujourd'hui », « Demain » ou « vendredi 6 nov. ». */
  quand: string
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

  return { panda, prochaine, semaine }
}
