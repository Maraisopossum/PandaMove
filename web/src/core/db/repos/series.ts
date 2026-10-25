import { comparerHorodatages } from '../../common/parseTimestamp'
import type { Db, DbLecture, DbTx } from '../Db'
import { newId } from '../ids'
import type { SerieRealisee } from '../types'
import { mapSerie, type Ligne } from './mappers'

export type NouvelleSerie = Omit<SerieRealisee, 'id' | 'updatedAt' | 'validatedAt'>
export type ModifSerie = Partial<Pick<SerieRealisee,
  'repsRealisees' | 'chargeKg' | 'chargeLabel' | 'rpe' | 'notes' | 'isCompleted'>>

// Séries en ajout seul : chaque série a son propre uuid, on n'écrase jamais la ligne d'un autre appareil.
// `maintenant` (ISO) horodate la ligne ET pose validated_at, l'ancre du repos : contrairement à
// updated_at (réécrit par le trigger serveur à l'envoi et par une correction), il ne bouge plus.
export async function addSerie(db: Db | DbTx, serie: NouvelleSerie, maintenant: string = new Date().toISOString()): Promise<string> {
  const id = newId()
  await db.execute(
    `INSERT INTO series_realisees
       (id, instance_seance_id, exercice_seance_id, numero_serie, reps_realisees, charge_kg,
        charge_label, rpe, notes, is_completed, updated_at, validated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, serie.instanceSeanceId, serie.exerciceSeanceId, serie.numeroSerie, serie.repsRealisees,
      serie.chargeKg, serie.chargeLabel, serie.rpe, serie.notes, serie.isCompleted ? 1 : 0,
      maintenant, maintenant,
    ],
  )
  return id
}

const COLONNES: Record<keyof ModifSerie, string> = {
  repsRealisees: 'reps_realisees',
  chargeKg: 'charge_kg',
  chargeLabel: 'charge_label',
  rpe: 'rpe',
  notes: 'notes',
  isCompleted: 'is_completed',
}

// Modifie une série existante (par son uuid) ; seuls les champs fournis sont changés.
export async function updateSerie(
  db: Db,
  id: string,
  patch: ModifSerie,
  maintenant: string = new Date().toISOString(),
): Promise<void> {
  const cles = (Object.keys(patch) as (keyof ModifSerie)[]).filter((k) => patch[k] !== undefined)
  const valeurs = cles.map((k) => (k === 'isCompleted' ? (patch[k] ? 1 : 0) : patch[k]))
  const affectations = [...cles.map((k) => `${COLONNES[k]} = ?`), 'updated_at = ?']
  await db.execute(`UPDATE series_realisees SET ${affectations.join(', ')} WHERE id = ?`, [
    ...valeurs,
    maintenant,
    id,
  ])
}

// Séries d'une instance. Si deux appareils ont créé la même (exercice, numéro) hors-ligne,
// seule la ligne au updated_at le plus récent est conservée (dédoublonnage à la lecture).
// Comparaison par instant : une ligne synchronisée (« 2026-10-24 16:00:00+00 ») et une ligne locale
// (« 2026-10-24T16:00:00.000Z ») ne se comparent pas correctement comme du texte.
export async function listSeries(db: DbLecture, instanceId: string): Promise<SerieRealisee[]> {
  const lignes = await db.getAll<Ligne>(
    'SELECT * FROM series_realisees WHERE instance_seance_id = ? AND deleted_at IS NULL',
    [instanceId],
  )
  const gardees = new Map<string, SerieRealisee>()
  for (const serie of lignes.map(mapSerie)) {
    const cle = `${serie.exerciceSeanceId}#${serie.numeroSerie}`
    const existante = gardees.get(cle)
    const ordre = existante ? comparerHorodatages(serie.updatedAt, existante.updatedAt) : 1
    if (!existante || ordre > 0 || (ordre === 0 && serie.id > existante.id)) {
      gardees.set(cle, serie)
    }
  }
  return [...gardees.values()].sort(
    (a, b) => a.exerciceSeanceId.localeCompare(b.exerciceSeanceId) || a.numeroSerie - b.numeroSerie,
  )
}

// Suppression LOGIQUE (deleted_at, jamais DELETE) des séries vivantes d'un exercice d'instance pour les
// numéros donnés : dé-validation d'une ligne, ou retrait des dernières lignes.
export async function supprimerSeriesNumeros(
  db: Db | DbTx,
  instanceId: string,
  exerciceId: string,
  numeros: number[],
  maintenant: string = new Date().toISOString(),
): Promise<void> {
  if (numeros.length === 0) return
  await db.execute(
    `UPDATE series_realisees SET deleted_at = ?, updated_at = ?
     WHERE instance_seance_id = ? AND exercice_seance_id = ? AND deleted_at IS NULL
       AND numero_serie IN (${numeros.map(() => '?').join(', ')})`,
    [maintenant, maintenant, instanceId, exerciceId, ...numeros],
  )
}

// Nombre de séries prévues de la ligne D'INSTANCE d'un exercice (jamais celle du modèle).
export async function changerSeriesPrevues(
  db: Db | DbTx,
  instanceId: string,
  exerciceId: string,
  nombre: number,
  maintenant: string = new Date().toISOString(),
): Promise<void> {
  await db.execute(
    `UPDATE exercices_seance SET nombre_series_prevues = ?, updated_at = ?
     WHERE id = ? AND instance_seance_id = ? AND deleted_at IS NULL`,
    [nombre, maintenant, exerciceId, instanceId],
  )
}
