import type { DbLecture, DbTx } from '../../../core/db/Db'
import { enregistrerProgression, getInstance } from '../../../core/db/repos/instances'
import { getObjectif, saveObjectif } from '../../../core/db/repos/objectifs'
import { getSeanceTree } from '../../../core/db/repos/seances'
import { changerSeriesPrevues, listSeries } from '../../../core/db/repos/series'
import { getSettings } from '../../../core/db/repos/settings'
import { lireEquipementStocke } from '../../../core/import/equipment'
import { evaluerExercice, requiresValidation, type PropositionProgression } from '../../../core/progression/engine'
import {
  enregistrerBase, enregistrerDecision, marquerEvaluee, serialiserProgression,
  type BaseExercice, type DecisionEnregistree, type EtatProgression, type ObjectifMarque, type PropositionMarquee,
} from '../../../core/progression/marqueur'
import type { ObjectifProgression } from '../../../core/db/types'
import {
  chargesAtteignablesExercice, cibleDepuis, dateLocale, lireListeEquipement, objectifApresDecision, pasMaterielExercice,
  type ContexteDecision, type Decision,
} from './cible'

// Évaluation de la progression d'une instance (miroir de prepareFinish / validerPropositions Android),
// partagée par la fin de séance (useExecute.terminer) et le bilan (useReport).

export interface EvaluationExercice {
  /** Id de la ligne exercices_seance de l'instance */
  exerciceId: string
  nom: string
  proposition: PropositionProgression
  /** requiresValidation(proposition) — jamais déduit du statut seul */
  aValider: boolean
  /** Charges composables avec « Mon matériel » (indice « Arrondir » du récap) ; vide si rien n'est déclaré */
  chargesAtteignables: number[]
  ctx: ContexteDecision
}

/** Évalue (LECTURE SEULE) chaque exercice en progression_activee de l'instance, dans l'ordre des positions. */
export async function evaluerInstance(
  db: DbLecture,
  instanceId: string,
  userId?: string,
  // Bases d'évaluation (recalcul après correction) : la cible et le compteur d'ORIGINE remplacent l'objectif courant
  bases?: Record<string, BaseExercice>,
): Promise<EvaluationExercice[]> {
  const instance = await getInstance(db, instanceId)
  if (!instance) throw new Error('Instance introuvable')
  const arbre = await getSeanceTree(db, instance.seanceId, instanceId)
  const candidats = arbre.exercices.filter((e) => e.progressionActivee)
  if (candidats.length === 0) return []
  const series = await listSeries(db, instanceId)
  const stocke = lireEquipementStocke(userId ? (await getSettings(db, userId)).equipmentJson : null)
  const inventaire = { halteres: stocke.halteres, barre: stocke.barre, kettlebell: stocke.kettlebell, cable: stocke.cable }
  const ids = [...new Set(candidats.map((e) => e.exerciseId))]
  const fiches = new Map(
    (
      await db.getAll<{ id: string; name: string | null; equipment: string | null }>(
        `SELECT id, name, equipment FROM exercises WHERE deleted_at IS NULL AND id IN (${ids.map(() => '?').join(', ')})`,
        ids,
      )
    ).map((l) => [l.id, { nom: l.name ?? 'Exercice inconnu', equipement: lireListeEquipement(l.equipment ?? '[]') }]),
  )

  const resultats: EvaluationExercice[] = []
  for (const es of candidats) {
    const objectif = await getObjectif(db, instance.seanceId, es.exerciseId)
    const base = bases?.[es.id]
    const cible = base ? { chargeKg: base.cible.chargeKg, reps: base.cible.reps, dureeSec: base.cible.dureeSec } : cibleDepuis(objectif, es)
    const compteur = base ? (base.avant?.compteurEchec ?? 0) : (objectif?.compteurEchec ?? 0)
    const equipement = fiches.get(es.exerciseId)?.equipement ?? []
    const chargesAtteignables = chargesAtteignablesExercice(equipement, inventaire)
    const proposition = evaluerExercice(
      es,
      cible,
      compteur,
      series.filter((s) => s.exerciceSeanceId === es.id && s.isCompleted),
      es.isBilateral,
      pasMaterielExercice(equipement, stocke.pasParCategorie),
      chargesAtteignables,
    )
    resultats.push({
      exerciceId: es.id,
      nom: fiches.get(es.exerciseId)?.nom ?? 'Exercice inconnu',
      proposition,
      aValider: requiresValidation(proposition),
      chargesAtteignables: chargesAtteignables ?? [],
      ctx: { seanceId: instance.seanceId, exerciseId: es.exerciseId, cible },
    })
  }
  return resultats
}

/**
 * Évaluation de fin de séance, dans la transaction fournie (celle qui clôt l'instance) : applique
 * UNIQUEMENT les issues qui ne demandent pas de validation (échec simple : compteur +1, cible
 * maintenue), les enregistre comme décisions « appliquee_auto » et marque l'instance `evaluee`. Les
 * propositions à valider (succès, deload, non loggé) ne sont PAS écrites : le bilan les présente.
 * Idempotente : une instance déjà évaluée n'est jamais ré-évaluée. Renvoie true si elle a évalué.
 */
export async function evaluerEtAppliquerSilencieux(
  tx: DbTx,
  instanceId: string,
  { userId, maintenantMs }: { userId?: string; maintenantMs: number },
): Promise<boolean> {
  const instance = await getInstance(tx, instanceId)
  if (!instance) throw new Error('Instance introuvable')
  if (instance.progression?.evaluee) return false
  const iso = new Date(maintenantMs).toISOString()
  let etat = marquerEvaluee(instance.progression)
  for (const e of await evaluerInstance(tx, instanceId, userId)) {
    if (e.aValider) continue
    etat = await appliquerSilencieusement(tx, e, etat, maintenantMs)
  }
  await enregistrerProgression(tx, instanceId, serialiserProgression(etat), iso)
  return true
}

export const marquerObjectif = (o: ObjectifProgression): ObjectifMarque => ({
  chargeCible: o.chargeCible, repsCible: o.repsCible, dureeCibleSec: o.dureeCibleSec, compteurEchec: o.compteurEchec,
  nombreSeriesCible: o.nombreSeriesCible, derniereMaj: o.derniereMaj ?? '',
})

export const marquerProposition = (p: PropositionProgression): PropositionMarquee => ({
  statut: p.statut, chargeCible: p.nouvelleChargeCible, repsCible: p.nouveauRepsCible, dureeCibleSec: p.nouvelleDureeCible,
  compteurEchec: p.nouveauCompteurEchec, nombreSeries: p.nouveauNombreSeries, deload: p.deload,
})

// Écrit l'objectif d'une décision et renvoie la base d'évaluation à garder dans le marqueur (relue après l'écriture).
async function ecrireAvecBase(
  tx: DbTx,
  e: Pick<EvaluationExercice, 'proposition' | 'ctx'>,
  decision: Decision,
  maintenantMs: number,
  seriesAvant: number | null,
  seriesApres: number | null,
): Promise<BaseExercice> {
  const existant = await getObjectif(tx, e.ctx.seanceId, e.ctx.exerciseId)
  await saveObjectif(
    tx, objectifApresDecision(decision, e.proposition, existant, e.ctx, dateLocale(maintenantMs)), new Date(maintenantMs).toISOString(),
  )
  const ecrit = await getObjectif(tx, e.ctx.seanceId, e.ctx.exerciseId)
  if (!ecrit) throw new Error('Objectif introuvable après écriture')
  return {
    cible: { chargeKg: e.ctx.cible.chargeKg, reps: e.ctx.cible.reps, dureeSec: e.ctx.cible.dureeSec },
    avant: existant ? marquerObjectif(existant) : null,
    ecrit: marquerObjectif(ecrit),
    proposition: marquerProposition(e.proposition),
    seriesAvant,
    seriesApres,
  }
}

/** Applique une issue sans validation (échec simple) : objectif, décision « appliquee_auto » et base. */
export async function appliquerSilencieusement(
  tx: DbTx,
  e: Pick<EvaluationExercice, 'exerciceId' | 'proposition' | 'ctx'>,
  etat: EtatProgression,
  maintenantMs: number,
): Promise<EtatProgression> {
  const base = await ecrireAvecBase(tx, e, { type: 'accepter' }, maintenantMs, null, null)
  return enregistrerBase(enregistrerDecision(etat, e.exerciceId, 'appliquee_auto'), e.exerciceId, base)
}

const ENREGISTREE: Record<Decision['type'], DecisionEnregistree> = {
  accepter: 'acceptee',
  refuser: 'refusee',
  ajuster: 'ajustee',
}

/**
 * Applique une décision du récap dans la transaction fournie : écrit l'objectif ET enregistre la
 * décision dans progression_json. Si une décision est déjà enregistrée pour cet exercice (autre
 * onglet / appareil), rien n'est écrit et la décision enregistrée est renvoyée.
 */
export async function appliquerDecision(
  tx: DbTx,
  instanceId: string,
  e: Pick<EvaluationExercice, 'exerciceId' | 'proposition' | 'ctx'>,
  decision: Decision,
  maintenantMs: number,
): Promise<{ dejaDecidee: DecisionEnregistree | null }> {
  const instance = await getInstance(tx, instanceId)
  if (!instance) throw new Error('Instance introuvable')
  const enregistree = instance.progression?.decisions[e.exerciceId]
  if (enregistree) return { dejaDecidee: enregistree }
  const iso = new Date(maintenantMs).toISOString()
  // « +1 série » (poids de corps au plafond) : comme validerPropositions Android, Oui et Ajuster écrivent aussi le
  // nombre de séries prévues de la ligne d'exercice de l'instance (appliquerNouveauNombreSeries). Non n'y touche pas.
  const ajoutSerie = decision.type !== 'refuser' && e.proposition.nouveauNombreSeries !== null
  const prevues = ajoutSerie
    ? (await tx.getOptional<{ n: number }>(
        'SELECT nombre_series_prevues AS n FROM exercices_seance WHERE id = ? AND instance_seance_id = ? AND deleted_at IS NULL',
        [e.exerciceId, instanceId],
      ))?.n ?? null
    : null
  const base = await ecrireAvecBase(tx, e, decision, maintenantMs, prevues, prevues === null ? null : e.proposition.nouveauNombreSeries)
  if (ajoutSerie && e.proposition.nouveauNombreSeries !== null) {
    await changerSeriesPrevues(tx, instanceId, e.exerciceId, e.proposition.nouveauNombreSeries, iso)
  }
  const etat = enregistrerBase(enregistrerDecision(instance.progression, e.exerciceId, ENREGISTREE[decision.type]), e.exerciceId, base)
  await enregistrerProgression(tx, instanceId, serialiserProgression(etat), iso)
  return { dejaDecidee: null }
}
