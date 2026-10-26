import { formaterCharge } from '../../core/common/formaterCharge'
import { chargesAtteignables } from '../../core/progression/inventory'
import type { DisquesConfig, HalteresConfig, PlageConfig } from '../../core/progression/types'

// Brouillons de formulaire (chaînes saisies) et leur conversion en configuration validée.
// Un brouillon invalide donne null : l'écran désactive alors « Enregistrer ».

export const apercuCharges = (cfg: DisquesConfig | PlageConfig | HalteresConfig): string[] =>
  chargesAtteignables(cfg).map(formaterCharge)

// Saisie française : la virgule est acceptée comme séparateur décimal. Vide ou invalide : NaN.
export function lireNombre(texte: string): number {
  const propre = texte.trim().replace(',', '.')
  return propre === '' ? Number.NaN : Number(propre)
}

const enTexte = (n: number) => String(n).replace('.', ',')

// ── Plage (kettlebell, câble) ───────────────────────────────────────────────────

export interface PlageBrouillon {
  min: string
  max: string
  pas: string
}

// Points de départ de l'application Android (modifiables)
export const KETTLEBELL_DEFAUT: PlageConfig = { minKg: 8, maxKg: 24, pasKg: 4 }
export const CABLE_DEFAUT: PlageConfig = { minKg: 5, maxKg: 100, pasKg: 2.5 }

export const brouillonPlage = (cfg: PlageConfig | null, defaut: PlageConfig): PlageBrouillon => {
  const c = cfg ?? defaut
  return { min: enTexte(c.minKg), max: enTexte(c.maxKg), pas: enTexte(c.pasKg) }
}

export function lirePlage(b: PlageBrouillon): PlageConfig | null {
  const minKg = lireNombre(b.min)
  const maxKg = lireNombre(b.max)
  const pasKg = lireNombre(b.pas)
  if (![minKg, maxKg, pasKg].every(Number.isFinite)) return null
  if (minKg < 0 || maxKg < minKg || pasKg <= 0) return null
  return { minKg, maxKg, pasKg }
}

// ── Barre + disques ─────────────────────────────────────────────────────────────

export interface LigneDisque {
  poids: string
  quantite: string
}

export interface DisquesBrouillon {
  barre: string
  lignes: LigneDisque[]
}

export const BARRE_DEFAUT: DisquesConfig = { barreKg: 20, disques: { '1.25': 4, '2.5': 4, '5': 4, '10': 2, '20': 2 } }

export function brouillonDisques(cfg: DisquesConfig | null, defaut: DisquesConfig): DisquesBrouillon {
  const c = cfg ?? defaut
  const lignes = Object.entries(c.disques)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([poids, quantite]) => ({ poids: enTexte(Number(poids)), quantite: String(quantite) }))
  return { barre: enTexte(c.barreKg), lignes }
}

// Lignes entièrement vides ignorées ; poids > 0 et quantité entière >= 0 ; poids identiques additionnés.
export function lireDisques(b: DisquesBrouillon): DisquesConfig | null {
  const barreKg = lireNombre(b.barre)
  if (!Number.isFinite(barreKg) || barreKg < 0) return null
  const disques: Record<string, number> = {}
  for (const l of b.lignes) {
    if (l.poids.trim() === '' && l.quantite.trim() === '') continue
    const poids = lireNombre(l.poids)
    const quantite = lireNombre(l.quantite)
    if (!Number.isFinite(poids) || poids <= 0 || !Number.isInteger(quantite) || quantite < 0) return null
    const cle = String(poids)
    disques[cle] = (disques[cle] ?? 0) + quantite
  }
  return { barreKg, disques }
}

// ── Haltères ────────────────────────────────────────────────────────────────────

export interface HalteresBrouillon {
  fixes: string
  chargeable: boolean
  disques: DisquesBrouillon
}

const CHARGEABLE_DEFAUT: DisquesConfig = { barreKg: 2, disques: { '1.25': 4, '2.5': 4 } }

export function brouillonHalteres(cfg: HalteresConfig): HalteresBrouillon {
  return {
    fixes: cfg.poidsFixes.map(enTexte).join(' '),
    chargeable: cfg.chargeable !== null,
    disques: brouillonDisques(cfg.chargeable, CHARGEABLE_DEFAUT),
  }
}

// Poids fixes séparés par des espaces ou des points-virgules (la virgule reste décimale).
export function lireHalteres(b: HalteresBrouillon): HalteresConfig | null {
  const morceaux = b.fixes.split(/[\s;]+/).filter((m) => m !== '')
  const fixes = morceaux.map(lireNombre)
  if (fixes.some((n) => !Number.isFinite(n) || n <= 0)) return null
  const chargeable = b.chargeable ? lireDisques(b.disques) : null
  if (b.chargeable && chargeable === null) return null
  return { poidsFixes: [...new Set(fixes)].sort((a, c) => a - c), chargeable }
}

// ── Catégories et pas ───────────────────────────────────────────────────────────

export const LIBELLES_CATEGORIES: Record<string, string> = {
  POIDS_DE_CORPS: 'Poids de corps',
  HALTERES: 'Haltères',
  BARRE: 'Barre',
  KETTLEBELL: 'Kettlebell',
  MACHINE: 'Machine',
  CABLE: 'Câble / Poulie',
  BANC: 'Banc',
  RACK: 'Rack',
  BARRE_TRACTION: 'Barre de traction / Parallèles',
  ELASTIQUE: 'Élastique',
  ACCESSOIRES: 'Accessoires',
}

// Catégories pour lesquelles un pas (kg) se règle : Machine (pas par défaut de l'application
// Android) dès qu'elle est cochée, plus toute catégorie ayant déjà un pas enregistré.
export function categoriesAvecPas(selectionnees: string[], pas: Record<string, number>): string[] {
  return Object.keys(LIBELLES_CATEGORIES).filter(
    (c) => (c === 'MACHINE' && selectionnees.includes(c)) || c in pas,
  )
}

export const lirePas = (texte: string): number | null => {
  const n = lireNombre(texte)
  return Number.isFinite(n) && n > 0 ? n : null
}
