import { useCallback, useEffect, useMemo, useState } from 'react'
import { getDb } from '../../core/db/client'
import type { Db } from '../../core/db/Db'
import { newId } from '../../core/db/ids'
import { listExercises } from '../../core/db/repos/exercises'
import type { Exercise } from '../../core/db/types'
import { FILTRE_INITIAL, filtrerExercices } from './catalog/filtreCatalogue'
import {
  ajouterBloc as ajouterBlocDraft, ajouterExercice as ajouterExerciceDraft, brouillonVide,
  deplacerBloc as deplacerBlocDraft, deplacerExercice, deplacerExerciceRelatif, modifierBloc as modifierBlocDraft,
  modifierExercice as modifierExerciceDraft, nouveauBloc, nouvelExercice, supprimerBloc as supprimerBlocDraft,
  supprimerExercice as supprimerExerciceDraft, validerBrouillon, type BlocDraft, type ExerciceDraft, type SeanceDraft,
  type TypeBloc,
} from './draft'
import { chargerBrouillon, enregistrerBrouillon, musclesExercice } from './seanceStore'

export interface DepsEditionSeance {
  /** Base à utiliser (défaut : base de l'application, résolue à l'usage). */
  db?: Db
}

type PatchBloc = Partial<Omit<BlocDraft, 'id' | 'exercices'>>
type PatchExercice = Partial<Omit<ExerciceDraft, 'id'>>

// Édition d'un modèle de séance (création si `seanceId` est null). Toute la logique d'ordre,
// de validation et d'écriture vit dans draft.ts et seanceStore.ts ; ce hook ne fait que l'orchestrer.
export function useSeanceEdit(seanceId: string | null, { db }: DepsEditionSeance = {}) {
  const [draft, setDraft] = useState<SeanceDraft>(() => brouillonVide(newId()))
  const [catalogueComplet, setCatalogueComplet] = useState<Exercise[]>([])
  const [recherche, setRecherche] = useState('')
  const [charge, setCharge] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [enregistrement, setEnregistrement] = useState(false)

  useEffect(() => {
    let annule = false
    const base = db ?? getDb()
    listExercises(base)
      .then(async (liste) => {
        const existant = seanceId === null ? null : await chargerBrouillon(base, seanceId, liste)
        if (annule) return
        setCatalogueComplet(liste)
        if (seanceId !== null) {
          if (existant) setDraft(existant)
          else setErreur('Séance introuvable.')
        }
        setCharge(true)
      })
      .catch((e: unknown) => {
        console.error('Chargement de la séance impossible', e)
        if (!annule) {
          setErreur('Le chargement de la séance a échoué.')
          setCharge(true)
        }
      })
    return () => {
      annule = true
    }
  }, [db, seanceId])

  const catalogue = useMemo(() => filtrerExercices(catalogueComplet, { ...FILTRE_INITIAL, query: recherche }), [catalogueComplet, recherche])

  const setNom = useCallback((nom: string) => setDraft((d) => ({ ...d, nom })), [])
  const setNotes = useCallback((notes: string) => setDraft((d) => ({ ...d, notes })), [])
  const setDuree = useCallback((dureeEstimeeMin: number) => setDraft((d) => ({ ...d, dureeEstimeeMin })), [])

  const ajouterBloc = useCallback(
    (type: TypeBloc = 'ECHAUFFEMENT') => setDraft((d) => ajouterBlocDraft(d, nouveauBloc(newId(), type))),
    [],
  )
  const supprimerBloc = useCallback((blocId: string) => setDraft((d) => supprimerBlocDraft(d, blocId)), [])
  const modifierBloc = useCallback((blocId: string, patch: PatchBloc) => setDraft((d) => modifierBlocDraft(d, blocId, patch)), [])
  const deplacerBloc = useCallback((blocId: string, versPosition: number) => setDraft((d) => deplacerBlocDraft(d, blocId, versPosition)), [])

  // Un exercice absent du catalogue chargé est ignoré (ne peut pas être choisi dans le sélecteur).
  const ajouterExercice = useCallback(
    (blocId: string, exerciseId: string) => {
      const exo = catalogueComplet.find((e) => e.id === exerciseId)
      if (!exo) return
      setDraft((d) => {
        const bloc = d.blocs.find((b) => b.id === blocId)
        if (!bloc) return d
        const ligne = nouvelExercice(
          newId(),
          { id: exo.id, name: exo.name, muscles: musclesExercice(exo), isBodyweight: exo.isBodyweight },
          bloc.type,
        )
        return ajouterExerciceDraft(d, blocId, ligne)
      })
    },
    [catalogueComplet],
  )
  const supprimerExercice = useCallback((id: string) => setDraft((d) => supprimerExerciceDraft(d, id)), [])
  const modifierExercice = useCallback((id: string, patch: PatchExercice) => setDraft((d) => modifierExerciceDraft(d, id, patch)), [])
  const deplacer = useCallback(
    (exerciceId: string, versPosition: number, versBlocId?: string) => setDraft((d) => deplacerExercice(d, exerciceId, versPosition, versBlocId)),
    [],
  )
  const monter = useCallback((id: string) => setDraft((d) => deplacerExerciceRelatif(d, id, -1)), [])
  const descendre = useCallback((id: string) => setDraft((d) => deplacerExerciceRelatif(d, id, 1)), [])

  // Valide puis écrit. Renvoie l'id de la séance, ou null (message dans `erreur`) : rien n'est jamais lancé.
  const enregistrer = useCallback(async (): Promise<string | null> => {
    if (enregistrement) return null
    if (seanceId !== null && !draft.existante) {
      setErreur('Séance introuvable.')
      return null
    }
    const erreurs = validerBrouillon(draft)
    if (erreurs.length > 0) {
      setErreur(erreurs.join('\n'))
      return null
    }
    setErreur(null)
    setEnregistrement(true)
    try {
      const id = await enregistrerBrouillon(db ?? getDb(), draft)
      setDraft((d) => ({ ...d, existante: true }))
      return id
    } catch (e) {
      console.error("Enregistrement de la séance impossible", e)
      setErreur("L'enregistrement a échoué.")
      return null
    } finally {
      setEnregistrement(false)
    }
  }, [db, draft, enregistrement, seanceId])

  return {
    draft, charge, erreur, enregistrement, catalogue, recherche, setRecherche,
    setNom, setNotes, setDuree,
    ajouterBloc, supprimerBloc, modifierBloc, deplacerBloc,
    ajouterExercice, supprimerExercice, modifierExercice, deplacer, monter, descendre,
    enregistrer,
  }
}
