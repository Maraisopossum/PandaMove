import { useCallback, useEffect, useRef, useState } from 'react'
import { getDb } from '../../../core/db/client'
import type { Db } from '../../../core/db/Db'
import { getInstance } from '../../../core/db/repos/instances'
import { getSeanceTree } from '../../../core/db/repos/seances'
import { listSeries } from '../../../core/db/repos/series'
import type { InstanceSeance } from '../../../core/db/types'
import type { PropositionProgression } from '../../../core/progression/engine'
import type { DecisionEnregistree } from '../../../core/progression/marqueur'
import { construireVue } from '../execute/vue'
import type { Decision } from '../progression/cible'
import {
  appliquerDecision, evaluerEtAppliquerSilencieux, evaluerInstance, type EvaluationExercice,
} from '../progression/evaluation'
import { resumerSeance, type ResumeSeance } from './bilan'

export interface DepsReport {
  /** Base à utiliser (défaut : base de l'application). Référence stable. */
  db?: Db
  /** Utilisateur connecté : lecture de « Mon matériel ». Sans utilisateur, aucun inventaire. */
  userId?: string
  /** Horloge (epoch ms). Référence stable ; injectée par les tests. */
  nowFn?: () => number
}

export type EtatProposition = 'en_attente' | DecisionEnregistree

export interface LigneBilan {
  exerciceId: string
  nom: string
  seriesPrevues: number
  seriesRealisees: number
  statut: 'complet' | 'partiel' | 'aucune'
}

export interface PropositionBilan {
  /** Id de la ligne exercices_seance de l'instance */
  exerciceId: string
  nom: string
  /** null pour un exercice déjà décidé (la cible a changé depuis : pas de ré-évaluation) */
  proposition: PropositionProgression | null
  /** requiresValidation(proposition) — jamais déduit du statut seul */
  aValider: boolean
  /** Oui / Non / Ajuster proposés : à valider, pas NON_LOGGE (lecture seule, comme Android), non décidé */
  actionnable: boolean
  etat: EtatProposition
  /** La décision avait déjà été enregistrée ailleurs quand l'utilisateur a choisi (« Déjà décidé ») */
  dejaDecide: boolean
}

interface Donnees {
  trouvee: boolean
  terminee: boolean
  nomSeance: string
  resume: ResumeSeance
  exercices: LigneBilan[]
  propositions: PropositionBilan[]
  // Évaluation des propositions actionnables (par exerciceId), pour écrire une décision
  evaluations: Map<string, EvaluationExercice>
}

const VIDE: Donnees = {
  trouvee: false,
  terminee: false,
  nomSeance: '',
  resume: { tonnageKg: 0, seriesTotal: 0, dureeSec: 0 },
  exercices: [],
  propositions: [],
  evaluations: new Map(),
}

// Erreur destinée à l'utilisateur (message français affiché tel quel).
class ErreurBilan extends Error {}

const CHARGE_INVALIDE = 'La charge doit être un nombre de kg strictement positif.'

function statutLigne(prevues: number, realisees: number): LigneBilan['statut'] {
  if (realisees === 0) return 'aucune'
  return realisees >= prevues ? 'complet' : 'partiel'
}

// Une instance est évaluable sur le web si elle y a été exécutée (horloge started_at, jamais écrite
// par l'import) : une instance terminée importée d'Android a déjà reçu sa progression avant
// finishInstance, elle n'est jamais ré-évaluée (même sans marqueur, si importée avant la migration 0005).
const evaluable = (i: InstanceSeance) => i.startedAt !== null

// Propositions du récap : décisions enregistrées affichées telles quelles ; les autres exercices sont
// évalués en LECTURE SEULE (aucune écriture silencieuse ici : elles ont lieu à « Terminer »).
async function propositionsDe(
  db: Db,
  instance: InstanceSeance,
  ordre: string[],
  userId: string | undefined,
): Promise<{ propositions: PropositionBilan[]; evaluations: Map<string, EvaluationExercice> }> {
  const evaluations = new Map<string, EvaluationExercice>()
  if (!evaluable(instance)) return { propositions: [], evaluations }
  const decisions = instance.progression?.decisions ?? {}
  const rang = (id: string) => ordre.indexOf(id)
  const propositions = (await evaluerInstance(db, instance.id, userId))
    .sort((a, b) => rang(a.exerciceId) - rang(b.exerciceId))
    .map((e): PropositionBilan => {
      const decidee = decisions[e.exerciceId]
      if (decidee) {
        return { exerciceId: e.exerciceId, nom: e.nom, proposition: null, aValider: false, actionnable: false, etat: decidee, dejaDecide: false }
      }
      const actionnable = e.aValider && e.proposition.statut !== 'NON_LOGGE'
      if (actionnable) evaluations.set(e.exerciceId, e)
      return { exerciceId: e.exerciceId, nom: e.nom, proposition: e.proposition, aValider: e.aValider, actionnable, etat: 'en_attente', dejaDecide: false }
    })
  return { propositions, evaluations }
}

async function lire(db: Db, instanceId: string, userId: string | undefined, maintenantMs: number): Promise<Donnees> {
  let instance = await getInstance(db, instanceId)
  if (!instance) throw new ErreurBilan('Séance introuvable.')
  const seance = await db.getOptional<{ nom: string }>('SELECT nom FROM seances WHERE id = ? AND deleted_at IS NULL', [
    instance.seanceId,
  ])
  const base = { ...VIDE, trouvee: true, nomSeance: seance?.nom ?? 'Séance' }
  if (!instance.isCompleted) return base

  // Cas hérité : instance web terminée AVANT la migration 0005 (marqueur absent). Elle est évaluée une
  // seule fois ici, avec la même transaction + marqueur qu'à « Terminer » (revérifié dans la transaction).
  if (evaluable(instance) && !instance.progression?.evaluee) {
    await db.writeTransaction((tx) => evaluerEtAppliquerSilencieux(tx, instanceId, { userId, maintenantMs }))
    instance = (await getInstance(db, instanceId)) ?? instance
  }

  // Lignes D'INSTANCE uniquement (jamais le modèle), séries dédoublonnées à la lecture
  const arbre = await getSeanceTree(db, instance.seanceId, instanceId)
  const series = await listSeries(db, instanceId)
  const idsExercices = [...new Set(arbre.exercices.map((e) => e.exerciseId))]
  const noms = new Map(
    idsExercices.length === 0
      ? []
      : (
          await db.getAll<{ id: string; name: string }>(
            `SELECT id, name FROM exercises WHERE deleted_at IS NULL AND id IN (${idsExercices.map(() => '?').join(', ')})`,
            idsExercices,
          )
        ).map((n) => [n.id, n.name]),
  )
  // Ordre d'affichage de l'exécution (blocs puis positions)
  const vue = construireVue(arbre.blocs, arbre.exercices, [], noms)
  const parId = new Map(arbre.exercices.map((e) => [e.id, e]))
  const ordonnes = vue.exercices.flatMap((v) => {
    const e = parId.get(v.id)
    return e ? [e] : []
  })
  const terminees = (id: string) => series.filter((s) => s.exerciceSeanceId === id && s.isCompleted).length
  const exercices = ordonnes.map((e) => ({
    exerciceId: e.id,
    nom: noms.get(e.exerciseId) ?? 'Exercice inconnu',
    seriesPrevues: e.nombreSeriesPrevues,
    seriesRealisees: terminees(e.id),
    statut: statutLigne(e.nombreSeriesPrevues, terminees(e.id)),
  }))
  const { propositions, evaluations } = await propositionsDe(db, instance, ordonnes.map((e) => e.id), userId)
  return {
    ...base,
    terminee: true,
    resume: resumerSeance(arbre.exercices, series, instance.durationSeconds),
    exercices,
    propositions,
    evaluations,
  }
}

// Bilan d'une séance terminée et récap de progression (spec §5). Le bilan PRÉSENTE et fait DÉCIDER :
// chaque décision (Oui / Non / Ajuster) écrit l'objectif et l'enregistre dans le marqueur de
// l'instance, dans une seule transaction, une seule fois.
export function useReport(instanceId: string, { db, userId, nowFn = Date.now }: DepsReport = {}) {
  const [donnees, setDonnees] = useState<Donnees>(VIDE)
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState<string | null>(null)
  // Lecture en cours partagée : le double montage du mode strict ne relance pas la lecture.
  const enCours = useRef<{ cle: string; promesse: Promise<Donnees> } | null>(null)
  // Décisions prises ou en cours (synchrone : deux appuis rapides n'écrivent qu'une fois)
  const decidees = useRef(new Set<string>())
  const file = useRef<Promise<unknown>>(Promise.resolve())

  useEffect(() => {
    let annule = false
    const base = db ?? getDb()
    const cle = `${instanceId}#${userId ?? ''}`
    if (enCours.current?.cle !== cle) {
      decidees.current = new Set()
      enCours.current = { cle, promesse: lire(base, instanceId, userId, nowFn()) }
    }
    enCours.current.promesse
      .then((d) => {
        if (!annule) setDonnees(d)
      })
      .catch((e: unknown) => {
        if (annule) return
        if (e instanceof ErreurBilan) setErreur(e.message)
        else {
          console.error('Chargement du bilan impossible', e)
          setErreur('Le chargement du bilan a échoué.')
        }
      })
      .finally(() => {
        if (!annule) setChargement(false)
      })
    return () => {
      annule = true
    }
  }, [db, instanceId, userId, nowFn])

  const evaluations = donnees.evaluations

  const decider = useCallback(
    (exerciceId: string, decision: Decision): Promise<void> => {
      const tache = async () => {
        const evaluation = evaluations.get(exerciceId)
        // Décision déjà prise, proposition non actionnable ou inconnue : sans effet
        if (!evaluation || decidees.current.has(exerciceId)) return
        if (decision.type === 'ajuster' && !(Number.isFinite(decision.chargeKg) && decision.chargeKg > 0)) {
          setErreur(CHARGE_INVALIDE)
          return
        }
        decidees.current.add(exerciceId)
        let dejaDecidee: DecisionEnregistree | null
        try {
          ;({ dejaDecidee } = await (db ?? getDb()).writeTransaction((tx) =>
            appliquerDecision(tx, instanceId, evaluation, decision, nowFn()),
          ))
        } catch (e) {
          decidees.current.delete(exerciceId)
          console.error('Enregistrement de la décision impossible', e)
          setErreur("L'enregistrement de votre choix a échoué. Réessayez.")
          return
        }
        const etat: EtatProposition =
          dejaDecidee ?? (decision.type === 'accepter' ? 'acceptee' : decision.type === 'refuser' ? 'refusee' : 'ajustee')
        setErreur(null)
        setDonnees((d) => ({
          ...d,
          propositions: d.propositions.map((x) =>
            x.exerciceId === exerciceId ? { ...x, etat, actionnable: false, dejaDecide: dejaDecidee !== null } : x,
          ),
        }))
      }
      const suite = file.current.then(tache, tache)
      file.current = suite
      return suite
    },
    [db, evaluations, instanceId, nowFn],
  )

  const accepter = useCallback((exerciceId: string) => decider(exerciceId, { type: 'accepter' }), [decider])
  const refuser = useCallback((exerciceId: string) => decider(exerciceId, { type: 'refuser' }), [decider])
  const ajuster = useCallback(
    (exerciceId: string, chargeKg: number) => decider(exerciceId, { type: 'ajuster', chargeKg }),
    [decider],
  )

  return {
    chargement,
    erreur,
    trouvee: donnees.trouvee,
    terminee: donnees.terminee,
    nomSeance: donnees.nomSeance,
    resume: donnees.resume,
    exercices: donnees.exercices,
    propositions: donnees.propositions,
    accepter,
    refuser,
    ajuster,
  }
}
