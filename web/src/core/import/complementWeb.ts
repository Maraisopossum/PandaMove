import type { DbTx } from '../db/Db'
import { deterministicId } from '../db/ids'
import { saveRappelsJsonTx } from '../db/repos/settings'
import { AppSchema } from '../db/schema'
import { upsertRow } from '../db/upsert'
import { TABLES_COMPLEMENT, type TableComplement } from '../export/complementWeb'

// Lecture et écriture du complément web d'une sauvegarde (champ `pandamoveWeb`, voir core/export/complementWeb.ts).
//
// Identifiants : pour une sauvegarde du MÊME compte (webUserId = compte connecté), les ids du fichier sont repris tels quels :
// réimporter est une mise à jour exacte, sans doublon, et une ligne supprimée depuis revient (« le fichier gagne », comme le
// reste de l'import). Pour un AUTRE compte, chaque id est dérivé du compte et de l'id d'origine (UUID v5) : même fichier
// réimporté deux fois = mêmes ids, donc aucun doublon ; les références entre lignes (sortie → séance planifiée, séance de
// respiration → méthode personnalisée) sont recalculées de la même façon.
//
// Validation : jamais de colonne inconnue, jamais de valeur autre que texte, nombre ou null, des longueurs bornées. Une ligne
// invalide est ignorée et comptée dans les remarques. Les contraintes SQL du serveur restent la dernière barrière : un rejet
// est signalé par le bandeau d'envois refusés.

export interface LigneComplement {
  table: TableComplement
  valeurs: Record<string, string | number | null>
}

export interface PlanComplement {
  lignes: LigneComplement[]
  /** Réglages des rappels normalisés (texte JSON) ; null si le fichier n'en porte pas. */
  rappelsJson: string | null
  /** Lignes retenues par table, pour l'aperçu et le résultat. */
  resume: Record<TableComplement, number>
  /** Remarques en clair (lignes ignorées). */
  remarques: string[]
}

const LIGNES_MAX = 50_000
const TEXTE_MAX = 500_000
const ID_MAX = 100
const RE_DATE = /^\d{4}-\d{2}-\d{2}$/
const RE_HEURE = /^([01]\d|2[0-3]):[0-5]\d$/

const COLONNES_PROPRES = new Map(
  TABLES_COMPLEMENT.map((t) => {
    const colonnes = new Set(AppSchema.tables.find((x) => x.name === t)?.columns.map((c) => c.name) ?? [])
    for (const c of ['user_id', 'updated_at', 'deleted_at', 'id']) colonnes.delete(c)
    return [t, colonnes] as const
  }),
)

const estObjet = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

const LIBELLES: Record<TableComplement, string> = {
  seances_course: 'séance(s) de course planifiée(s)',
  seances_velo: 'séance(s) de vélo planifiée(s)',
  sorties: 'sortie(s)',
  methodes_respiration: 'méthode(s) de respiration',
  seances_respiration: 'séance(s) de respiration',
  seances_mobilite: 'séance(s) de mobilité',
}
export const libelleComplement = (t: TableComplement) => LIBELLES[t]

// Réglages de rappels normalisés (mêmes règles que features/outils/rappels.ts, sans l'interrupteur propre à l'appareil)
function normaliserRappels(brut: unknown): string | null {
  if (typeof brut !== 'string' || brut.length > 500) return null
  try {
    const v = JSON.parse(brut) as Record<string, unknown> | null
    if (!estObjet(v)) return null
    return JSON.stringify({
      veille: typeof v.veille === 'boolean' ? v.veille : true,
      veilleHeure: typeof v.veilleHeure === 'string' && RE_HEURE.test(v.veilleHeure) ? v.veilleHeure : '19:00',
      jour: typeof v.jour === 'boolean' ? v.jour : true,
      jourHeure: typeof v.jourHeure === 'string' && RE_HEURE.test(v.jourHeure) ? v.jourHeure : '07:30',
    })
  } catch {
    return null
  }
}

// Ligne validée, ou null. `idDe` renvoie l'id à écrire pour (table, id d'origine).
function validerLigne(
  table: TableComplement,
  brute: unknown,
  idDe: (t: string, id: string) => string,
): Record<string, string | number | null> | null {
  if (!estObjet(brute)) return null
  const id = brute.id
  if (typeof id !== 'string' || id === '' || id.length > ID_MAX) return null
  const autorisees = COLONNES_PROPRES.get(table)!
  const valeurs: Record<string, string | number | null> = { id: idDe(table, id) }
  for (const [cle, v] of Object.entries(brute)) {
    if (cle === 'id' || !autorisees.has(cle)) continue
    if (v === null) valeurs[cle] = null
    else if (typeof v === 'number' && Number.isFinite(v)) valeurs[cle] = v
    else if (typeof v === 'string' && v.length <= TEXTE_MAX) valeurs[cle] = v
    else return null
  }
  // Toutes ces tables portent un jour et un horodatage de création (colonnes NOT NULL côté serveur), sauf les méthodes
  if (table !== 'methodes_respiration' && !(typeof valeurs.date === 'string' && RE_DATE.test(valeurs.date))) return null
  if (typeof valeurs.created_at !== 'string' || valeurs.created_at === '') return null
  return valeurs
}

/**
 * Extrait le complément web d'un fichier d'export déjà lu. Renvoie null quand le fichier n'en a pas (export Android, ou
 * sauvegarde d'une ancienne version du web).
 */
export function extraireComplement(data: unknown, userId: string): PlanComplement | null {
  if (!estObjet(data) || !estObjet(data.pandamoveWeb)) return null
  const bloc = data.pandamoveWeb
  const tables = estObjet(bloc.tables) ? bloc.tables : {}
  const memeCompte = data.webUserId === userId
  // Autre compte : ids dérivés ; même compte : ids du fichier
  const idDe = (t: string, id: string) => (memeCompte ? id : deterministicId(userId, `${t}|${id}`))

  const lignes: LigneComplement[] = []
  const resume = Object.fromEntries(TABLES_COMPLEMENT.map((t) => [t, 0])) as Record<TableComplement, number>
  const remarques: string[] = []
  for (const table of TABLES_COMPLEMENT) {
    const source = Array.isArray(tables[table]) ? (tables[table] as unknown[]) : []
    if (source.length > LIGNES_MAX) {
      remarques.push(`${LIBELLES[table]} : fichier trop volumineux (${LIGNES_MAX} lignes au plus), table ignorée`)
      continue
    }
    let invalides = 0
    for (const brute of source) {
      const valeurs = validerLigne(table, brute, idDe)
      if (!valeurs) {
        invalides++
        continue
      }
      // Références entre lignes, recalculées pour un autre compte
      if (!memeCompte) {
        if (table === 'sorties') {
          for (const [colonne, cible] of [['seance_course_id', 'seances_course'], ['seance_velo_id', 'seances_velo']] as const) {
            const ref = valeurs[colonne]
            if (typeof ref === 'string' && ref !== '') valeurs[colonne] = deterministicId(userId, `${cible}|${ref}`)
          }
        }
        if (table === 'seances_respiration' && typeof valeurs.methode_id === 'string') {
          const methodes = Array.isArray(tables.methodes_respiration) ? (tables.methodes_respiration as unknown[]) : []
          // Méthode personnalisée du fichier : son id change avec le compte ; les méthodes intégrées gardent leur nom
          if (methodes.some((m) => estObjet(m) && m.id === valeurs.methode_id)) {
            valeurs.methode_id = deterministicId(userId, `methodes_respiration|${valeurs.methode_id}`)
          }
        }
      }
      lignes.push({ table, valeurs })
      resume[table]++
    }
    if (invalides > 0) remarques.push(`${invalides} ${LIBELLES[table]} invalide(s), ignorée(s)`)
  }
  return { lignes, rappelsJson: normaliserRappels(bloc.rappelsJson), resume, remarques }
}

/** Nombre total de lignes du complément (hors rappels). */
export const totalComplement = (p: PlanComplement) => p.lignes.length

/** Écrit le complément dans la transaction de l'import : le fichier gagne, une ligne supprimée depuis revient. */
export async function appliquerComplement(tx: DbTx, plan: PlanComplement, userId: string): Promise<void> {
  const maintenant = new Date().toISOString()
  for (const { table, valeurs } of plan.lignes) {
    await upsertRow(tx, table, { ...valeurs, deleted_at: null, updated_at: maintenant })
  }
  if (plan.rappelsJson !== null) await saveRappelsJsonTx(tx, userId, plan.rappelsJson)
}
