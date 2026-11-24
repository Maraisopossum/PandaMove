// Open Food Facts : base collaborative de produits alimentaires (licence ODbL), lue directement depuis le navigateur (CORS ouvert).
// Seul le texte recherché ou le code-barres quitte l'appareil. Hors ligne ou en cas d'erreur, la recherche échoue proprement : la base
// intégrée et les aliments personnels restent utilisables.

import { identifiantMesure, type Mesure, type UniteBase } from './mesures'

export const URL_OFF = 'https://world.openfoodfacts.org'
const CHAMPS = 'code,product_name,product_name_fr,brands,nutriments,serving_quantity,serving_size,quantity,product_quantity,product_quantity_unit'
const DELAI_MS = 8000

export interface ProduitOff {
  code: string
  nom: string
  marque: string | null
  /** Pour 100 g ou 100 ml. */
  kcal: number
  proteines: number
  glucides: number
  lipides: number
  fibres: number | null
  /** Portion indiquée par le fabricant (g), si connue. */
  portionG: number | null
  portionLabel: string | null
  /** 'ml' pour un liquide (contenance en ml, cl ou L) : les valeurs sont alors pour 100 ml. */
  uniteBase: UniteBase
  /** Portion de l'emballage (« 1 biscuit (12,5 g) » → biscuit de 12,5 g) puis contenance (paquet, bouteille). */
  mesures: Mesure[]
}

export class ErreurOff extends Error {
  readonly code: 'reseau' | 'introuvable' | 'incomplet'
  constructor(code: 'reseau' | 'introuvable' | 'incomplet', message: string) {
    super(message)
    this.name = 'ErreurOff'
    this.code = code
  }
}

const nombre = (v: unknown): number | null => {
  const n = typeof v === 'string' ? Number(v.replace(',', '.')) : v
  return typeof n === 'number' && Number.isFinite(n) ? n : null
}
const borne = (v: number | null, max: number) => (v === null ? null : Math.min(max, Math.max(0, v)))

/** Contenance du produit dans sa base : `product_quantity` + `product_quantity_unit`, sinon le texte `quantity` (« 1,5 L », « 33 cl »). */
export function lireContenance(p: Record<string, unknown>): { valeur: number; unite: UniteBase } | null {
  const unite = String(p.product_quantity_unit ?? '').trim().toLowerCase()
  const valeur = nombre(p.product_quantity)
  if (valeur !== null && valeur > 0 && (unite === 'g' || unite === 'ml')) return { valeur, unite }
  const texte = String(p.quantity ?? '').toLowerCase().replace(',', '.')
  const m = /(\d+(?:\.\d+)?)\s*(kg|g|ml|cl|l)\b/.exec(texte)
  if (!m) return null
  const n = Number(m[1])
  const facteurs: Record<string, [number, UniteBase]> = { kg: [1000, 'g'], g: [1, 'g'], ml: [1, 'ml'], cl: [10, 'ml'], l: [1000, 'ml'] }
  const [f, u] = facteurs[m[2]]
  return n > 0 ? { valeur: n * f, unite: u } : null
}

/**
 * Mesures d'un produit : la portion de l'emballage, nommée quand le libellé le permet (« 2 biscuits (25 g) » → biscuit de 12,5 g),
 * sinon « portion » ; puis l'emballage entier (paquet, ou bouteille pour un liquide). Limites de la migration 0022 respectées.
 */
export function mesuresProduit(portion: number | null, libellePortion: string | null, contenance: { valeur: number; unite: UniteBase } | null, uniteBase: UniteBase): Mesure[] {
  const mesures: Mesure[] = []
  if (portion !== null && portion > 0 && portion <= 5000) {
    const m = libellePortion ? /^\s*(\d+(?:[.,]\d+)?)\s+([^()\d]+?)\s*\(/.exec(libellePortion) : null
    const nb = m ? Number(m[1].replace(',', '.')) : 1
    const nom = m ? m[2].trim().toLowerCase().slice(0, 40) : ''
    if (m && nb > 0 && nom && !/^(g|ml|cl|l|portion|portions)$/.test(nom)) {
      const singulier = nb > 1 && nom.endsWith('s') ? nom.slice(0, -1) : nom
      mesures.push({ id: identifiantMesure(singulier), libelle: singulier, pluriel: nb > 1 ? nom : `${nom}s`, base: Math.round((portion / nb) * 10) / 10, ...(libellePortion ? { detail: libellePortion.slice(0, 100) } : {}) })
    } else {
      mesures.push({ id: 'portion', libelle: 'portion', pluriel: 'portions', base: portion, ...(libellePortion ? { detail: libellePortion.slice(0, 100) } : {}) })
    }
  }
  if (contenance && contenance.unite === uniteBase && contenance.valeur <= 5000 && !mesures.some((x) => Math.abs(x.base - contenance.valeur) < 0.5)) {
    const liquide = uniteBase === 'ml'
    mesures.push({ id: liquide ? 'bouteille' : 'paquet', libelle: liquide ? 'bouteille' : 'paquet', pluriel: liquide ? 'bouteilles' : 'paquets', base: contenance.valeur })
  }
  return mesures
}

/** Produit lisible, ou null si les valeurs nutritionnelles manquent (énergie impossible à établir). */
export function lireProduit(brut: unknown): ProduitOff | null {
  if (typeof brut !== 'object' || brut === null) return null
  const p = brut as Record<string, unknown>
  const n = (typeof p.nutriments === 'object' && p.nutriments !== null ? p.nutriments : {}) as Record<string, unknown>
  const nom = String(p.product_name_fr || p.product_name || '').trim().slice(0, 200)
  const proteines = borne(nombre(n.proteins_100g), 100)
  const glucides = borne(nombre(n.carbohydrates_100g), 100)
  const lipides = borne(nombre(n.fat_100g), 100)
  let kcal = nombre(n['energy-kcal_100g'])
  if (kcal === null) {
    const kj = nombre(n.energy_100g)
    if (kj !== null) kcal = kj / 4.184
  }
  if (!nom || kcal === null || (proteines === null && glucides === null && lipides === null)) return null
  const portion = nombre(p.serving_quantity)
  const marque = String(p.brands ?? '').split(',')[0].trim().slice(0, 200)
  const libellePortion = typeof p.serving_size === 'string' && p.serving_size.trim() ? p.serving_size.trim().slice(0, 100) : null
  const contenance = lireContenance(p)
  const uniteBase: UniteBase = contenance?.unite === 'ml' ? 'ml' : 'g'
  return {
    code: String(p.code ?? '').slice(0, 32),
    nom,
    marque: marque || null,
    kcal: Math.round(Math.min(1000, Math.max(0, kcal))),
    proteines: proteines ?? 0,
    glucides: glucides ?? 0,
    lipides: lipides ?? 0,
    fibres: borne(nombre(n.fiber_100g), 100),
    portionG: portion !== null && portion > 0 && portion <= 5000 ? portion : null,
    portionLabel: libellePortion,
    uniteBase,
    mesures: mesuresProduit(portion, libellePortion, contenance, uniteBase),
  }
}

async function appeler(url: string, fetchImpl: typeof fetch): Promise<unknown> {
  try {
    const reponse = await fetchImpl(url, { signal: AbortSignal.timeout(DELAI_MS), headers: { Accept: 'application/json' } })
    if (reponse.status === 404) throw new ErreurOff('introuvable', 'Produit introuvable.')
    if (!reponse.ok) throw new ErreurOff('reseau', 'Open Food Facts ne répond pas pour le moment.')
    return await reponse.json()
  } catch (e) {
    if (e instanceof ErreurOff) throw e
    throw new ErreurOff('reseau', 'Connexion impossible : la recherche en ligne demande du réseau.')
  }
}

export const codeBarresValide = (code: string) => /^\d{8,14}$/.test(code.trim())

/** Produit d'un code-barres (EAN-8, EAN-13, UPC…). */
export async function produitParCodeBarres(code: string, fetchImpl: typeof fetch = (...a) => fetch(...a)): Promise<ProduitOff> {
  const propre = code.trim()
  if (!codeBarresValide(propre)) throw new ErreurOff('introuvable', 'Code-barres invalide : 8 à 14 chiffres.')
  const json = (await appeler(`${URL_OFF}/api/v2/product/${propre}.json?fields=${CHAMPS}`, fetchImpl)) as { status?: number; product?: unknown }
  if (json.status === 0 || !json.product) throw new ErreurOff('introuvable', 'Produit absent d’Open Food Facts : créez-le dans « Mes aliments ».')
  const produit = lireProduit({ code: propre, ...(json.product as object) })
  if (!produit) throw new ErreurOff('incomplet', 'Ce produit n’a pas de valeurs nutritionnelles dans Open Food Facts : saisissez-les à la main.')
  return produit
}

/** Recherche par texte (produits français en priorité), au plus `limite` produits exploitables. */
export async function rechercherProduits(texte: string, fetchImpl: typeof fetch = (...a) => fetch(...a), limite = 20): Promise<ProduitOff[]> {
  const q = texte.trim()
  if (q.length < 2) return []
  const url = `${URL_OFF}/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=${limite * 2}&lc=fr&fields=${CHAMPS}`
  const json = (await appeler(url, fetchImpl)) as { products?: unknown[] }
  return (json.products ?? []).map(lireProduit).filter((p): p is ProduitOff => p !== null).slice(0, limite)
}
