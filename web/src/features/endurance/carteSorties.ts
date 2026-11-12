import type { Sortie } from '../../core/db/repos/sorties'
import { lireTrace } from './statsSorties'

// Heatmap des sorties d'endurance : où l'on passe le plus souvent. Fonctions pures sur les tracés enregistrés à l'import
// (polylignes [latitude, longitude] réduites à 300 points). Aucune carte routière : un quadrillage de cellules colorées
// selon le nombre de sorties qui les traversent, dessiné en SVG (hors ligne).

export type Trace = [number, number][]

const M_PAR_DEGRE = 111_320
const CELLULE_MIN_M = 120
const CELLULES_MAX = 60

export interface CelluleCarte {
  x: number
  y: number
  /** Nombre de sorties distinctes qui traversent la cellule. */
  n: number
  /** 1 (rare) à 4 (très fréquenté), selon n par rapport au maximum. */
  niveau: 1 | 2 | 3 | 4
}

export interface CarteSorties {
  largeur: number
  hauteur: number
  /** Côté d'une cellule dans le repère du dessin. */
  cote: number
  cellules: CelluleCarte[]
  /** Nombre maximal de sorties dans une même cellule. */
  max: number
  /** Nombre de sorties dessinées. */
  sorties: number
  /** Taille réelle d'une cellule, en mètres. */
  celluleM: number
  /** Cellule la plus fréquentée : centre en coordonnées géographiques. */
  sommet: { lat: number; lon: number; n: number }
}

export interface LieuFrequente {
  lat: number
  lon: number
  /** Sorties parties de cette zone (cases de 0,01° environ 1 km). */
  sorties: number
  distanceM: number
}

// Tracés exploitables : sortie en extérieur avec au moins deux points.
export function tracesDe(sorties: Pick<Sortie, 'trace' | 'enSalle'>[]): Trace[] {
  return sorties.filter((s) => !s.enSalle).map((s) => lireTrace(s)).filter((t) => t.length >= 2)
}

const niveauDe = (n: number, max: number): 1 | 2 | 3 | 4 => {
  if (max <= 1) return 2
  const r = n / max
  return r > 0.75 ? 4 : r > 0.5 ? 3 : r > 0.25 ? 2 : 1
}

// Cellules traversées par un tracé : les segments sont parcourus par pas d'une demi-cellule pour ne laisser aucun trou
// entre deux points éloignés (sortie longue réduite à 300 points).
function cellulesDe(trace: Trace, lat0: number, celluleM: number): Set<string> {
  const k = Math.cos((lat0 * Math.PI) / 180)
  const xy = trace.map(([lat, lon]) => [lon * k * M_PAR_DEGRE, lat * M_PAR_DEGRE] as const)
  const vues = new Set<string>()
  const marquer = (x: number, y: number) => vues.add(`${Math.floor(x / celluleM)}|${Math.floor(y / celluleM)}`)
  marquer(xy[0][0], xy[0][1])
  for (let i = 1; i < xy.length; i++) {
    const [x0, y0] = xy[i - 1]
    const [x1, y1] = xy[i]
    const pas = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / (celluleM / 2)))
    for (let p = 1; p <= pas; p++) marquer(x0 + ((x1 - x0) * p) / pas, y0 + ((y1 - y0) * p) / pas)
  }
  return vues
}

export function calculerCarte(traces: Trace[], largeur = 320): CarteSorties | null {
  if (traces.length === 0) return null
  const lats = traces.flatMap((t) => t.map((p) => p[0]))
  const lons = traces.flatMap((t) => t.map((p) => p[1]))
  const [minLat, maxLat, minLon, maxLon] = [Math.min(...lats), Math.max(...lats), Math.min(...lons), Math.max(...lons)]
  const lat0 = (minLat + maxLat) / 2
  const k = Math.cos((lat0 * Math.PI) / 180)
  const largeurM = (maxLon - minLon) * k * M_PAR_DEGRE
  const hauteurM = (maxLat - minLat) * M_PAR_DEGRE
  // Une cellule plus grande si la zone est vaste : au plus 60 cellules sur le grand côté
  const celluleM = Math.max(CELLULE_MIN_M, Math.max(largeurM, hauteurM) / CELLULES_MAX)

  const compte = new Map<string, number>()
  for (const t of traces) for (const c of cellulesDe(t, lat0, celluleM)) compte.set(c, (compte.get(c) ?? 0) + 1)

  const origineX = Math.floor((minLon * k * M_PAR_DEGRE) / celluleM)
  const origineY = Math.floor((minLat * M_PAR_DEGRE) / celluleM)
  const colonnes = Math.floor((maxLon * k * M_PAR_DEGRE) / celluleM) - origineX + 1
  const lignes = Math.floor((maxLat * M_PAR_DEGRE) / celluleM) - origineY + 1
  const cote = largeur / Math.max(colonnes, 1)
  const hauteur = Math.min(Math.max(lignes * cote, cote), largeur * 1.6)
  const echelle = hauteur / (lignes * cote)

  const max = Math.max(...compte.values())
  let sommet = { lat: lat0, lon: 0, n: 0 }
  const cellules: CelluleCarte[] = []
  for (const [cle, n] of compte) {
    const [cx, cy] = cle.split('|').map(Number)
    cellules.push({ x: (cx - origineX) * cote, y: (lignes - 1 - (cy - origineY)) * cote * echelle, n, niveau: niveauDe(n, max) })
    if (n > sommet.n) sommet = { lat: ((cy + 0.5) * celluleM) / M_PAR_DEGRE, lon: ((cx + 0.5) * celluleM) / (k * M_PAR_DEGRE), n }
  }
  cellules.sort((a, b) => a.n - b.n)
  return { largeur, hauteur, cote, cellules, max, sorties: traces.length, celluleM: Math.round(celluleM), sommet }
}

// Zones d'où partent le plus souvent les sorties, les plus fréquentées d'abord.
export function lieuxFrequentes(sorties: Pick<Sortie, 'trace' | 'enSalle' | 'distanceM'>[], limite = 5): LieuFrequente[] {
  const zones = new Map<string, { lat: number; lon: number; sorties: number; distanceM: number }>()
  for (const s of sorties) {
    if (s.enSalle) continue
    const t = lireTrace(s)
    if (t.length < 2) continue
    const [lat, lon] = t[0]
    const cle = `${Math.round(lat * 100)}|${Math.round(lon * 100)}`
    const z = zones.get(cle) ?? { lat: 0, lon: 0, sorties: 0, distanceM: 0 }
    // Position moyenne des départs de la zone
    z.lat = (z.lat * z.sorties + lat) / (z.sorties + 1)
    z.lon = (z.lon * z.sorties + lon) / (z.sorties + 1)
    z.sorties += 1
    z.distanceM += s.distanceM ?? 0
    zones.set(cle, z)
  }
  return [...zones.values()].sort((a, b) => b.sorties - a.sorties || b.distanceM - a.distanceM).slice(0, limite)
}

// 50.6588 3.0766 -> « 50,659° N · 3,077° E »
export function formaterCoordonnees(lat: number, lon: number): string {
  const f = (v: number) => Math.abs(v).toFixed(3).replace('.', ',')
  return `${f(lat)}° ${lat >= 0 ? 'N' : 'S'} · ${f(lon)}° ${lon >= 0 ? 'E' : 'O'}`
}
