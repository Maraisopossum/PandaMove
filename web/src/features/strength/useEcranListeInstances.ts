import { useCallback, useState } from 'react'
import { useAuth } from '../../core/auth/AuthProvider'
import { getDb } from '../../core/db/client'
import { useImagePanda } from '../../core/images/usePandaVariante'
import { deplacerInstance, ErreurCalendrier } from '../calendar/calendrier'
import { formaterJourCourt } from '../calendar/grille'
import { ErreurSeance } from './affectation'
import { detailsTerminee } from './listesInstances'
import { supprimerInstanceRenforcement } from './suppression'
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
  /** « Pull du lun. 26 oct. » : désigne la séance dans les noms accessibles et les dialogues */
  designation: string
  /** Seules les séances non terminées peuvent changer de date (la date d'une terminée ancre les statistiques) */
  peutChangerDate: boolean
  /** Date planifiée (yyyy-MM-dd) */
  dateIso: string
}

const TEXTES = {
  programmees: { titre: 'Séances programmées', texteVide: 'Aucune séance programmée.' },
  terminees: { titre: 'Séances terminées', texteVide: 'Aucune séance terminée pour le moment.' },
} as const

// Orchestration des écrans « Séances programmées » et « Séances terminées » : lignes prêtes à afficher
// (une séance programmée ouvre l'exécution, une terminée ouvre son bilan), panda de l'état vide, changement de date
// (séances non terminées) et suppression après confirmation.
export function useEcranListeInstances(type: TypeListeInstances, deps: DepsListeInstances = {}) {
  const liste = useListeInstances(type, deps)
  const { session } = useAuth()
  const pandaVide = useImagePanda('pose_sitting', { db: deps.db, userId: session?.user.id, taille: 'sm' })
  const { recharger } = liste
  const base = deps.db

  const [erreurAction, setErreurAction] = useState<string | null>(null)
  const [enCours, setEnCours] = useState(false)
  const [aDeplacer, setADeplacer] = useState<{ ligne: LigneInstance; date: string } | null>(null)
  const [aSupprimer, setASupprimer] = useState<LigneInstance | null>(null)

  // Écriture suivie d'un rechargement ; message français en cas d'échec. Renvoie true en cas de succès.
  const agir = useCallback(
    async (ecrire: () => Promise<void>, echec: string): Promise<boolean> => {
      setErreurAction(null)
      setEnCours(true)
      try {
        await ecrire()
        await recharger()
        return true
      } catch (e) {
        if (e instanceof ErreurSeance || e instanceof ErreurCalendrier) setErreurAction(e.message)
        else {
          console.error(echec, e)
          setErreurAction(echec)
        }
        return false
      } finally {
        setEnCours(false)
      }
    },
    [recharger],
  )

  const demanderDeplacement = useCallback((ligne: LigneInstance) => {
    setErreurAction(null)
    setADeplacer({ ligne, date: ligne.dateIso })
  }, [])
  const choisirDate = useCallback((date: string) => setADeplacer((d) => (d ? { ...d, date } : d)), [])
  const fermerDeplacement = useCallback(() => setADeplacer(null), [])
  const confirmerDeplacement = useCallback(async () => {
    if (!aDeplacer || enCours) return
    const { ligne, date } = aDeplacer
    const ok = await agir(() => deplacerInstance(base ?? getDb(), ligne.id, date), 'Le changement de date a échoué.')
    // Échec (date invalide, séance disparue) : le message s'affiche et le dialogue reste ouvert pour corriger
    if (ok) setADeplacer(null)
  }, [aDeplacer, agir, base, enCours])

  const demanderSuppression = useCallback((ligne: LigneInstance) => {
    setErreurAction(null)
    setASupprimer(ligne)
  }, [])
  const fermerSuppression = useCallback(() => setASupprimer(null), [])
  const confirmerSuppression = useCallback(async () => {
    if (!aSupprimer || enCours) return
    await agir(() => supprimerInstanceRenforcement(base ?? getDb(), aSupprimer.id), 'La suppression a échoué.')
    setASupprimer(null)
  }, [aSupprimer, agir, base, enCours])

  const lignes: LigneInstance[] = liste.instances.map((i) => {
    const enCoursDeSeance = i.etat === 'en_cours'
    const terminee = i.etat === 'terminee'
    return {
      id: i.id,
      nom: i.nom,
      date: formaterJourCourt(i.dateIso),
      enCours: enCoursDeSeance,
      details: terminee ? detailsTerminee(i) : null,
      lien: terminee ? `/strength/instance/${i.id}/report` : `/strength/instance/${i.id}`,
      designation: `${i.nom} du ${formaterJourCourt(i.dateIso)}`,
      peutChangerDate: !terminee,
      dateIso: i.dateIso,
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
    erreurAction,
    enCours,
    aDeplacer,
    aSupprimer,
    demanderDeplacement,
    choisirDate,
    fermerDeplacement,
    confirmerDeplacement,
    demanderSuppression,
    fermerSuppression,
    confirmerSuppression,
  }
}
