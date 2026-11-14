import type { DbLecture } from '../../core/db/Db'

export interface RapportIntegrite {
  /** Séries réalisées dont la séance jouée n'existe plus. */
  seriesOrphelines: number
  /** Séances jouées dont le modèle n'existe plus. */
  seancesSansModele: number
}

/** Relit la base locale et compte les incohérences ; ne modifie rien. */
export async function verifierIntegrite(db: DbLecture): Promise<RapportIntegrite> {
  const n = async (sql: string) => Number((await db.getOptional<{ n: number }>(sql))?.n ?? 0)
  const [seriesOrphelines, seancesSansModele] = await Promise.all([
    n(`SELECT COUNT(*) AS n FROM series_realisees r WHERE r.deleted_at IS NULL
         AND NOT EXISTS (SELECT 1 FROM instances_seance i WHERE i.id = r.instance_seance_id AND i.deleted_at IS NULL)`),
    n(`SELECT COUNT(*) AS n FROM instances_seance i WHERE i.deleted_at IS NULL
         AND NOT EXISTS (SELECT 1 FROM seances s WHERE s.id = i.seance_id)`),
  ])
  return { seriesOrphelines, seancesSansModele }
}

export function resumerIntegrite(r: RapportIntegrite): string {
  if (r.seriesOrphelines === 0 && r.seancesSansModele === 0) return 'Aucune anomalie : toutes les données sont cohérentes.'
  const p = (n: number, un: string, plusieurs: string) => `${n} ${n > 1 ? plusieurs : un}`
  const parties = [
    ...(r.seriesOrphelines > 0 ? [p(r.seriesOrphelines, 'série orpheline', 'séries orphelines')] : []),
    ...(r.seancesSansModele > 0 ? [p(r.seancesSansModele, 'séance sans modèle', 'séances sans modèle')] : []),
  ]
  return `À examiner : ${parties.join(' et ')}. Rien n’a été modifié.`
}
