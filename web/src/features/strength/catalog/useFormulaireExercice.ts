import { useCallback, useState } from 'react'
import { ErreurExercice, type NewExercise } from '../../../core/db/repos/exercises'
import type { Exercise } from '../../../core/db/types'
import { lireGroupes } from './filtreCatalogue'

export interface BrouillonExercice {
  name: string
  category: string
  muscleGroups: string[]
  musclePrimary: string
  description: string
  exerciseType: string
  equipment: string
  isBodyweight: boolean
}

const VIDE: BrouillonExercice = {
  name: '', category: 'OTHER', muscleGroups: [], musclePrimary: '', description: '', exerciseType: '', equipment: '', isBodyweight: false,
}

const listeJson = (texte: string): string[] => lireGroupes(texte)

// Équipement saisi en texte libre, séparé par des virgules.
const versListe = (texte: string) => texte.split(',').map((m) => m.trim()).filter((m) => m !== '')

export function versNouvelExercice(b: BrouillonExercice): NewExercise {
  return {
    name: b.name,
    category: b.category,
    muscleGroups: b.muscleGroups,
    musclePrimary: b.musclePrimary,
    description: b.description,
    exerciseType: b.exerciseType,
    equipment: versListe(b.equipment),
    isBodyweight: b.isBodyweight,
  }
}

interface Actions {
  creerPersonnalise: (e: NewExercise) => Promise<void>
  modifier: (id: string, e: NewExercise) => Promise<void>
}

// Formulaire de création / modification d'un exercice : brouillon, validation côté dépôt, erreur affichable.
export function useFormulaireExercice({ creerPersonnalise, modifier }: Actions) {
  const [ouvert, setOuvert] = useState(false)
  const [idEdite, setIdEdite] = useState<string | null>(null)
  const [brouillon, setBrouillon] = useState<BrouillonExercice>(VIDE)
  const [erreur, setErreur] = useState<string | null>(null)

  const nouveau = useCallback(() => {
    setIdEdite(null)
    setBrouillon(VIDE)
    setErreur(null)
    setOuvert(true)
  }, [])

  const editer = useCallback((e: Exercise) => {
    setIdEdite(e.id)
    setBrouillon({
      name: e.name,
      category: e.category || 'OTHER',
      muscleGroups: lireGroupes(e.muscleGroups),
      musclePrimary: e.musclePrimary,
      description: e.description,
      exerciseType: e.exerciseType,
      equipment: listeJson(e.equipment).join(', '),
      isBodyweight: e.isBodyweight,
    })
    setErreur(null)
    setOuvert(true)
  }, [])

  const fermer = useCallback(() => setOuvert(false), [])

  const basculerMuscle = useCallback((muscle: string, coche: boolean) => {
    setBrouillon((b) => {
      const sans = b.muscleGroups.filter((m) => m !== muscle)
      return { ...b, muscleGroups: coche ? [...sans, muscle] : sans }
    })
  }, [])

  const soumettre = useCallback(async () => {
    setErreur(null)
    const donnees = versNouvelExercice(brouillon)
    try {
      if (idEdite) await modifier(idEdite, donnees)
      else await creerPersonnalise(donnees)
      setOuvert(false)
    } catch (e) {
      if (e instanceof ErreurExercice) setErreur(e.message)
      else {
        console.error("Enregistrement de l'exercice impossible", e)
        setErreur("L'enregistrement a échoué.")
      }
    }
  }, [brouillon, idEdite, modifier, creerPersonnalise])

  return { ouvert, enEdition: idEdite !== null, brouillon, setBrouillon, erreur, nouveau, editer, fermer, basculerMuscle, soumettre }
}

// Suppression logique d'un exercice, après confirmation ; l'échec est exposé dans `erreur`.
export function useSuppressionExercice(supprimer: (id: string) => Promise<void>) {
  const [erreur, setErreur] = useState<string | null>(null)
  const demander = useCallback(
    async (e: Exercise) => {
      setErreur(null)
      if (!window.confirm(`Supprimer l'exercice « ${e.name} » ?`)) return
      try {
        await supprimer(e.id)
      } catch (err) {
        console.error("Suppression de l'exercice impossible", err)
        setErreur('La suppression a échoué.')
      }
    },
    [supprimer],
  )
  return { demander, erreur }
}
