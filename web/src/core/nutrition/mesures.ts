// Unités de mesure des aliments : on compte comme on mange (à la pièce, au verre, à la cuillère ou au poids).
// Chaque aliment a une base, 'g' (valeurs pour 100 g) ou 'ml' (valeurs pour 100 ml), et des mesures ramenées à cette base
// (1 œuf = 60 g, 1 verre = 200 ml). Aucune conversion entre grammes et millilitres : on ne propose que les mesures valides.
// Fonctions pures : le calcul nutritionnel se fait toujours sur la quantité de base (voir apportPourQuantite).

export type UniteBase = 'g' | 'ml'

export interface Mesure {
  /** Identifiant stable dans l'aliment (« oeuf », « verre », « g ») : c'est lui qui est gardé dans le journal (unite_saisie). */
  id: string
  /** Singulier et pluriel affichés : « œuf » / « œufs ». */
  libelle: string
  pluriel: string
  /** Quantité de base (g ou ml) d'une unité de cette mesure. */
  base: number
  /** Précision facultative, par exemple le libellé d'origine de l'emballage (« 1 biscuit (12,5 g) »). */
  detail?: string
}

/** Ce qu'il faut d'un aliment pour connaître ses mesures. */
export interface AvecMesures {
  uniteBase: UniteBase
  mesures: readonly Mesure[]
}

export const LIMITES_MESURES = { nombre: 12, libelle: 40, detail: 100, base: 5000, json: 4000 } as const

/** Mesures communes des liquides : proposées seulement quand la base est en ml. */
export const MESURES_LIQUIDES: readonly Mesure[] = [
  { id: 'verre', libelle: 'verre', pluriel: 'verres', base: 200 },
  { id: 'tasse', libelle: 'tasse', pluriel: 'tasses', base: 250 },
  { id: 'bol', libelle: 'bol', pluriel: 'bols', base: 300 },
  { id: 'canette', libelle: 'canette', pluriel: 'canettes', base: 330 },
  { id: 'c-a-soupe', libelle: 'c. à soupe', pluriel: 'c. à soupe', base: 15 },
  { id: 'c-a-cafe', libelle: 'c. à café', pluriel: 'c. à café', base: 5 },
]

/** L'unité de base elle-même, toujours disponible. */
export const mesureDeBase = (u: UniteBase): Mesure => ({ id: u, libelle: u, pluriel: u, base: 1 })

export const estUniteDeBase = (m: Pick<Mesure, 'id'>): boolean => m.id === 'g' || m.id === 'ml'

/** Identifiant lisible tiré d'un libellé : « c. à soupe » → « c-a-soupe », « Œuf » → « oeuf ». */
export function identifiantMesure(libelle: string): string {
  const s = libelle.toLowerCase().replace(/œ/g, 'oe').replace(/æ/g, 'ae').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, LIMITES_MESURES.libelle)
  return s || 'mesure'
}

/**
 * Mesures proposées pour un aliment, dans l'ordre d'affichage : les siennes (la première est celle par défaut), puis les mesures
 * communes des liquides si la base est en ml (sans doublon de libellé), puis l'unité de base.
 */
export function mesuresDisponibles(a: AvecMesures): Mesure[] {
  const propres = a.mesures.filter((m) => !estUniteDeBase(m))
  const libelles = new Set(propres.map((m) => m.libelle.toLowerCase()))
  const communes = a.uniteBase === 'ml' ? MESURES_LIQUIDES.filter((m) => !libelles.has(m.libelle.toLowerCase()) && !propres.some((p) => p.id === m.id)) : []
  return [...propres, ...communes, mesureDeBase(a.uniteBase)]
}

/** Mesure proposée par défaut : la première de l'aliment, sinon l'unité de base. */
export const mesureParDefaut = (a: AvecMesures): Mesure => mesuresDisponibles(a)[0]

/** Mesure d'identifiant donné parmi celles de l'aliment, sinon null (mesure supprimée depuis la saisie, entrée ancienne…). */
export const trouverMesure = (a: AvecMesures, id: string | null | undefined): Mesure | null =>
  id ? (mesuresDisponibles(a).find((m) => m.id === id) ?? null) : null

export const versBase = (quantite: number, m: Mesure): number => quantite * m.base
export const depuisBase = (quantiteBase: number, m: Mesure): number => (m.base > 0 ? quantiteBase / m.base : 0)

/** Pas du réglage : une demi-unité pour les pièces et portions, 10 g, 50 ml. */
export function pasDe(m: Mesure): number {
  if (m.id === 'g') return 10
  if (m.id === 'ml') return 50
  return 0.5
}

/** Arrondi d'une quantité saisie : quart d'unité pour les mesures, gramme ou 5 ml pour la base. */
export function arrondirSaisie(quantite: number, m: Mesure): number {
  if (!Number.isFinite(quantite) || quantite <= 0) return 0
  if (m.id === 'g') return Math.round(quantite)
  if (m.id === 'ml') return Math.round(quantite / 5) * 5
  return Math.round(quantite * 4) / 4
}

const FRACTIONS: Record<number, string> = { 0.25: '¼', 0.5: '½', 0.75: '¾' }
const nombreFr = (n: number, decimales = 1) => n.toLocaleString('fr-FR', { maximumFractionDigits: decimales })

/** Nombre d'unités lisible : 1, 2, ½, 1 ½, ¾ ; sinon un décimal (1,3). */
export function nombreDUnites(q: number): string {
  const entier = Math.floor(q + 1e-9)
  const reste = Math.round((q - entier) * 100) / 100
  const fraction = FRACTIONS[reste]
  if (reste === 0) return String(entier)
  if (fraction) return entier === 0 ? fraction : `${entier} ${fraction}`
  return nombreFr(q)
}

/** « 2 œufs », « ½ banane », « 1 verre », « 180 g », « 250 ml », « 1,5 L ». */
export function libelleQuantite(quantite: number, m: Mesure): string {
  if (m.id === 'g') return `${nombreFr(quantite)} g`
  if (m.id === 'ml') return quantite >= 1000 ? `${nombreFr(quantite / 1000, 2)} L` : `${nombreFr(quantite)} ml`
  return `${nombreDUnites(quantite)} ${quantite > 1 ? m.pluriel : m.libelle}`
}

/** Équivalence en base écrite sous le nombre : « = 120 g », « = 200 ml » ; rien pour l'unité de base elle-même. */
export function equivalence(quantite: number, m: Mesure, uniteBase: UniteBase): string | null {
  if (estUniteDeBase(m)) return null
  return `= ${libelleQuantite(Math.round(versBase(quantite, m) * 10) / 10, mesureDeBase(uniteBase))}`
}

/**
 * Raccourcis du réglage, en nombre d'unités de la mesure : 1 à 4 pièces (½ à 2 pour une grosse portion comme une assiette) ;
 * en grammes, autour de la portion habituelle ; en millilitres, verre, 25 cl, canette, 50 cl.
 */
export function raccourcis(m: Mesure, portionHabituelle?: number): number[] {
  if (m.id === 'ml') return [200, 250, 330, 500]
  if (m.id === 'g') {
    const h = portionHabituelle && portionHabituelle > 0 ? portionHabituelle : 100
    const dix = (x: number) => Math.max(10, Math.round(x / 10) * 10)
    return [...new Set([dix(h / 2), dix(h), dix(h * 1.5), dix(h * 2)])]
  }
  return m.base >= 150 ? [0.5, 1, 1.5, 2] : [1, 2, 3, 4]
}

/** Mesure « portion » reprise d'une ancienne portion unique (portion_g, portion_label), ou null s'il n'y en avait pas. */
export function mesureDepuisPortion(portionG: number | null | undefined, portionLabel: string | null | undefined): Mesure | null {
  const label = portionLabel?.trim() || null
  if (!portionG || portionG <= 0 || (label === null && portionG === 100)) return null
  return { id: 'portion', libelle: 'portion', pluriel: 'portions', base: portionG, ...(label ? { detail: label } : {}) }
}

/** Mesures valides et bornées (même règles que la migration 0022), ou un message d'erreur. */
export function verifierMesures(mesures: readonly Mesure[]): string | null {
  if (mesures.length > LIMITES_MESURES.nombre) return `${LIMITES_MESURES.nombre} mesures au plus.`
  const ids = new Set<string>()
  for (const m of mesures) {
    if (!m.libelle.trim() || !m.pluriel.trim()) return 'Chaque mesure a besoin d’un nom.'
    if (Array.from(m.libelle).length > LIMITES_MESURES.libelle || Array.from(m.pluriel).length > LIMITES_MESURES.libelle) return 'Le nom d’une mesure est trop long.'
    if (!Number.isFinite(m.base) || m.base <= 0 || m.base > LIMITES_MESURES.base) return `Une mesure vaut entre 0 et ${LIMITES_MESURES.base}.`
    if (m.detail && Array.from(m.detail).length > LIMITES_MESURES.detail) return 'La précision d’une mesure est trop longue.'
    if (!m.id || estUniteDeBase(m) || ids.has(m.id)) return 'Deux mesures portent le même nom.'
    ids.add(m.id)
  }
  if (JSON.stringify(mesures).length > LIMITES_MESURES.json) return 'Trop de mesures.'
  return null
}

/** Lecture tolérante de mesures_json : une valeur absente ou abîmée donne une liste vide, jamais une erreur. */
export function lireMesures(json: unknown): Mesure[] {
  if (typeof json !== 'string' || !json.trim()) return []
  let brut: unknown
  try {
    brut = JSON.parse(json)
  } catch {
    return []
  }
  if (!Array.isArray(brut)) return []
  const mesures: Mesure[] = []
  for (const x of brut) {
    if (typeof x !== 'object' || x === null) continue
    const o = x as Record<string, unknown>
    const libelle = typeof o.libelle === 'string' ? o.libelle.trim() : ''
    const base = Number(o.base)
    if (!libelle || !Number.isFinite(base) || base <= 0) continue
    const id = typeof o.id === 'string' && o.id ? o.id : identifiantMesure(libelle)
    if (estUniteDeBase({ id }) || mesures.some((m) => m.id === id)) continue
    const pluriel = typeof o.pluriel === 'string' && o.pluriel.trim() ? o.pluriel.trim() : libelle
    const detail = typeof o.detail === 'string' && o.detail.trim() ? o.detail.trim() : undefined
    mesures.push({ id, libelle, pluriel, base, ...(detail ? { detail } : {}) })
  }
  return mesures
}

export const ecrireMesures = (mesures: readonly Mesure[]): string | null =>
  mesures.length === 0 ? null : JSON.stringify(mesures.map((m) => ({ id: m.id, libelle: m.libelle, pluriel: m.pluriel, base: m.base, ...(m.detail ? { detail: m.detail } : {}) })))
