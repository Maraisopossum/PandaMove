import { useCallback, useEffect, useRef, useState } from 'react'
import { getDb } from '../../core/db/client'
import type { Db } from '../../core/db/Db'
import { newId } from '../../core/db/ids'
import { listExercises } from '../../core/db/repos/exercises'
import { getInstance } from '../../core/db/repos/instances'
import { getSettings } from '../../core/db/repos/settings'
import type { Exercise } from '../../core/db/types'
import { lireEquipementStocke, type EquipmentStocke } from '../../core/import/equipment'
import { lireListeEquipement } from './progression/cible'
import {
  ajouterBloc as ajouterBlocDraft, ajouterExercice as ajouterExerciceDraft, appliquerSeriesCircuit,
  blocsDe, brouillonVide, exercicesDe, changerTypeBloc as changerTypeBlocDraft, deplacerRelatif, dupliquerExercice,
  modifierBloc as modifierBlocDraft, modifierExercice as modifierExerciceDraft, nouveauBloc, nouvelExercice,
  insererBlocAuDebut, renumeroter, supprimerBloc as supprimerBlocDraft, supprimerExercice as supprimerExerciceDraft,
  transformerExercice as transformerExerciceDraft, validerBrouillon,
  type BlocDraft, type ExerciceDraft, type SeanceDraft, type TypeBloc,
} from './draft'
import { chargerBrouillon, compterSeriesPerdues, enregistrerBrouillon, ErreurEditionInstance, musclesExercice } from './seanceStore'

export interface DepsEditionSeance {
  /** Base à utiliser (défaut : base de l'application, résolue à l'usage). */
  db?: Db
  /** Utilisateur dont on lit « Mon matériel » (indice de charge, aperçu de montée, filtre du sélecteur). */
  userId?: string
  /**
   * Modifier les exercices d'une séance EN COURS (instance) au lieu du modèle : seules les lignes de cette instance
   * sont lues et écrites, jamais le modèle. `seanceId` est alors déduit de l'instance (passer null).
   */
  instanceId?: string
}

type PatchBloc = Partial<Omit<BlocDraft, 'id' | 'exercices'>>
type PatchExercice = Partial<Omit<ExerciceDraft, 'id'>>

// Forme comparable d'un brouillon : positions renumérotées, séries de circuit appliquées (ce qui sera écrit).
const empreinte = (d: SeanceDraft) => JSON.stringify(renumeroter(appliquerSeriesCircuit(d)))

// Édition d'un modèle de séance (création si `seanceId` est null). Toute la logique d'ordre,
// de validation et d'écriture vit dans draft.ts et seanceStore.ts ; ce hook ne fait que l'orchestrer.
export function useSeanceEdit(seanceId: string | null, { db, userId, instanceId }: DepsEditionSeance = {}) {
  const enInstance = instanceId !== undefined
  const [draft, setDraft] = useState<SeanceDraft>(() => brouillonVide(newId()))
  const [catalogueComplet, setCatalogueComplet] = useState<Exercise[]>([])
  const [materiel, setMateriel] = useState<EquipmentStocke>(() => lireEquipementStocke(null))
  const [charge, setCharge] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [enregistrement, setEnregistrement] = useState(false)
  // Séance en cours : exercices retirés qui ont des séries validées, en attente de confirmation
  const [pertes, setPertes] = useState<{ exercices: number; series: number } | null>(null)
  // Empreinte de la version chargée / enregistrée : sert à savoir s'il reste des modifications
  const [reference, setReference] = useState<string | null>(null)
  // Lisible depuis un garde de navigation, sans attendre le rendu suivant
  const modifieRef = useRef(false)

  useEffect(() => {
    let annule = false
    const base = db ?? getDb()
    Promise.all([
      listExercises(base),
      userId ? getSettings(base, userId).then((s) => lireEquipementStocke(s.equipmentJson)) : Promise.resolve(lireEquipementStocke(null)),
    ])
      .then(async ([liste, stocke]) => {
        let existant: SeanceDraft | null = null
        let message: string | null = null
        if (instanceId !== undefined) {
          // Séance en cours : on édite les lignes de l'instance, tant qu'elle n'est pas terminée
          const instance = await getInstance(base, instanceId)
          if (!instance) message = 'Séance introuvable.'
          else if (instance.isCompleted) message = "Cette séance est terminée : elle n'est plus modifiable."
          else {
            existant = await chargerBrouillon(base, instance.seanceId, liste, instanceId)
            if (!existant) message = 'Séance introuvable.'
          }
        } else if (seanceId !== null) {
          existant = await chargerBrouillon(base, seanceId, liste)
          if (!existant) message = 'Séance introuvable.'
        }
        if (annule) return
        setCatalogueComplet(liste)
        setMateriel(stocke)
        if (existant) {
          setDraft(existant)
          setReference(empreinte(existant))
        } else {
          if (message) setErreur(message)
          setReference(null)
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
  }, [db, seanceId, userId, instanceId])

  // Séance neuve : référence = brouillon vide d'origine, posée au premier rendu chargé
  const [origineNeuve] = useState(() => empreinte(draft))
  const modifie = charge && empreinte(draft) !== (reference ?? origineNeuve)
  useEffect(() => {
    modifieRef.current = modifie
  }, [modifie])

  const setNom = useCallback((nom: string) => setDraft((d) => ({ ...d, nom })), [])
  const setNotes = useCallback((notes: string) => setDraft((d) => ({ ...d, notes })), [])
  const setDuree = useCallback((dureeEstimeeMin: number) => setDraft((d) => ({ ...d, dureeEstimeeMin })), [])

  const ajouterBloc = useCallback((type: TypeBloc) => setDraft((d) => ajouterBlocDraft(d, nouveauBloc(newId(), type))), [])
  const supprimerBloc = useCallback((blocId: string) => setDraft((d) => supprimerBlocDraft(d, blocId)), [])
  const modifierBloc = useCallback((blocId: string, patch: PatchBloc) => setDraft((d) => modifierBlocDraft(d, blocId, patch)), [])
  const changerTypeBloc = useCallback((blocId: string, type: TypeBloc) => setDraft((d) => changerTypeBlocDraft(d, blocId, type)), [])

  // Ajoute les exercices choisis DANS L'ORDRE DE LA SÉLECTION (jamais trié) ; `blocId` null : exercices libres.
  // Un exercice absent du catalogue chargé est ignoré.
  const ajouterExercices = useCallback(
    (blocId: string | null, exerciseIds: string[]) => {
      const parId = new Map(catalogueComplet.map((e) => [e.id, e]))
      setDraft((d) => {
        const bloc = blocId === null ? null : blocsDe(d).find((b) => b.id === blocId)
        if (blocId !== null && !bloc) return d
        const typeBloc = bloc?.type ?? null
        return exerciseIds.reduce((acc, exerciseId) => {
          const exo = parId.get(exerciseId)
          if (!exo) return acc
          const ligne = nouvelExercice(
            newId(),
            { id: exo.id, name: exo.name, muscles: musclesExercice(exo), equipment: lireListeEquipement(exo.equipment), isBodyweight: exo.isBodyweight },
            typeBloc,
          )
          return ajouterExerciceDraft(acc, blocId, ligne)
        }, d)
      })
    },
    [catalogueComplet],
  )
  const supprimerExercice = useCallback((id: string) => setDraft((d) => supprimerExerciceDraft(d, id)), [])
  const modifierExercice = useCallback((id: string, patch: PatchExercice) => setDraft((d) => modifierExerciceDraft(d, id, patch)), [])
  const transformerExercice = useCallback(
    (id: string, transformer: (e: ExerciceDraft) => ExerciceDraft) => setDraft((d) => transformerExerciceDraft(d, id, transformer)),
    [],
  )
  const insererEchauffement = useCallback((bloc: BlocDraft) => setDraft((d) => insererBlocAuDebut(d, bloc)), [])
  const dupliquer = useCallback((id: string) => setDraft((d) => dupliquerExercice(d, id, newId())), [])
  // Monte (-1) ou descend (+1) un bloc, un exercice libre ou un exercice dans son bloc
  const deplacer = useCallback((id: string, sens: -1 | 1) => setDraft((d) => deplacerRelatif(d, id, sens)), [])

  // Valide puis écrit. Renvoie l'id de la séance, ou null (message dans `erreur`) : rien n'est jamais lancé.
  // En séance en cours, `confirmerPertes` accepte de supprimer les séries validées des exercices retirés.
  const enregistrer = useCallback(async (confirmerPertes = false): Promise<string | null> => {
    if (enregistrement) return null
    if ((seanceId !== null || enInstance) && !draft.existante) {
      setErreur('Séance introuvable.')
      return null
    }
    // Une séance en cours vidée de ses exercices serait recopiée depuis le modèle à la réouverture
    if (enInstance && exercicesDe(draft).length === 0) {
      setErreur('Une séance doit garder au moins un exercice.')
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
      const base = db ?? getDb()
      if (enInstance && !confirmerPertes) {
        const perdues = await compterSeriesPerdues(base, instanceId, draft)
        if (perdues.series > 0) {
          setPertes(perdues)
          return null
        }
      }
      setPertes(null)
      const id = await enregistrerBrouillon(base, draft, enInstance ? instanceId : null)
      const enregistre = { ...renumeroter(appliquerSeriesCircuit(draft)), existante: true }
      // Plus rien à perdre : le garde de sortie doit laisser partir tout de suite
      modifieRef.current = false
      setDraft(enregistre)
      setReference(empreinte(enregistre))
      return id
    } catch (e) {
      if (e instanceof ErreurEditionInstance) setErreur(e.message)
      else {
        console.error("Enregistrement de la séance impossible", e)
        setErreur("L'enregistrement a échoué.")
      }
      return null
    } finally {
      setEnregistrement(false)
    }
  }, [db, draft, enInstance, enregistrement, instanceId, seanceId])

  return {
    draft, charge, erreur, enregistrement, modifie, modifieRef, catalogueComplet, materiel, enInstance,
    pertes, annulerPertes: () => setPertes(null),
    setNom, setNotes, setDuree,
    ajouterBloc, supprimerBloc, modifierBloc, changerTypeBloc,
    ajouterExercices, supprimerExercice, modifierExercice, transformerExercice, insererEchauffement, dupliquer, deplacer,
    enregistrer,
  }
}
