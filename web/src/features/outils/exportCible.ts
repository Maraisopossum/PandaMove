import { dateIsoLocale } from '../../core/common/dates'
import type { DbLecture } from '../../core/db/Db'

// Export ciblé : une partie des données (modules et période) en JSON ou en CSV. Lecture seule de la base locale ; le fichier
// reste sur l'appareil. L'export complet réimportable reste celui de useExport (format Android v3.2) : celui-ci sert à
// partager ou à analyser une partie des données, il n'est pas réimportable.

export type ModuleExport = 'renforcement' | 'sorties' | 'hyrox' | 'plans' | 'nutrition' | 'mobilite' | 'respiration' | 'calendrier'
export type PeriodeExport = 'tout' | 'mois' | 'trimestre' | 'annee'
export type FormatExport = 'json' | 'csv'

export const MODULES_EXPORT: { id: ModuleExport; nom: string }[] = [
  { id: 'renforcement', nom: 'Renforcement' },
  { id: 'sorties', nom: 'Course et vélo' },
  { id: 'hyrox', nom: 'Hyrox' },
  { id: 'plans', nom: 'Plans' },
  { id: 'nutrition', nom: 'Nutrition' },
  { id: 'mobilite', nom: 'Mobilité' },
  { id: 'respiration', nom: 'Respiration' },
  { id: 'calendrier', nom: 'Calendrier' },
]

export const PERIODES_EXPORT: { id: PeriodeExport; nom: string }[] = [
  { id: 'tout', nom: 'Tout' },
  { id: 'mois', nom: 'Ce mois' },
  { id: 'trimestre', nom: '3 mois' },
  { id: 'annee', nom: 'Cette année' },
]

/** Premier jour inclus (yyyy-MM-dd) ; null pour tout l'historique. */
export function debutPeriode(periode: PeriodeExport, maintenant: Date): string | null {
  if (periode === 'tout') return null
  if (periode === 'mois') return dateIsoLocale(new Date(maintenant.getFullYear(), maintenant.getMonth(), 1))
  if (periode === 'annee') return dateIsoLocale(new Date(maintenant.getFullYear(), 0, 1))
  return dateIsoLocale(new Date(maintenant.getFullYear(), maintenant.getMonth() - 3, maintenant.getDate()))
}

type Ligne = Record<string, string | number | null>
// `hyrox_segments` accompagne `hyrox` dans l'export JSON (temps de chaque segment) ; il n'a pas de case à cocher et reste hors du CSV.
export type DonneesCiblees = Partial<Record<ModuleExport | 'hyrox_segments', Ligne[]>>

// Les traces GPS et séries d'échantillons des sorties ne sont pas exportées ici (volumineuses) : elles restent dans la base.
const REQUETES: Record<ModuleExport, (filtreDate: string) => string> = {
  renforcement: (f) => `SELECT i.id, i.date, COALESCE(i.nom, s.nom) AS nom, i.duration_seconds AS duree_s,
      (SELECT COUNT(*) FROM series_realisees r WHERE r.instance_seance_id = i.id AND r.deleted_at IS NULL AND r.is_completed = 1) AS series
    FROM instances_seance i LEFT JOIN seances s ON s.id = i.seance_id
    WHERE i.deleted_at IS NULL AND i.is_completed = 1 ${f.replaceAll('{d}', 'i.date')} ORDER BY i.date`,
  sorties: (f) => `SELECT id, date, sport, titre, duree_s, distance_m, denivele_pos_m, fc_moy, fc_max, puissance_moy_w, rpe, en_salle, source, notes
    FROM sorties WHERE deleted_at IS NULL ${f.replaceAll('{d}', 'date')} ORDER BY date`,
  mobilite: (f) => `SELECT id, date, duree_sec AS duree_s, exercices, zones, sport
    FROM seances_mobilite WHERE deleted_at IS NULL ${f.replaceAll('{d}', 'date')} ORDER BY date`,
  respiration: (f) => `SELECT id, date, methode_nom, cycles, duree_sec AS duree_s
    FROM seances_respiration WHERE deleted_at IS NULL ${f.replaceAll('{d}', 'date')} ORDER BY date`,
  // Simulations terminées (le jour est celui du départ, en UTC) ; les segments sont lus à part, avec la même période
  hyrox: (f) => `SELECT id, substr(debut_at, 1, 10) AS date, 'Simulation Hyrox · ' || forme AS titre, 'hyrox' AS sport, total_s AS duree_s, categorie, genre, reference, notes
    FROM hyrox_simulations WHERE deleted_at IS NULL AND statut = 'terminee' ${f.replaceAll('{d}', 'substr(debut_at, 1, 10)')} ORDER BY debut_at`,
  // Objectifs de plan d'endurance (courses visées et résultats) ; la période ne s'applique pas à un objectif futur, comme pour le calendrier
  plans: () => `SELECT id, date, nom AS titre, discipline AS sport, cible_s AS duree_s, distance_m, priorite, statut, resultat_s, notes
    FROM objectifs_plan WHERE deleted_at IS NULL ORDER BY date`,
  // Journal alimentaire, eau comprise (repas = eau, quantité en ml) ; les valeurs sont celles de la quantité mangée
  nutrition: (f) => `SELECT id, date, nom AS titre, repas, quantite_g, kcal, proteines, glucides, lipides, fibres, source,
      repas || ' · ' || CAST(ROUND(quantite_g) AS INTEGER) || (CASE WHEN repas = 'eau' THEN ' ml' ELSE ' g · ' || CAST(ROUND(kcal) AS INTEGER) || ' kcal' END) AS detail
    FROM repas_entrees WHERE deleted_at IS NULL ${f.replaceAll('{d}', 'date')} ORDER BY date, created_at`,
  // Séances de cardio planifiées à venir (non validées) ; la période ne s'applique pas à un futur
  calendrier: () => `SELECT id, date, 'course' AS sport, titre, detail FROM seances_course WHERE deleted_at IS NULL AND is_validated = 0 AND date >= ?
    UNION ALL SELECT id, date, 'velo' AS sport, titre, detail FROM seances_velo WHERE deleted_at IS NULL AND is_validated = 0 AND date >= ? ORDER BY date`,
}

export async function lireDonneesCiblees(db: DbLecture, modules: readonly ModuleExport[], periode: PeriodeExport, maintenant: Date): Promise<DonneesCiblees> {
  const depuis = debutPeriode(periode, maintenant)
  const filtre = depuis ? 'AND {d} >= ?' : ''
  const aujourdhui = dateIsoLocale(maintenant)
  const resultat: DonneesCiblees = {}
  for (const m of MODULES_EXPORT.map((x) => x.id).filter((id) => modules.includes(id))) {
    const params = m === 'calendrier' ? [aujourdhui, aujourdhui] : m === 'plans' ? [] : depuis ? [depuis] : []
    resultat[m] = await db.getAll<Ligne>(REQUETES[m](filtre), params)
    if (m === 'hyrox') {
      resultat.hyrox_segments = await db.getAll<Ligne>(
        `SELECT g.id, g.simulation_id, g.rang, g.type, g.station, g.cible_s, g.reel_s FROM hyrox_segments g JOIN hyrox_simulations s ON s.id = g.simulation_id
         WHERE g.deleted_at IS NULL AND s.deleted_at IS NULL AND s.statut = 'terminee' ${filtre.replaceAll('{d}', 'substr(s.debut_at, 1, 10)')} ORDER BY s.debut_at, g.rang`,
        params,
      )
    }
  }
  return resultat
}

const LIBELLE_UNITE: Record<ModuleExport, [string, string]> = {
  renforcement: ['séance de renforcement', 'séances de renforcement'],
  sorties: ['sortie', 'sorties'],
  hyrox: ['simulation Hyrox', 'simulations Hyrox'],
  plans: ['objectif de plan', 'objectifs de plan'],
  nutrition: ['ligne du journal alimentaire', 'lignes du journal alimentaire'],
  mobilite: ['séance de mobilité', 'séances de mobilité'],
  respiration: ['séance de respiration', 'séances de respiration'],
  calendrier: ['séance prévue', 'séances prévues'],
}

/** « 9 sorties et 4 séances de mobilité » ; « Aucune donnée » si la sélection est vide. */
export function resumerSelection(donnees: DonneesCiblees): string {
  const parties = MODULES_EXPORT.map((m) => m.id).flatMap((id) => {
    const n = donnees[id]?.length ?? 0
    return n > 0 ? [`${n} ${LIBELLE_UNITE[id][n > 1 ? 1 : 0]}`] : []
  })
  if (parties.length === 0) return 'Aucune donnée sur cette sélection'
  return parties.length === 1 ? parties[0] : `${parties.slice(0, -1).join(', ')} et ${parties[parties.length - 1]}`
}

export function versJson(donnees: DonneesCiblees, periode: PeriodeExport, maintenant: Date): string {
  return JSON.stringify({ format: 'pandamove-export-partiel', version: 1, exporteLe: maintenant.toISOString(), depuis: debutPeriode(periode, maintenant), modules: donnees }, null, 2)
}

// Une cellule qui commence par = + - @ serait lue comme une formule par un tableur : on la préfixe d'une apostrophe.
function cellule(valeur: string | number | null | undefined): string {
  if (valeur === null || valeur === undefined) return ''
  let texte = String(valeur)
  if (typeof valeur === 'string' && /^[=+\-@\t\r]/.test(texte)) texte = `'${texte}`
  return /[";\n\r]/.test(texte) ? `"${texte.replaceAll('"', '""')}"` : texte
}

// Marque d'ordre des octets UTF-8 : sans elle, Excel lit les accents de travers
const BOM = String.fromCharCode(0xfeff)
const COLONNES_CSV = ['module', 'date', 'titre', 'sport', 'duree_s', 'distance_m', 'detail'] as const

/** CSV unique, séparateur « ; » (tableur français), BOM UTF-8 pour les accents. Colonnes communes à tous les modules. */
export function versCsv(donnees: DonneesCiblees): string {
  const lignes = MODULES_EXPORT.flatMap(({ id }) =>
    (donnees[id] ?? []).map((l) => {
      const titre = l.titre ?? l.nom ?? l.methode_nom ?? ''
      const detail = l.detail ?? (id === 'renforcement' ? `${l.series ?? 0} séries` : id === 'mobilite' ? `${l.exercices ?? 0} exercices` : id === 'respiration' ? `${l.cycles ?? 0} cycles` : id === 'plans' ? `${l.statut ?? ''}` : '')
      return { module: id, date: l.date, titre, sport: l.sport ?? '', duree_s: l.duree_s ?? '', distance_m: l.distance_m ?? '', detail }
    }),
  )
  return `${BOM}${[COLONNES_CSV.join(';'), ...lignes.map((l) => COLONNES_CSV.map((c) => cellule(l[c] as string | number | null)).join(';'))].join('\r\n')}\r\n`
}

export function nomFichierCible(maintenant: Date, format: FormatExport): string {
  return `pandamove-donnees-${dateIsoLocale(maintenant)}.${format}`
}
