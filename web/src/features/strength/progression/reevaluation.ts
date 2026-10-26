import type { Db, DbLecture, DbTx } from '../../../core/db/Db'
import { enregistrerProgression, getInstance } from '../../../core/db/repos/instances'
import { getObjectif, saveObjectif, supprimerObjectif } from '../../../core/db/repos/objectifs'
import { changerSeriesPrevues } from '../../../core/db/repos/series'
import type { InstanceSeance } from '../../../core/db/types'
import {
  retirerExercice, serialiserProgression, enregistrerBase, type BaseExercice, type EtatProgression, type ObjectifMarque,
  type PropositionMarquee,
} from '../../../core/progression/marqueur'
import {
  appliquerSilencieusement, evaluerInstance, marquerObjectif, marquerProposition, type EvaluationExercice,
} from './evaluation'

// Correction d'une séance terminée -> recalcul de la progression (lot 29).
//
// Android : la correction n'écrit rien dans la progression ; seul un nouveau « Terminer » ré-évalue, par-dessus
// l'objectif DÉJÀ modifié par la première évaluation (une évaluation s'applique alors deux fois). Le web fait mieux :
//
// RÈGLE DE REMPLACEMENT. Pour chaque exercice dont l'évaluation d'origine a écrit un objectif (base gardée dans le
// marqueur) :
//  1. on réévalue depuis la CIBLE et le COMPTEUR D'ORIGINE (jamais depuis l'objectif déjà modifié) ;
//  2. proposition identique à celle d'origine -> rien n'est écrit, la décision de l'utilisateur est conservée ;
//  3. proposition différente et objectif encore tel que l'évaluation l'a écrit -> l'objectif est ramené à son état
//     d'avant (supprimé s'il n'existait pas), le « +1 série » éventuel est défait, l'ancienne décision (y compris un
//     « Oui / Non / Ajuster » de l'utilisateur) est annulée, puis : issue sans validation (échec simple) -> appliquée
//     tout de suite ; sinon -> proposée à nouveau au récap ;
//  4. proposition différente mais objectif déjà modifié depuis (séance plus récente) -> rien n'est touché ; la base est
//     mise à jour pour que le signalement ne revienne pas.
// Sans base dans le marqueur (séance évaluée avant ce lot, ou importée) : jamais recalculée.
// Idempotent : le marqueur dit toujours ce qui a été appliqué.

export type EffetCorrection = 'recalculee' | 'a_redecider' | 'objectif_deja_evolue'

export interface ChangementProgression {
  exerciceId: string
  nom: string
  effet: EffetCorrection
}

interface Analyse {
  evaluation: EvaluationExercice
  base: BaseExercice
}

const memeProposition = (a: PropositionMarquee, b: PropositionMarquee) =>
  a.statut === b.statut && a.chargeCible === b.chargeCible && a.repsCible === b.repsCible && a.dureeCibleSec === b.dureeCibleSec &&
  a.compteurEchec === b.compteurEchec && a.nombreSeries === b.nombreSeries && a.deload === b.deload

const memeObjectif = (a: ObjectifMarque, b: ObjectifMarque) =>
  a.chargeCible === b.chargeCible && a.repsCible === b.repsCible && a.dureeCibleSec === b.dureeCibleSec &&
  a.compteurEchec === b.compteurEchec && a.nombreSeriesCible === b.nombreSeriesCible && a.derniereMaj === b.derniereMaj

// Exercices dont la proposition, recalculée depuis la base d'origine, diffère de celle d'origine.
async function analyser(db: DbLecture, instance: InstanceSeance, userId: string | undefined): Promise<Analyse[]> {
  const bases = instance.progression?.bases
  if (!bases || Object.keys(bases).length === 0) return []
  const evaluations = await evaluerInstance(db, instance.id, userId, bases)
  return evaluations.flatMap((evaluation) => {
    const base = bases[evaluation.exerciceId]
    return base && !memeProposition(marquerProposition(evaluation.proposition), base.proposition) ? [{ evaluation, base }] : []
  })
}

async function appliquer(tx: DbTx, instance: InstanceSeance, analyses: Analyse[], maintenantMs: number): Promise<ChangementProgression[]> {
  const iso = new Date(maintenantMs).toISOString()
  let etat: EtatProgression = instance.progression ?? { evaluee: true, decisions: {} }
  const changements: ChangementProgression[] = []
  for (const { evaluation: e, base } of analyses) {
    const { seanceId, exerciseId } = e.ctx
    const courant = await getObjectif(tx, seanceId, exerciseId)
    const intact = courant !== null && memeObjectif(marquerObjectif(courant), base.ecrit)
    if (!intact) {
      etat = enregistrerBase(etat, e.exerciceId, { ...base, proposition: marquerProposition(e.proposition) })
      changements.push({ exerciceId: e.exerciceId, nom: e.nom, effet: 'objectif_deja_evolue' })
      continue
    }
    // Retour à l'état d'avant l'évaluation d'origine
    if (base.avant) {
      await saveObjectif(tx, { seanceId, exerciseId, ...base.avant }, iso)
    } else {
      await supprimerObjectif(tx, seanceId, exerciseId, iso)
    }
    if (base.seriesAvant !== null && base.seriesApres !== null) {
      const ligne = await tx.getOptional<{ n: number }>(
        'SELECT nombre_series_prevues AS n FROM exercices_seance WHERE id = ? AND instance_seance_id = ? AND deleted_at IS NULL',
        [e.exerciceId, instance.id],
      )
      if (ligne?.n === base.seriesApres) await changerSeriesPrevues(tx, instance.id, e.exerciceId, base.seriesAvant, iso)
    }
    etat = retirerExercice(etat, e.exerciceId)
    if (e.aValider) {
      changements.push({ exerciceId: e.exerciceId, nom: e.nom, effet: 'a_redecider' })
    } else {
      etat = await appliquerSilencieusement(tx, e, etat, maintenantMs)
      changements.push({ exerciceId: e.exerciceId, nom: e.nom, effet: 'recalculee' })
    }
  }
  await enregistrerProgression(tx, instance.id, serialiserProgression(etat), iso)
  return changements
}

/**
 * Recalcule la progression d'une séance terminée dont les séries ont été corrigées (règle de remplacement ci-dessus).
 * Lecture seule tant que rien ne change ; sinon une seule transaction, relue à l'intérieur. Renvoie les exercices touchés.
 */
export async function reevaluerApresCorrection(
  db: Db,
  instanceId: string,
  { userId, maintenantMs }: { userId?: string; maintenantMs: number },
): Promise<ChangementProgression[]> {
  const instance = await getInstance(db, instanceId)
  if (!instance || !instance.isCompleted || instance.startedAt === null) return []
  if ((await analyser(db, instance, userId)).length === 0) return []
  return db.writeTransaction(async (tx) => {
    const frais = await getInstance(tx, instanceId)
    if (!frais || !frais.isCompleted) return []
    const analyses = await analyser(tx, frais, userId)
    return analyses.length === 0 ? [] : appliquer(tx, frais, analyses, maintenantMs)
  })
}
