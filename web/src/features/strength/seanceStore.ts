import type { Db } from '../../core/db/Db'
import { getSeanceTree } from '../../core/db/repos/seances'
import { mapSeance, type Ligne } from '../../core/db/repos/mappers'
import { upsertRow } from '../../core/db/upsert'
import type { Exercise } from '../../core/db/types'
import { newId } from '../../core/db/ids'
import { lireGroupes } from './catalog/filtreCatalogue'
import {
  groupesMusculaires, nouveauBloc, renumeroter, TYPES_BLOC, type BlocDraft, type ExerciceDraft, type SeanceDraft,
  type TypeBloc,
} from './draft'

// Muscles d'un exercice du catalogue : principal d'abord, puis les groupes, sans doublon.
export function musclesExercice(e: Exercise): string[] {
  return [...new Set([e.musclePrimary, ...lireGroupes(e.muscleGroups)].filter((m) => m !== ''))]
}

const typeBloc = (t: string): TypeBloc => ((TYPES_BLOC as readonly string[]).includes(t) ? (t as TypeBloc) : 'ECHAUFFEMENT')

// Charge un modèle (lignes `instance_seance_id IS NULL` uniquement) sous forme de brouillon.
// Renvoie null si la séance n'existe pas ou est supprimée.
export async function chargerBrouillon(db: Db, seanceId: string, catalogue: Exercise[]): Promise<SeanceDraft | null> {
  const ligne = await db.getOptional<Ligne>('SELECT * FROM seances WHERE id = ? AND deleted_at IS NULL', [seanceId])
  if (!ligne) return null
  const s = mapSeance(ligne)
  const { blocs, exercices } = await getSeanceTree(db, seanceId, null)
  const parId = new Map(catalogue.map((e) => [e.id, e]))

  const versDraft = (e: (typeof exercices)[number]): ExerciceDraft => {
    const exo = parId.get(e.exerciseId)
    return {
      id: e.id, exerciseId: e.exerciseId, exerciseNom: exo?.name ?? 'Exercice introuvable',
      muscles: exo ? musclesExercice(exo) : [], position: e.position, supersetGroupe: e.supersetGroupe,
      nombreSeriesPrevues: e.nombreSeriesPrevues, repsCibles: e.repsCibles, chargeCible: e.chargeCible, tempo: e.tempo,
      repsType: e.repsType, tempsReposSec: e.tempsReposSec, consigneCle: e.consigneCle, equipement: e.equipement,
      avertissement: e.avertissement, isBilateral: e.isBilateral, progressionActivee: e.progressionActivee,
      systemeProgression: e.systemeProgression, repsMin: e.repsMin, repsMax: e.repsMax, incrementKg: e.incrementKg,
      incrementDureeSec: e.incrementDureeSec, seuilDeload: e.seuilDeload, typeExercice: e.typeExercice,
      incrementPct: e.incrementPct, isBodyweight: e.isBodyweight,
    }
  }

  const blocsDraft: BlocDraft[] = blocs.map((b) => ({
    id: b.id, nom: b.nom, type: typeBloc(b.type), position: b.position, dureeMin: b.dureeMin, description: b.description,
    tempsReposInterSec: b.tempsReposInterSec, tempsReposFinRoundSec: b.tempsReposFinRoundSec,
    exercices: exercices.filter((e) => e.blocId === b.id).map(versDraft),
  }))
  // Exercices sans bloc (ou rattachés à un bloc absent) : regroupés dans un bloc dédié plutôt que perdus.
  const connus = new Set(blocs.map((b) => b.id))
  const libres = exercices.filter((e) => e.blocId === null || !connus.has(e.blocId))
  if (libres.length > 0) {
    blocsDraft.push({ ...nouveauBloc(newId(), 'ECHAUFFEMENT'), nom: 'Exercices', exercices: libres.map(versDraft) })
  }

  return renumeroter({
    id: s.id, existante: true, nom: s.nom, notes: s.notes, dureeEstimeeMin: s.dureeEstimeeMin,
    seanceCategory: s.seanceCategory, createdAt: s.createdAt, blocs: blocsDraft,
  })
}

// Enregistre le brouillon en UNE transaction. Les positions sont recalculées depuis l'ordre du
// brouillon. Seules les lignes MODÈLE (instance_seance_id IS NULL) sont lues, écrites ou supprimées
// logiquement : les copies des instances ne sont jamais touchées.
export async function enregistrerBrouillon(db: Db, brouillon: SeanceDraft): Promise<string> {
  const d = renumeroter(brouillon)
  const maintenant = new Date().toISOString()
  await db.writeTransaction(async (tx) => {
    await upsertRow(tx, 'seances', {
      id: d.id,
      updated_at: maintenant,
      deleted_at: null,
      nom: d.nom.trim(),
      groupes_musculaires: JSON.stringify(groupesMusculaires(d)),
      duree_estimee_min: d.dureeEstimeeMin,
      notes: d.notes.trim(),
      seance_category: d.seanceCategory,
      // created_at et is_archived ne sont posés qu'à la création
      ...(d.existante ? {} : { created_at: maintenant, is_archived: 0 }),
    })

    const garder = {
      blocs: new Set(d.blocs.map((b) => b.id)),
      exercices: new Set(d.blocs.flatMap((b) => b.exercices.map((e) => e.id))),
    }
    // Lignes modèle vivantes absentes du brouillon : suppression logique
    for (const [table, ids] of [['blocs_seance', garder.blocs], ['exercices_seance', garder.exercices]] as const) {
      const existantes = await tx.getAll<{ id: string }>(
        `SELECT id FROM ${table} WHERE seance_id = ? AND instance_seance_id IS NULL AND deleted_at IS NULL`,
        [d.id],
      )
      for (const { id } of existantes) {
        if (ids.has(id)) continue
        await tx.execute(
          `UPDATE ${table} SET deleted_at = ?, updated_at = ? WHERE id = ? AND instance_seance_id IS NULL`,
          [maintenant, maintenant, id],
        )
      }
    }

    for (const b of d.blocs) {
      await upsertRow(tx, 'blocs_seance', {
        id: b.id, updated_at: maintenant, deleted_at: null, seance_id: d.id, nom: b.nom, type: b.type,
        position: b.position, duree_min: b.dureeMin, description: b.description,
        temps_repos_inter_sec: b.tempsReposInterSec, temps_repos_fin_round_sec: b.tempsReposFinRoundSec,
        instance_seance_id: null, bloc_source_id: null,
      })
      for (const e of b.exercices) {
        await upsertRow(tx, 'exercices_seance', {
          id: e.id, updated_at: maintenant, deleted_at: null, seance_id: d.id, exercise_id: e.exerciseId,
          bloc_id: b.id, superset_groupe: e.supersetGroupe, position: e.position,
          nombre_series_prevues: e.nombreSeriesPrevues, reps_cibles: e.repsCibles, charge_cible: e.chargeCible,
          tempo: e.tempo, reps_type: e.repsType, temps_repos_sec: e.tempsReposSec, consigne_cle: e.consigneCle,
          equipement: e.equipement, avertissement: e.avertissement, instance_seance_id: null,
          exercice_source_id: null, is_bilateral: e.isBilateral ? 1 : 0, progression_activee: e.progressionActivee ? 1 : 0,
          systeme_progression: e.systemeProgression, reps_min: e.repsMin, reps_max: e.repsMax,
          increment_kg: e.incrementKg, increment_duree_sec: e.incrementDureeSec, seuil_deload: e.seuilDeload,
          type_exercice: e.typeExercice, increment_pct: e.incrementPct, is_bodyweight: e.isBodyweight ? 1 : 0,
        })
      }
    }
  })
  return d.id
}
