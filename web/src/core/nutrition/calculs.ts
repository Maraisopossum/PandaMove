// Règles de calcul de la nutrition : apports d'une quantité, totaux du jour, besoins énergétiques et objectifs proposés.
// Aucune dépendance à la base ni à l'interface : tout est testé sous Vitest (calculs.test.ts).

export type Repas = 'petit_dejeuner' | 'dejeuner' | 'collation' | 'diner'
export const REPAS: readonly Repas[] = ['petit_dejeuner', 'dejeuner', 'collation', 'diner']
export const LIBELLE_REPAS: Record<Repas, string> = {
  petit_dejeuner: 'Petit-déjeuner',
  dejeuner: 'Déjeuner',
  collation: 'Collation',
  diner: 'Dîner',
}
export const estRepas = (v: unknown): v is Repas => typeof v === 'string' && (REPAS as readonly string[]).includes(v)

/** Valeurs nutritionnelles pour 100 g (ou 100 ml). */
export interface Valeurs100 {
  kcal: number
  proteines: number
  glucides: number
  lipides: number
  fibres: number | null
}

/** Apport d'une quantité mangée. */
export interface Apport {
  kcal: number
  proteines: number
  glucides: number
  lipides: number
  fibres: number
}

export const APPORT_NUL: Apport = { kcal: 0, proteines: 0, glucides: 0, lipides: 0, fibres: 0 }

const arrondir = (v: number, decimales: number) => {
  const f = 10 ** decimales
  return Math.round((v + Number.EPSILON) * f) / f
}

/** Apport pour `grammes` d'un aliment : énergie à l'unité, macros au dixième. */
export function apportPourQuantite(v: Valeurs100, grammes: number): Apport {
  const f = Math.max(0, grammes) / 100
  return {
    kcal: arrondir(v.kcal * f, 0),
    proteines: arrondir(v.proteines * f, 1),
    glucides: arrondir(v.glucides * f, 1),
    lipides: arrondir(v.lipides * f, 1),
    fibres: arrondir((v.fibres ?? 0) * f, 1),
  }
}

export function sommer(apports: readonly Apport[]): Apport {
  const somme = apports.reduce(
    (t, a) => ({ kcal: t.kcal + a.kcal, proteines: t.proteines + a.proteines, glucides: t.glucides + a.glucides, lipides: t.lipides + a.lipides, fibres: t.fibres + a.fibres }),
    APPORT_NUL,
  )
  return { kcal: arrondir(somme.kcal, 0), proteines: arrondir(somme.proteines, 1), glucides: arrondir(somme.glucides, 1), lipides: arrondir(somme.lipides, 1), fibres: arrondir(somme.fibres, 1) }
}

/** Réécrit un apport pour une nouvelle quantité, en gardant les proportions (modifier le grammage d'une entrée du journal). */
export function mettreALEchelle(apport: Apport, ancienneG: number, nouvelleG: number): Apport {
  if (ancienneG <= 0) return apport
  const f = Math.max(0, nouvelleG) / ancienneG
  return {
    kcal: arrondir(apport.kcal * f, 0),
    proteines: arrondir(apport.proteines * f, 1),
    glucides: arrondir(apport.glucides * f, 1),
    lipides: arrondir(apport.lipides * f, 1),
    fibres: arrondir(apport.fibres * f, 1),
  }
}

/** Énergie attendue des macros (4-4-9 kcal/g) : sert à repérer une saisie incohérente. */
export const kcalDesMacros = (p: number, g: number, l: number) => Math.round(4 * p + 4 * g + 9 * l)

/** Écart relatif entre l'énergie saisie et celle des macros ; null si l'énergie est nulle. */
export function ecartEnergie(kcal: number, p: number, g: number, l: number): number | null {
  if (kcal <= 0) return null
  return Math.abs(kcalDesMacros(p, g, l) - kcal) / kcal
}

/** Repas proposé par défaut selon l'heure locale. */
export function repasParDefaut(heure: number): Repas {
  if (heure < 10) return 'petit_dejeuner'
  if (heure < 15) return 'dejeuner'
  if (heure < 18) return 'collation'
  return 'diner'
}

// ── Besoins et objectifs ─────────────────────────────────────────────────────────────────────────────────────────────

export type Sexe = 'homme' | 'femme'
export type Activite = 'sedentaire' | 'legere' | 'moderee' | 'intense'
export type But = 'perte' | 'maintien' | 'prise'

export interface ProfilNutrition {
  sexe: Sexe
  age: number
  tailleCm: number
  poidsKg: number
  activite: Activite
  but: But
}

export const FACTEUR_ACTIVITE: Record<Activite, number> = { sedentaire: 1.2, legere: 1.375, moderee: 1.55, intense: 1.725 }
export const LIBELLE_ACTIVITE: Record<Activite, string> = {
  sedentaire: 'Sédentaire (peu ou pas de sport)',
  legere: 'Légère (1 à 3 séances par semaine)',
  moderee: 'Modérée (3 à 5 séances par semaine)',
  intense: 'Intense (6 séances ou plus, ou travail physique)',
}
export const LIBELLE_BUT: Record<But, string> = { perte: 'Perdre du poids', maintien: 'Maintenir mon poids', prise: 'Prendre du muscle' }
const AJUSTEMENT_BUT: Record<But, number> = { perte: -0.15, maintien: 0, prise: 0.1 }
const PROTEINES_G_PAR_KG: Record<But, number> = { perte: 2, maintien: 1.6, prise: 1.8 }

export const LIMITES_PROFIL = { age: [14, 100], tailleCm: [120, 230], poidsKg: [30, 250] } as const

/** Message d'erreur du profil, ou null s'il est exploitable. */
export function verifierProfil(p: ProfilNutrition): string | null {
  const dans = (v: number, [min, max]: readonly [number, number]) => Number.isFinite(v) && v >= min && v <= max
  if (!dans(p.age, LIMITES_PROFIL.age)) return `L’âge doit être compris entre ${LIMITES_PROFIL.age[0]} et ${LIMITES_PROFIL.age[1]} ans.`
  if (!dans(p.tailleCm, LIMITES_PROFIL.tailleCm)) return `La taille doit être comprise entre ${LIMITES_PROFIL.tailleCm[0]} et ${LIMITES_PROFIL.tailleCm[1]} cm.`
  if (!dans(p.poidsKg, LIMITES_PROFIL.poidsKg)) return `Le poids doit être compris entre ${LIMITES_PROFIL.poidsKg[0]} et ${LIMITES_PROFIL.poidsKg[1]} kg.`
  return null
}

/** Métabolisme de base (Mifflin-St Jeor), en kcal par jour. */
export function metabolismeDeBase(p: ProfilNutrition): number {
  return Math.round(10 * p.poidsKg + 6.25 * p.tailleCm - 5 * p.age + (p.sexe === 'homme' ? 5 : -161))
}

export interface ObjectifsNutrition {
  kcal: number
  proteinesG: number
  glucidesG: number
  lipidesG: number
  eauMl: number
}

/**
 * Objectifs proposés : énergie = dépense estimée ajustée au but (-15 % pour perdre, +10 % pour prendre), protéines selon le poids et le
 * but, lipides à 27 % de l'énergie (au moins 0,8 g/kg), glucides pour le reste, eau à 35 ml/kg. Un point de départ, pas une prescription :
 * l'écran invite à ajuster selon l'évolution du poids.
 */
export function proposerObjectifs(p: ProfilNutrition): ObjectifsNutrition {
  const depense = metabolismeDeBase(p) * FACTEUR_ACTIVITE[p.activite]
  const kcal = Math.max(1200, Math.round((depense * (1 + AJUSTEMENT_BUT[p.but])) / 10) * 10)
  const proteinesG = Math.round(PROTEINES_G_PAR_KG[p.but] * p.poidsKg)
  const lipidesG = Math.round(Math.max(0.8 * p.poidsKg, (0.27 * kcal) / 9))
  const glucidesG = Math.max(0, Math.round((kcal - 4 * proteinesG - 9 * lipidesG) / 4))
  const eauMl = Math.round((35 * p.poidsKg) / 50) * 50
  return { kcal, proteinesG, glucidesG, lipidesG, eauMl }
}

/** Part de l'énergie apportée par chaque macro (en %, somme 100), ou null si l'apport est nul. */
export function repartitionEnergie(a: Apport): { proteines: number; glucides: number; lipides: number } | null {
  const total = 4 * a.proteines + 4 * a.glucides + 9 * a.lipides
  if (total <= 0) return null
  const p = Math.round((4 * a.proteines * 100) / total)
  const l = Math.round((9 * a.lipides * 100) / total)
  return { proteines: p, glucides: Math.max(0, 100 - p - l), lipides: l }
}

// ── Bilan sur plusieurs jours ────────────────────────────────────────────────────────────────────────────────────────

export interface JourBilan {
  date: string
  apport: Apport
}

export interface ResumeBilan {
  /** Jours où au moins un aliment est noté. */
  joursSaisis: number
  /** Moyenne sur les jours saisis (les jours vides ne tirent pas la moyenne vers le bas). */
  moyenne: Apport
  /** Jours saisis où l'énergie est dans une marge de ±10 % de l'objectif. */
  joursDansLaCible: number
}

export function resumerBilan(jours: readonly JourBilan[], objectifKcal: number | null): ResumeBilan {
  const saisis = jours.filter((j) => j.apport.kcal > 0)
  const n = saisis.length
  const moyenne = n === 0 ? APPORT_NUL : (() => {
    const s = sommer(saisis.map((j) => j.apport))
    return { kcal: arrondir(s.kcal / n, 0), proteines: arrondir(s.proteines / n, 1), glucides: arrondir(s.glucides / n, 1), lipides: arrondir(s.lipides / n, 1), fibres: arrondir(s.fibres / n, 1) }
  })()
  const joursDansLaCible = objectifKcal ? saisis.filter((j) => Math.abs(j.apport.kcal - objectifKcal) <= objectifKcal * 0.1).length : 0
  return { joursSaisis: n, moyenne, joursDansLaCible }
}
