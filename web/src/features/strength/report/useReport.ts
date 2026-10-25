import { useCallback, useEffect, useRef, useState } from 'react'
import { getDb } from '../../../core/db/client'
import type { Db } from '../../../core/db/Db'
import { getInstance } from '../../../core/db/repos/instances'
import { getSeanceTree, lireSeanceResume } from '../../../core/db/repos/seances'
import { listSeries } from '../../../core/db/repos/series'
import type { ExerciceSeance, InstanceSeance } from '../../../core/db/types'
import type { PropositionProgression } from '../../../core/progression/engine'
import type { DecisionEnregistree } from '../../../core/progression/marqueur'
import { construireVue } from '../execute/vue'
import type { Decision } from '../progression/cible'
import {
  appliquerDecision, evaluerEtAppliquerSilencieux, evaluerInstance, type EvaluationExercice,
} from '../progression/evaluation'
import { libelleCible, ligneSerie, resumerSeance, titreBloc, type LigneSerie, type ResumeSeance } from './bilan'

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
  /** Lignes de séries enregistrées (validées ou non) */
  seriesSaisies: number
  statut: 'complet' | 'partiel' | 'aucune'
  /** Cible du modèle en une ligne (« 3 × 8 reps à 50 kg ») */
  cible: string
  /** Tableau des séries, dans l'ordre des numéros */
  lignes: LigneSerie[]
}

/** Groupe d'exercices de l'ordre d'exécution : un bloc, ou une suite d'exercices libres (titre null). */
export interface GroupeBilan {
  cle: string
  titre: string | null
  type: string | null
  exercices: LigneBilan[]
}

/** Choix du récap pour un exercice (Oui / Non, garder / Ajuster). */
export interface ChoixRecap {
  exerciceId: string
  choix: 'oui' | 'non' | 'ajuster'
  /** Charge saisie, pour « ajuster » seulement */
  chargeKg: number | null
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
  /** Charges composables avec « Mon matériel » (indice « Arrondir » de l'ajustement) */
  chargesAtteignables: number[]
  etat: EtatProposition
  /** La décision avait déjà été enregistrée ailleurs quand l'utilisateur a choisi (« Déjà décidé ») */
  dejaDecide: boolean
}

interface Donnees {
  trouvee: boolean
  terminee: boolean
  nomSeance: string
  /** Date de la séance (yyyy-MM-dd) */
  date: string
  /** Notes du modèle de séance */
  notesSeance: string
  /** Note saisie pendant la séance */
  notesInstance: string
  resume: ResumeSeance
  exercices: LigneBilan[]
  groupes: GroupeBilan[]
  propositions: PropositionBilan[]
  // Évaluation des propositions actionnables (par exerciceId), pour écrire une décision
  evaluations: Map<string, EvaluationExercice>
}

const VIDE: Donnees = {
  trouvee: false,
  terminee: false,
  nomSeance: '',
  date: '',
  notesSeance: '',
  notesInstance: '',
  resume: { tonnageKg: 0, seriesTotal: 0, dureeSec: 0 },
  exercices: [],
  groupes: [],
  propositions: [],
  evaluations: new Map(),
}

// Erreur destinée à l'utilisateur (message français affiché tel quel).
class ErreurBilan extends Error {}

const CHARGE_INVALIDE = 'La charge doit être un nombre de kg strictement positif.'
const chargeValide = (kg: number | null): kg is number => kg !== null && Number.isFinite(kg) && kg > 0

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
        return { exerciceId: e.exerciceId, nom: e.nom, proposition: null, aValider: false, actionnable: false, chargesAtteignables: [], etat: decidee, dejaDecide: false }
      }
      const actionnable = e.aValider && e.proposition.statut !== 'NON_LOGGE'
      if (actionnable) evaluations.set(e.exerciceId, e)
      return { exerciceId: e.exerciceId, nom: e.nom, proposition: e.proposition, aValider: e.aValider, actionnable, chargesAtteignables: e.chargesAtteignables, etat: 'en_attente', dejaDecide: false }
    })
  return { propositions, evaluations }
}

async function lire(db: Db, instanceId: string, userId: string | undefined, maintenantMs: number): Promise<Donnees> {
  let instance = await getInstance(db, instanceId)
  if (!instance) throw new ErreurBilan('Séance introuvable.')
  // Nom lisible même si la séance a été supprimée avec « Garder l'historique » (comme le calendrier)
  const resumeSeance = await lireSeanceResume(db, instance.seanceId)
  const base = {
    ...VIDE,
    trouvee: true,
    nomSeance: instance.nom?.trim() || resumeSeance?.nom || 'Séance',
    date: instance.date,
    notesSeance: resumeSeance?.notes ?? '',
    notesInstance: instance.notes,
  }
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
  const versLigne = (e: ExerciceSeance): LigneBilan => {
    const saisies = series.filter((s) => s.exerciceSeanceId === e.id).sort((a, b) => a.numeroSerie - b.numeroSerie)
    return {
      exerciceId: e.id,
      nom: noms.get(e.exerciseId) ?? 'Exercice inconnu',
      seriesPrevues: e.nombreSeriesPrevues,
      seriesRealisees: terminees(e.id),
      seriesSaisies: saisies.length,
      statut: statutLigne(e.nombreSeriesPrevues, terminees(e.id)),
      cible: libelleCible(e),
      lignes: saisies.map((s) => ligneSerie(s, e.repsType)),
    }
  }
  const exercices = ordonnes.map(versLigne)
  const parLigne = new Map(exercices.map((l) => [l.exerciceId, l]))
  // Groupes dans l'ordre d'exécution : le titre porte le type du bloc (la couleur n'est jamais seule)
  const groupes = vue.blocs.map((g): GroupeBilan => {
    const premier = g.exercices[0]
    return {
      cle: g.cle,
      titre: g.id === null ? null : titreBloc(g.type ?? '', g.nom, premier?.blocReposInterSec ?? 0, premier?.blocReposFinRoundSec ?? 0),
      type: g.type,
      exercices: g.exercices.flatMap((x) => {
        const l = parLigne.get(x.id)
        return l ? [l] : []
      }),
    }
  })
  const { propositions, evaluations } = await propositionsDe(db, instance, ordonnes.map((e) => e.id), userId)
  return {
    ...base,
    terminee: true,
    resume: resumerSeance(arbre.exercices, series, instance.durationSeconds),
    exercices,
    groupes,
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
    (exerciceId: string, decision: Decision): Promise<boolean> => {
      const tache = async (): Promise<boolean> => {
        const evaluation = evaluations.get(exerciceId)
        // Décision déjà prise, proposition non actionnable ou inconnue : sans effet
        if (!evaluation || decidees.current.has(exerciceId)) return true
        if (decision.type === 'ajuster' && !chargeValide(decision.chargeKg)) {
          setErreur(CHARGE_INVALIDE)
          return false
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
          return false
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
        return true
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

  // Validation en lot du récap (« Valider » Android) : les ajustements sont contrôlés AVANT toute écriture
  // (un lot invalide n'écrit rien), puis chaque choix passe par le même chemin que Oui / Non / Ajuster seuls.
  const propositions = donnees.propositions
  const valider = useCallback(
    async (choix: ChoixRecap[]): Promise<boolean> => {
      for (const c of choix) {
        if (c.choix === 'ajuster' && !chargeValide(c.chargeKg)) {
          const nom = propositions.find((p) => p.exerciceId === c.exerciceId)?.nom ?? 'Exercice'
          setErreur(`${nom} : la charge doit être un nombre de kg strictement positif.`)
          return false
        }
      }
      let ok = true
      for (const c of choix) {
        const decision: Decision =
          c.choix === 'oui' ? { type: 'accepter' } : c.choix === 'non' ? { type: 'refuser' } : { type: 'ajuster', chargeKg: c.chargeKg ?? Number.NaN }
        ok = (await decider(c.exerciceId, decision)) && ok
      }
      return ok
    },
    [decider, propositions],
  )

  return {
    chargement,
    erreur,
    trouvee: donnees.trouvee,
    terminee: donnees.terminee,
    nomSeance: donnees.nomSeance,
    date: donnees.date,
    notesSeance: donnees.notesSeance,
    notesInstance: donnees.notesInstance,
    resume: donnees.resume,
    exercices: donnees.exercices,
    groupes: donnees.groupes,
    propositions,
    accepter,
    refuser,
    ajuster,
    valider,
  }
}
