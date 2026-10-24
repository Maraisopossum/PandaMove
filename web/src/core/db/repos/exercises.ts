import { normalizeSearch } from '../../common/normalizeSearch'
import type { Db, DbLecture } from '../Db'
import { deterministicId } from '../ids'
import { upsertRow } from '../upsert'
import type { Exercise } from '../types'
import { mapExercise, type Ligne } from './mappers'

// Catalogue d'exercices (non supprimés), triés par nom.
export async function listExercises(db: Db): Promise<Exercise[]> {
  const lignes = await db.getAll<Ligne>('SELECT * FROM exercises WHERE deleted_at IS NULL ORDER BY name')
  return lignes.map(mapExercise)
}

// Données saisies pour créer ou modifier un exercice personnalisé.
export interface NewExercise {
  name: string
  category?: string
  muscleGroups: string[]
  description?: string
  exerciseType?: string
  equipment?: string[]
  musclePrimary?: string
  isBodyweight?: boolean
}

// Erreur de validation destinée à l'utilisateur (message en français).
export class ErreurExercice extends Error {}

const MESSAGE_NOM_VIDE = "Le nom de l'exercice est obligatoire."
const MESSAGE_DOUBLON = 'Un exercice portant ce nom existe déjà.'

// Identifiant déterministe : même schéma que l'import, pour qu'un import ultérieur du même nom
// retombe sur la même ligne au lieu de la dupliquer.
export const idExercice = (userId: string, nom: string) => deterministicId(`${userId}:exercises`, normalizeSearch(nom))

// Les listes sont stockées en JSON d'un tableau de chaînes (ListConverters Room côté Android).
function champs(e: NewExercise): Record<string, unknown> {
  return {
    name: e.name.trim(),
    category: e.category || 'OTHER',
    muscle_groups: JSON.stringify(e.muscleGroups),
    description: e.description ?? '',
    exercise_type: e.exerciseType ?? '',
    equipment: JSON.stringify(e.equipment ?? []),
    muscle_primary: e.musclePrimary ?? '',
    is_bodyweight: e.isBodyweight ? 1 : 0,
  }
}

// Vrai si un autre exercice vivant porte le même nom normalisé.
async function nomPris(tx: DbLecture, nom: string, sauf: string | null): Promise<boolean> {
  const cible = normalizeSearch(nom)
  const lignes = await tx.getAll<{ id: string; name: string }>('SELECT id, name FROM exercises WHERE deleted_at IS NULL')
  return lignes.some((l) => l.id !== sauf && normalizeSearch(l.name) === cible)
}

// Crée un exercice personnalisé (is_custom = 1, comme les exercices importés). Une ligne supprimée
// de même nom est ressuscitée plutôt que dupliquée.
export async function creerExercice(db: Db, userId: string, e: NewExercise): Promise<string> {
  if (!normalizeSearch(e.name)) throw new ErreurExercice(MESSAGE_NOM_VIDE)
  const id = idExercice(userId, e.name)
  const maintenant = new Date().toISOString()
  await db.writeTransaction(async (tx) => {
    if (await nomPris(tx, e.name, null)) throw new ErreurExercice(MESSAGE_DOUBLON)
    const existante = await tx.getOptional<{ is_favorite: number | null; deleted_at: string | null }>(
      'SELECT is_favorite, deleted_at FROM exercises WHERE id = ?',
      [id],
    )
    // Une ligne vivante portant déjà cet id (exercice renommé depuis) ne doit jamais être écrasée
    if (existante && existante.deleted_at === null) throw new ErreurExercice(MESSAGE_DOUBLON)
    await upsertRow(tx, 'exercises', {
      id,
      user_id: userId,
      updated_at: maintenant,
      deleted_at: null,
      ...champs(e),
      is_custom: 1,
      is_favorite: 0,
      image_url: null,
    })
  })
  return id
}

// Modifie un exercice existant (l'id ne change pas, même si le nom change).
export async function modifierExercice(db: Db, id: string, e: NewExercise): Promise<void> {
  if (!normalizeSearch(e.name)) throw new ErreurExercice(MESSAGE_NOM_VIDE)
  await db.writeTransaction(async (tx) => {
    if (await nomPris(tx, e.name, id)) throw new ErreurExercice(MESSAGE_DOUBLON)
    await upsertRow(tx, 'exercises', { id, updated_at: new Date().toISOString(), ...champs(e) })
  })
}

export async function setFavori(db: Db, id: string, favori: boolean): Promise<void> {
  await db.execute('UPDATE exercises SET is_favorite = ?, updated_at = ? WHERE id = ?', [
    favori ? 1 : 0,
    new Date().toISOString(),
    id,
  ])
}
