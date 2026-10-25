import { useAuth } from '../../core/auth/AuthProvider'
import { useImagePanda } from '../../core/images/usePandaVariante'
import { formaterJourCourt } from '../calendar/grille'
import { detailsTerminee } from './listesInstances'
import { useListeInstances, type DepsListeInstances, type TypeListeInstances } from './useListeInstances'

export interface LigneInstance {
  id: string
  nom: string
  /** « lun. 26 oct. » */
  date: string
  enCours: boolean
  /** Durée et séries validées (séances terminées uniquement) */
  details: string | null
  lien: string
}

const TEXTES = {
  programmees: { titre: 'Séances programmées', texteVide: 'Aucune séance programmée.' },
  terminees: { titre: 'Séances terminées', texteVide: 'Aucune séance terminée pour le moment.' },
} as const

// Orchestration des écrans « Séances programmées » et « Séances terminées » : lignes prêtes à afficher
// (une séance programmée ouvre l'exécution, une terminée ouvre son bilan) et panda de l'état vide.
export function useEcranListeInstances(type: TypeListeInstances, deps: DepsListeInstances = {}) {
  const liste = useListeInstances(type, deps)
  const { session } = useAuth()
  const pandaVide = useImagePanda('pose_sitting', { db: deps.db, userId: session?.user.id, taille: 'sm' })

  const lignes: LigneInstance[] = liste.instances.map((i) => {
    const enCours = i.etat === 'en_cours'
    const terminee = i.etat === 'terminee'
    return {
      id: i.id,
      nom: i.nom,
      date: formaterJourCourt(i.dateIso),
      enCours,
      details: terminee ? detailsTerminee(i) : null,
      lien: terminee ? `/strength/instance/${i.id}/report` : `/strength/instance/${i.id}`,
    }
  })

  return {
    ...TEXTES[type],
    chargement: liste.chargement,
    erreur: liste.erreur,
    recharger: liste.recharger,
    lignes,
    // État vide uniquement après une lecture réussie (jamais pendant le chargement ni en cas d'erreur)
    vide: !liste.chargement && liste.erreur === null && lignes.length === 0,
    pandaVide,
  }
}
