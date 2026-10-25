import type { DbLecture } from '../../core/db/Db'
import type { Ligne } from '../../core/db/repos/mappers'
import { instanceEnVue } from '../calendar/calendrier'
import type { InstanceVue } from '../calendar/types'

// Séances jouées du module Renforcement (sous-menus « Séances programmées » et « Séances terminées »).
// Même vue que le calendrier : nom conservé si le modèle est supprimé, état, durée et séries validées.

// Instances vivantes du renforcement. Jointure externe : une instance dont le modèle n'existe plus
// du tout reste visible (nom de repli), seules les autres catégories (course, vélo…) sont exclues.
const SELECT_RENFORCEMENT = `SELECT i.* FROM instances_seance i
  LEFT JOIN seances s ON s.id = i.seance_id
  WHERE i.deleted_at IS NULL AND (s.id IS NULL OR UPPER(COALESCE(s.seance_category, 'STRENGTH')) = 'STRENGTH')`

// Non terminées (planifiées ou en cours), y compris en retard, par date planifiée croissante.
export async function lireSeancesProgrammees(db: DbLecture): Promise<InstanceVue[]> {
  const lignes = await db.getAll<Ligne>(`${SELECT_RENFORCEMENT} AND i.is_completed = 0 ORDER BY i.date, i.id`)
  return Promise.all(lignes.map((l) => instanceEnVue(db, l)))
}

// Terminées, la plus récente (date planifiée) en premier.
export async function lireSeancesTerminees(db: DbLecture): Promise<InstanceVue[]> {
  const lignes = await db.getAll<Ligne>(
    `${SELECT_RENFORCEMENT} AND i.is_completed = 1 ORDER BY i.date DESC, i.completed_at DESC, i.id`,
  )
  return Promise.all(lignes.map((l) => instanceEnVue(db, l)))
}

// « 45 min · 12 séries validées » : durée omise si inconnue (séance importée sans horloge).
export function detailsTerminee(i: Pick<InstanceVue, 'dureeSec' | 'nbSeries'>): string {
  const parties: string[] = []
  const duree = i.dureeSec ?? 0
  if (duree > 0) parties.push(duree < 60 ? 'moins d’une minute' : `${Math.round(duree / 60)} min`)
  const n = i.nbSeries ?? 0
  parties.push(`${n} série${n > 1 ? 's' : ''} validée${n > 1 ? 's' : ''}`)
  return parties.join(' · ')
}
