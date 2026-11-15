import type { Db, DbLecture } from '../../core/db/Db'
import { creer, PREFIXE_SEANCE_HYROX } from '../../core/db/repos/seancesCardio'
import { dureeSemaine, type SemaineHyrox } from './planHyrox'

// Application du plan de préparation Hyrox à l'agenda. Les séances deviennent des séances de course de l'agenda dont le titre commence
// par « Hyrox · » : c'est ce préfixe qui les distingue (le module Plans les écarte de son taux de réalisation et de sa frise, pour ne pas
// mélanger la préparation Hyrox et le plan d'endurance). Les séances passées ou déjà validées ne sont jamais touchées.

export interface ApercuAgendaHyrox {
  /** Séances du plan à partir d'aujourd'hui, qui seront créées. */
  aCreer: number
  /** Séances Hyrox à venir, non validées, déjà dans l'agenda : elles sont remplacées. */
  aRemplacer: number
  /** Séances Hyrox déjà validées : conservées telles quelles. */
  gardees: number
  /** Séances du plan avant aujourd'hui : non ajoutées. */
  passees: number
}

const aVenir = (date: string, aujourdhui: string) => date >= aujourdhui

async function compter(db: DbLecture, sql: string, params: unknown[]): Promise<number> {
  const l = await db.getOptional<{ n: number }>(sql, params)
  return Number(l?.n ?? 0)
}

const MOTIF = `${PREFIXE_SEANCE_HYROX}%`

export async function apercuAgendaHyrox(db: DbLecture, plan: readonly SemaineHyrox[], aujourdhui: string): Promise<ApercuAgendaHyrox> {
  const seances = plan.flatMap((s) => s.seances)
  const aRemplacer = await compter(db, "SELECT COUNT(*) AS n FROM seances_course WHERE deleted_at IS NULL AND titre LIKE ? AND COALESCE(is_validated, 0) = 0 AND date >= ?", [MOTIF, aujourdhui])
  const gardees = await compter(db, 'SELECT COUNT(*) AS n FROM seances_course WHERE deleted_at IS NULL AND titre LIKE ? AND COALESCE(is_validated, 0) = 1', [MOTIF])
  return { aCreer: seances.filter((x) => aVenir(x.date, aujourdhui)).length, aRemplacer, gardees, passees: seances.filter((x) => !aVenir(x.date, aujourdhui)).length }
}

const supprimerAVenir = (tx: DbLecture & Pick<Db, 'execute'>, aujourdhui: string, maintenant: string) =>
  tx.execute(
    "UPDATE seances_course SET deleted_at = ?, updated_at = ? WHERE deleted_at IS NULL AND titre LIKE ? AND COALESCE(is_validated, 0) = 0 AND date >= ?",
    [maintenant, maintenant, MOTIF, aujourdhui],
  )

/** Remplace les séances Hyrox à venir de l'agenda par celles du plan. Renvoie le nombre de séances créées. */
export async function appliquerPlanAgenda(db: Db, plan: readonly SemaineHyrox[], aujourdhui: string): Promise<number> {
  return db.writeTransaction(async (tx) => {
    await supprimerAVenir(tx, aujourdhui, new Date().toISOString())
    let n = 0
    for (const semaine of plan) {
      for (const x of semaine.seances) {
        if (!aVenir(x.date, aujourdhui)) continue
        await creer(tx, 'course', {
          date: x.date,
          titre: `${PREFIXE_SEANCE_HYROX}${x.titre}`,
          detail: `${x.dureeMin} min`,
          consigne: `${x.detail} (semaine ${semaine.rang}, ${semaine.allegee ? 'allégée, ' : ''}${dureeSemaine(semaine)} min au total)`,
        })
        n++
      }
    }
    return n
  })
}

/** Retire de l'agenda les séances Hyrox à venir non validées. Renvoie leur nombre. */
export async function retirerPlanAgenda(db: Db, aujourdhui: string): Promise<number> {
  return db.writeTransaction(async (tx) => {
    const n = await compter(tx, 'SELECT COUNT(*) AS n FROM seances_course WHERE deleted_at IS NULL AND titre LIKE ? AND COALESCE(is_validated, 0) = 0 AND date >= ?', [MOTIF, aujourdhui])
    await supprimerAVenir(tx, aujourdhui, new Date().toISOString())
    return n
  })
}
