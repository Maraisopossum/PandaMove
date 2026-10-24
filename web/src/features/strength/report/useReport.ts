import { useCallback, useEffect, useRef, useState } from 'react'
import { getDb } from '../../../core/db/client'
import type { Db } from '../../../core/db/Db'
import { getInstance } from '../../../core/db/repos/instances'
import { getObjectif, saveObjectif } from '../../../core/db/repos/objectifs'
import { getSeanceTree } from '../../../core/db/repos/seances'
import { listSeries } from '../../../core/db/repos/series'
import { getSettings } from '../../../core/db/repos/settings'
import type { ExerciceSeance, SerieRealisee } from '../../../core/db/types'
import { lireEquipementStocke } from '../../../core/import/equipment'
import { evaluerExercice, requiresValidation, type PropositionProgression } from '../../../core/progression/engine'
import { construireVue } from '../execute/vue'
import {
  chargesAtteignablesExercice, cibleDepuis, lireListeEquipement, objectifApresDecision, objectifDejaApplique,
  pasMaterielExercice, resumerSeance, type ContexteDecision, type Decision, type ResumeSeance,
} from './bilan'

export interface DepsReport {
  /** Base à utiliser (défaut : base de l'application). Référence stable. */
  db?: Db
  /** Utilisateur connecté : lecture de « Mon matériel ». Sans utilisateur, aucun inventaire. */
  userId?: string
  /** Horloge (epoch ms). Référence stable ; injectée par les tests. */
  nowFn?: () => number
}

export type EtatProposition = 'en_attente' | 'acceptee' | 'refusee' | 'ajustee'

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
  proposition: PropositionProgression
  /** requiresValidation(proposition) — jamais déduit du statut seul */
  aValider: boolean
  /** Oui / Non / Ajuster proposés : à valider et pas NON_LOGGE (lecture seule, comme Android) */
  actionnable: boolean
  etat: EtatProposition
}

interface Donnees {
  trouvee: boolean
  terminee: boolean
  nomSeance: string
  resume: ResumeSeance
  exercices: LigneBilan[]
  propositions: PropositionBilan[]
  // Contexte d'écriture de chaque proposition actionnable (par exerciceId)
  contextes: Map<string, ContexteDecision>
}

const VIDE: Donnees = {
  trouvee: false,
  terminee: false,
  nomSeance: '',
  resume: { tonnageKg: 0, seriesTotal: 0, dureeSec: 0 },
  exercices: [],
  propositions: [],
  contextes: new Map(),
}

// Erreur destinée à l'utilisateur (message français affiché tel quel).
class ErreurBilan extends Error {}

const CHARGE_INVALIDE = 'La charge doit être un nombre de kg strictement positif.'

function statutLigne(prevues: number, realisees: number): LigneBilan['statut'] {
  if (realisees === 0) return 'aucune'
  return realisees >= prevues ? 'complet' : 'partiel'
}

// Évalue chaque exercice en progression_activee (miroir de prepareFinish Android) : les propositions à
// valider sont présentées SANS rien écrire ; les autres (échec simple, cible maintenue) sont appliquées
// silencieusement, une seule fois (garde derniere_maj >= fin de séance, revérifiée dans la transaction).
async function evaluer(
  db: Db,
  ex: ExerciceSeance[],
  noms: Map<string, string>,
  series: SerieRealisee[],
  seanceId: string,
  completedAt: string,
  userId: string | undefined,
  maintenant: string,
): Promise<{ propositions: PropositionBilan[]; contextes: Map<string, ContexteDecision> }> {
  const candidats = ex.filter((e) => e.progressionActivee)
  const propositions: PropositionBilan[] = []
  const contextes = new Map<string, ContexteDecision>()
  if (candidats.length === 0) return { propositions, contextes }

  const stocke = lireEquipementStocke(userId ? (await getSettings(db, userId)).equipmentJson : null)
  const inventaire = { halteres: stocke.halteres, barre: stocke.barre, kettlebell: stocke.kettlebell, cable: stocke.cable }
  const ids = [...new Set(candidats.map((e) => e.exerciseId))]
  const equipements = new Map(
    (
      await db.getAll<{ id: string; equipment: string | null }>(
        `SELECT id, equipment FROM exercises WHERE deleted_at IS NULL AND id IN (${ids.map(() => '?').join(', ')})`,
        ids,
      )
    ).map((l) => [l.id, lireListeEquipement(l.equipment ?? '[]')]),
  )

  for (const es of candidats) {
    const objectif = await getObjectif(db, seanceId, es.exerciseId)
    if (objectif && objectifDejaApplique(objectif.derniereMaj, completedAt)) continue
    const cible = cibleDepuis(objectif, es)
    const equipement = equipements.get(es.exerciseId) ?? []
    const proposition = evaluerExercice(
      es,
      cible,
      objectif?.compteurEchec ?? 0,
      series.filter((s) => s.exerciceSeanceId === es.id && s.isCompleted),
      es.isBilateral,
      pasMaterielExercice(equipement, stocke.pasParCategorie),
      chargesAtteignablesExercice(equipement, inventaire),
    )
    const ctx: ContexteDecision = { seanceId, exerciseId: es.exerciseId, completedAt, cible }
    const aValider = requiresValidation(proposition)
    const nom = noms.get(es.exerciseId) ?? 'Exercice inconnu'
    if (!aValider) {
      await db.writeTransaction(async (tx) => {
        const existant = await getObjectif(tx, seanceId, es.exerciseId)
        if (existant && objectifDejaApplique(existant.derniereMaj, completedAt)) return
        await saveObjectif(tx, objectifApresDecision({ type: 'accepter' }, proposition, existant, ctx, maintenant), maintenant)
      })
      propositions.push({ exerciceId: es.id, nom, proposition, aValider, actionnable: false, etat: 'acceptee' })
      continue
    }
    const actionnable = proposition.statut !== 'NON_LOGGE'
    if (actionnable) contextes.set(es.id, ctx)
    propositions.push({ exerciceId: es.id, nom, proposition, aValider, actionnable, etat: 'en_attente' })
  }
  return { propositions, contextes }
}

async function lire(db: Db, instanceId: string, userId: string | undefined, maintenant: string): Promise<Donnees> {
  const instance = await getInstance(db, instanceId)
  if (!instance) throw new ErreurBilan('Séance introuvable.')
  const seance = await db.getOptional<{ nom: string }>('SELECT nom FROM seances WHERE id = ? AND deleted_at IS NULL', [
    instance.seanceId,
  ])
  const base = { ...VIDE, trouvee: true, nomSeance: seance?.nom ?? 'Séance' }
  if (!instance.isCompleted) return base

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
  // Sans date de fin, la garde « déjà appliqué » est impossible : aucune évaluation (rien d'écrit).
  const { propositions, contextes } = instance.completedAt
    ? await evaluer(db, ordonnes, noms, series, instance.seanceId, instance.completedAt, userId, maintenant)
    : { propositions: [], contextes: new Map<string, ContexteDecision>() }
  return {
    ...base,
    terminee: true,
    resume: resumerSeance(arbre.exercices, series, instance.durationSeconds),
    exercices,
    propositions,
    contextes,
  }
}

// Bilan d'une séance terminée et récap de progression (spec §5). La progression est PROPOSÉE :
// chaque décision (Oui / Non / Ajuster) est écrite dans sa propre transaction, une seule fois.
export function useReport(instanceId: string, { db, userId, nowFn = Date.now }: DepsReport = {}) {
  const [donnees, setDonnees] = useState<Donnees>(VIDE)
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState<string | null>(null)
  // Lecture en cours partagée : le double montage du mode strict ne relance pas l'évaluation
  // (qui peut écrire les échecs simples) et ne perd pas son résultat.
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
      enCours.current = { cle, promesse: lire(base, instanceId, userId, new Date(nowFn()).toISOString()) }
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

  const contextes = donnees.contextes

  const decider = useCallback(
    (exerciceId: string, decision: Decision): Promise<void> => {
      const tache = async () => {
        const ctx = contextes.get(exerciceId)
        const p = donnees.propositions.find((x) => x.exerciceId === exerciceId)
        // Décision déjà prise, proposition non actionnable ou inconnue : sans effet
        if (!ctx || !p || decidees.current.has(exerciceId)) return
        if (decision.type === 'ajuster' && !(Number.isFinite(decision.chargeKg) && decision.chargeKg > 0)) {
          setErreur(CHARGE_INVALIDE)
          return
        }
        decidees.current.add(exerciceId)
        try {
          const maintenant = new Date(nowFn()).toISOString()
          await (db ?? getDb()).writeTransaction(async (tx) => {
            const existant = await getObjectif(tx, ctx.seanceId, ctx.exerciseId)
            // Décision déjà appliquée ailleurs (autre onglet / appareil) : on ne l'écrase pas
            if (existant && objectifDejaApplique(existant.derniereMaj, ctx.completedAt)) return
            await saveObjectif(tx, objectifApresDecision(decision, p.proposition, existant, ctx, maintenant), maintenant)
          })
        } catch (e) {
          decidees.current.delete(exerciceId)
          console.error('Enregistrement de la décision impossible', e)
          setErreur("L'enregistrement de votre choix a échoué. Réessayez.")
          return
        }
        const etat: EtatProposition =
          decision.type === 'accepter' ? 'acceptee' : decision.type === 'refuser' ? 'refusee' : 'ajustee'
        setErreur(null)
        setDonnees((d) => ({
          ...d,
          propositions: d.propositions.map((x) => (x.exerciceId === exerciceId ? { ...x, etat } : x)),
        }))
      }
      const suite = file.current.then(tache, tache)
      file.current = suite
      return suite
    },
    [contextes, db, donnees.propositions, nowFn],
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
