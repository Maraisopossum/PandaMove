import { dateIsoValide } from '../../common/dates'
import type { Db, DbLecture } from '../Db'
import { deterministicId, newId } from '../ids'
import type { Ligne } from './mappers'

// Historique de mobilité (migration 0012) : une ligne par séance menée jusqu'au bout. Les exercices et zones vivent dans
// le code (features/mobilite/donnees.ts) ; la base ne garde que le résumé affiché (date, durée, nombre d'exercices, zones).

export const TABLE_MOBILITE = 'seances_mobilite'

export const SPORTS_MOBILITE = ['course', 'velo', 'renforcement', 'bureau'] as const
export type SportMobilite = (typeof SPORTS_MOBILITE)[number]

// Mêmes bornes que les contraintes SQL de 0012 (un rejet 23514 serait abandonné en silence par le connecteur).
export const LIMITES_MOBILITE = { dureeSec: 86_400, exercices: 200, zonesJson: 1000 } as const

export interface SeanceMobilite {
  id: string
  /** Jour local (yyyy-MM-dd). */
  date: string
  dureeS: number
  exercices: number
  zones: string[]
  sport: SportMobilite | null
}

export type SaisieSeanceMobilite = Omit<SeanceMobilite, 'id'> & { id?: string }

const estSport = (v: unknown): v is SportMobilite => SPORTS_MOBILITE.includes(v as SportMobilite)

function zonesDepuisJson(brut: unknown): string[] {
  try {
    const v = JSON.parse(typeof brut === 'string' ? brut : '[]') as unknown
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

function mapSeance(l: Ligne): SeanceMobilite {
  return {
    id: String(l.id),
    date: String(l.date ?? ''),
    dureeS: Number(l.duree_sec ?? 0),
    exercices: Number(l.exercices ?? 0),
    zones: zonesDepuisJson(l.zones),
    sport: estSport(l.sport) ? l.sport : null,
  }
}

// Valeurs prêtes à écrire, ou null si la séance violerait une contrainte SQL (elle n'est alors pas enregistrée).
function valeurs(s: SaisieSeanceMobilite): [string, number, number, string, SportMobilite | null] | null {
  if (!dateIsoValide(s.date)) return null
  const dureeS = Math.round(s.dureeS)
  if (!(dureeS >= 1 && dureeS <= LIMITES_MOBILITE.dureeSec)) return null
  if (!Number.isInteger(s.exercices) || s.exercices < 1 || s.exercices > LIMITES_MOBILITE.exercices) return null
  const zones = JSON.stringify(s.zones.filter((z) => typeof z === 'string'))
  if (zones.length > LIMITES_MOBILITE.zonesJson) return null
  return [s.date, dureeS, s.exercices, zones, estSport(s.sport) ? s.sport : null]
}

// Séances vivantes, les plus récentes d'abord.
export async function lireSeancesMobilite(db: DbLecture, limite = 60): Promise<SeanceMobilite[]> {
  const lignes = await db.getAll<Ligne>(
    `SELECT * FROM ${TABLE_MOBILITE} WHERE deleted_at IS NULL ORDER BY date DESC, created_at DESC, id DESC LIMIT ?`,
    [limite],
  )
  return lignes.map(mapSeance)
}

// `user_id` n'est pas écrit : le serveur le remplit avec auth.uid(). Renvoie l'id, ou null si la séance est invalide.
export async function enregistrerSeanceMobilite(db: Db, saisie: SaisieSeanceMobilite): Promise<string | null> {
  const v = valeurs(saisie)
  if (!v) return null
  const id = saisie.id ?? newId()
  const maintenant = new Date().toISOString()
  await db.execute(
    `INSERT INTO ${TABLE_MOBILITE} (id, date, duree_sec, exercices, zones, sport, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, ...v, maintenant, maintenant],
  )
  return id
}

// Reprise de l'historique gardé jusqu'ici dans le navigateur (avant 0012). Identifiants déterministes (compte + contenu +
// rang) : relancer la reprise, même après un échec partiel, ne crée aucun doublon. Les séances invalides sont ignorées.
// `anciennes` est dans l'ordre du stockage (plus récente d'abord) ; created_at suit cet ordre pour garder le tri.
export async function reprendreHistoriqueLocal(db: Db, userId: string, anciennes: readonly Omit<SeanceMobilite, 'id'>[]): Promise<number> {
  let reprises = 0
  await db.writeTransaction(async (tx) => {
    const base = Date.now()
    for (const [rang, s] of anciennes.entries()) {
      const v = valeurs(s)
      if (!v) continue
      const id = deterministicId(userId, `${TABLE_MOBILITE}|${s.date}|${v[1]}|${s.exercices}|${v[3]}|${rang}`)
      if (await tx.getOptional<Ligne>(`SELECT id FROM ${TABLE_MOBILITE} WHERE id = ?`, [id])) continue
      const instant = new Date(base - rang * 1000).toISOString()
      await tx.execute(
        `INSERT INTO ${TABLE_MOBILITE} (id, date, duree_sec, exercices, zones, sport, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, ...v, instant, instant],
      )
      reprises++
    }
  })
  return reprises
}
