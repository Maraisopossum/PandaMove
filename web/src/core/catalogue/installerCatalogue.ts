import { normalizeSearch } from '../common/normalizeSearch'
import type { Db, DbLecture, DbTx } from '../db/Db'
import { deterministicId } from '../db/ids'
import { upsertRow } from '../db/upsert'
import { baseParNom, catalogueDeBase } from './catalogueDeBase'
import { groupesCorriges, type EntreeBase } from './groupesCorriges'

export interface ResultatInstallation {
  /** Exercices de base créés. */
  ajoutes: number
  /** Exercices existants dont les groupes musculaires ont été corrigés. */
  corriges: number
  /** Exercices de base laissés de côté car supprimés par l'utilisateur. */
  ignores: number
}

interface LigneExercice {
  id: string
  name: string
  muscle_groups: string | null
  muscle_primary: string | null
  deleted_at: string | null
}

const SQL_LIGNES = 'SELECT id, name, muscle_groups, muscle_primary, deleted_at FROM exercises'

function lireListe(json: string | null): string[] {
  try {
    const v: unknown = JSON.parse(json ?? '[]')
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

// Écrit les groupes corrigés d'une ligne existante si (et seulement si) ils diffèrent. Ne touche à
// aucun autre champ (favori, image, description, is_custom).
async function corrigerLigne(tx: DbTx, l: LigneExercice, base: EntreeBase | null, maintenant: string): Promise<boolean> {
  const groupes = lireListe(l.muscle_groups)
  const principal = l.muscle_primary ?? ''
  const cible = groupesCorriges({ musclePrimary: principal, muscleGroups: groupes }, base)
  if (cible.musclePrimary === principal && JSON.stringify(cible.muscleGroups) === JSON.stringify(groupes)) return false
  await upsertRow(tx, 'exercises', {
    id: l.id,
    updated_at: maintenant,
    muscle_primary: cible.musclePrimary,
    muscle_groups: JSON.stringify(cible.muscleGroups),
  })
  return true
}

/** Vrai si la base locale contient déjà une ligne du catalogue de base (même supprimée). */
export async function catalogueDeBaseInstalle(db: DbLecture): Promise<boolean> {
  const { n } = await db.get<{ n: number }>('SELECT COUNT(*) AS n FROM exercises WHERE is_custom = 0')
  return n > 0
}

/**
 * Installe le catalogue de base (idempotent), en une seule transaction :
 *  - ligne absente : créée (is_custom = 0, id déterministe par nom normalisé) ;
 *  - ligne vivante de même id ou de même nom normalisé : jamais écrasée, seuls ses groupes
 *    musculaires sont corrigés ;
 *  - ligne supprimée logiquement : laissée supprimée.
 */
export async function installerCatalogueDeBase(db: Db, userId: string): Promise<ResultatInstallation> {
  const maintenant = new Date().toISOString()
  return db.writeTransaction(async (tx) => {
    const lignes = await tx.getAll<LigneExercice>(SQL_LIGNES)
    const parId = new Map(lignes.map((l) => [l.id, l]))
    const vivantesParNom = new Map<string, LigneExercice>()
    for (const l of lignes) if (l.deleted_at === null) vivantesParNom.set(normalizeSearch(l.name), l)
    const resultat: ResultatInstallation = { ajoutes: 0, corriges: 0, ignores: 0 }

    for (const e of catalogueDeBase()) {
      const cle = normalizeSearch(e.name)
      const id = deterministicId(`${userId}:exercises`, cle)
      const existante = vivantesParNom.get(cle) ?? parId.get(id)
      if (existante) {
        if (existante.deleted_at !== null) resultat.ignores++
        else if (await corrigerLigne(tx, existante, e, maintenant)) resultat.corriges++
        continue
      }
      await upsertRow(tx, 'exercises', {
        id,
        user_id: userId,
        updated_at: maintenant,
        deleted_at: null,
        name: e.name,
        category: e.category,
        muscle_groups: JSON.stringify(e.muscleGroups),
        description: e.description,
        is_favorite: 0,
        is_custom: 0,
        image_url: null,
        exercise_type: e.exerciseType,
        equipment: JSON.stringify(e.equipment),
        muscle_primary: e.musclePrimary,
        is_bodyweight: e.isBodyweight ? 1 : 0,
      })
      resultat.ajoutes++
    }
    return resultat
  })
}

/** Corrige les groupes musculaires de tous les exercices vivants ; renvoie le nombre corrigé. */
export async function corrigerGroupesMusculaires(db: Db): Promise<number> {
  const maintenant = new Date().toISOString()
  const base = baseParNom()
  return db.writeTransaction(async (tx) => {
    const lignes = await tx.getAll<LigneExercice>(`${SQL_LIGNES} WHERE deleted_at IS NULL`)
    let corriges = 0
    for (const l of lignes) {
      if (await corrigerLigne(tx, l, base.get(normalizeSearch(l.name)) ?? null, maintenant)) corriges++
    }
    return corriges
  })
}

const pluriel = (n: number, singulier: string, plurielTexte: string) => `${n} ${n > 1 ? plurielTexte : singulier}`

export function messageInstallation(r: ResultatInstallation): string {
  if (r.ajoutes === 0 && r.corriges === 0) return 'Le catalogue de base est déjà à jour.'
  const ajoutes = pluriel(r.ajoutes, 'exercice ajouté', 'exercices ajoutés')
  return `${ajoutes}, ${pluriel(r.corriges, 'corrigé', 'corrigés')}.`
}

export function messageCorrection(corriges: number): string {
  return corriges === 0 ? 'Les groupes musculaires sont déjà corrects.' : `${pluriel(corriges, 'exercice corrigé', 'exercices corrigés')}.`
}
