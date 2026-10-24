import type { Db } from '../Db'
import { newId } from '../ids'
import type { SerieRealisee } from '../types'
import { mapSerie, type Ligne } from './mappers'

export type NouvelleSerie = Omit<SerieRealisee, 'id' | 'updatedAt'>
export type ModifSerie = Partial<Pick<SerieRealisee,
  'repsRealisees' | 'chargeKg' | 'chargeLabel' | 'rpe' | 'notes' | 'isCompleted'>>

// Séries en ajout seul : chaque série a son propre uuid, on n'écrase jamais la ligne d'un autre appareil.
// `maintenant` (ISO) horodate la ligne ; l'exécution de séance le fournit pour dater le repos.
export async function addSerie(db: Db, serie: NouvelleSerie, maintenant: string = new Date().toISOString()): Promise<string> {
  const id = newId()
  await db.execute(
    `INSERT INTO series_realisees
       (id, instance_seance_id, exercice_seance_id, numero_serie, reps_realisees, charge_kg,
        charge_label, rpe, notes, is_completed, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, serie.instanceSeanceId, serie.exerciceSeanceId, serie.numeroSerie, serie.repsRealisees,
      serie.chargeKg, serie.chargeLabel, serie.rpe, serie.notes, serie.isCompleted ? 1 : 0,
      maintenant,
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
export async function listSeries(db: Db, instanceId: string): Promise<SerieRealisee[]> {
  const lignes = await db.getAll<Ligne>(
    'SELECT * FROM series_realisees WHERE instance_seance_id = ? AND deleted_at IS NULL',
    [instanceId],
  )
  const gardees = new Map<string, SerieRealisee>()
  for (const serie of lignes.map(mapSerie)) {
    const cle = `${serie.exerciceSeanceId}#${serie.numeroSerie}`
    const existante = gardees.get(cle)
    if (!existante || serie.updatedAt > existante.updatedAt || (serie.updatedAt === existante.updatedAt && serie.id > existante.id)) {
      gardees.set(cle, serie)
    }
  }
  return [...gardees.values()].sort(
    (a, b) => a.exerciceSeanceId.localeCompare(b.exerciceSeanceId) || a.numeroSerie - b.numeroSerie,
  )
}
