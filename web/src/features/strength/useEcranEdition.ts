import { useCallback, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useAuth } from '../../core/auth/AuthProvider'
import { libelleMuscle } from './catalog/libelles'
import { blocsDe, groupesMusculaires, peutDeplacer, type BlocDraft } from './draft'
import type { ActionsBloc } from './edition/BlocCarte'
import type { ActionsExercice } from './edition/ExerciceCarte'
import { useAvertissementFermeture } from './edition/useAvertissementFermeture'
import { useEchauffement } from './edition/useEchauffement'
import { useSelecteurExercices } from './edition/useSelecteurExercices'
import { useSuppressionBloc } from './edition/useSuppressionBloc'
import { useSeanceEdit } from './useSeanceEdit'

// Orchestration de l'écran d'édition : séance (id de la route, absent = création), sélecteur d'exercices,
// échauffements, suppression de bloc confirmée, garde de sortie et retour à la liste après enregistrement.
// `enInstance` : la route porte l'id d'une séance EN COURS (modifier ses exercices) et non celui d'un modèle.
export function useEcranEdition(enInstance = false) {
  const { id } = useParams()
  const navigate = useNavigate()
  const { session } = useAuth()
  const edition = useSeanceEdit(enInstance ? null : (id ?? null), { userId: session?.user.id, instanceId: enInstance ? (id ?? '') : undefined })
  // Retour : à la séance en cours pour une modification d'instance, à la liste sinon
  const retour = enInstance ? `/strength/instance/${id ?? ''}` : '/strength'
  const { draft, catalogueComplet, materiel, ajouterExercices, supprimerBloc, insererEchauffement, enregistrer } = edition

  const selecteur = useSelecteurExercices({
    catalogue: catalogueComplet,
    categoriesPossedees: materiel.selectedCategories,
    ajouter: ajouterExercices,
  })
  const echauffement = useEchauffement({ catalogue: catalogueComplet, inserer: insererEchauffement })
  const suppressionBloc = useSuppressionBloc(supprimerBloc)
  useAvertissementFermeture(edition.modifie)

  const blocCible = selecteur.cible === null ? undefined : blocsDe(draft).find((b) => b.id === selecteur.cible)
  const titreSelecteur = blocCible ? `Dans le bloc « ${blocCible.nom || 'sans nom'} »` : 'Hors bloc : exercices libres dans la séance'

  // Groupes travaillés, dérivés des exercices (ils sont aussi enregistrés avec la séance)
  const groupesAffiches = useMemo(() => groupesMusculaires(draft).map(libelleMuscle), [draft])

  const soumettre = useCallback(async () => {
    const idEnregistre = await enregistrer()
    if (idEnregistre !== null) await navigate(retour)
  }, [enregistrer, navigate, retour])
  // Confirmation de la perte des séries d'exercices retirés d'une séance en cours
  const confirmerPertes = useCallback(async () => {
    const idEnregistre = await enregistrer(true)
    if (idEnregistre !== null) await navigate(retour)
  }, [enregistrer, navigate, retour])
  const annuler = useCallback(() => navigate(retour), [navigate, retour])

  const { modifierBloc, changerTypeBloc, deplacer, modifierExercice, transformerExercice, dupliquer, supprimerExercice } = edition
  const ouvrirSelecteur = selecteur.ouvrir
  const demanderSuppression = suppressionBloc.demander

  const peutDeplacerId = useCallback((cible: string, sens: -1 | 1) => peutDeplacer(draft, cible, sens), [draft])

  const actionsBloc = useCallback(
    (bloc: BlocDraft): ActionsBloc => ({
      onModifier: (patch) => modifierBloc(bloc.id, patch),
      onChangerType: (type) => changerTypeBloc(bloc.id, type),
      onMonter: () => deplacer(bloc.id, -1),
      onDescendre: () => deplacer(bloc.id, 1),
      onSupprimer: () => demanderSuppression(bloc),
      onAjouterExercices: () => ouvrirSelecteur(bloc.id),
    }),
    [changerTypeBloc, demanderSuppression, deplacer, modifierBloc, ouvrirSelecteur],
  )

  const actionsExercice = useCallback(
    (exerciceId: string): ActionsExercice => ({
      onChange: (patch) => modifierExercice(exerciceId, patch),
      onTransformer: (transformer) => transformerExercice(exerciceId, transformer),
      onDupliquer: () => dupliquer(exerciceId),
      onMonter: () => deplacer(exerciceId, -1),
      onDescendre: () => deplacer(exerciceId, 1),
      onSupprimer: () => supprimerExercice(exerciceId),
    }),
    [deplacer, dupliquer, modifierExercice, supprimerExercice, transformerExercice],
  )

  return {
    ...edition, enCreation: !enInstance && id === undefined, confirmerPertes, groupesAffiches, selecteur, titreSelecteur, echauffement, suppressionBloc,
    peutDeplacer: peutDeplacerId, actionsBloc, actionsExercice, soumettre, annuler,
  }
}
