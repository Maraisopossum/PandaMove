// Fond de carte pour les tracés : mathématique des « slippy maps » (projection de Mercator, tuiles de 256 px), sans
// bibliothèque. Fonctions pures : la vue (zoom, tuiles à charger, tracés projetés) se calcule ici, l'affichage est dans
// FondCarte.tsx. Les tuiles viennent d'OpenStreetMap ; hors ligne elles ne s'affichent pas et les tracés restent visibles.

export type Trace = [number, number][]

const TUILE = 256
const ZOOM_MIN = 2
const ZOOM_MAX = 17
/** Gabarit d'une tuile OpenStreetMap ({z}, {x}, {y}) : à citer avec la mention « © contributeurs OpenStreetMap ». */
export const URL_TUILE = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'

const mx = (lon: number) => (lon + 180) / 360
const my = (lat: number) => {
  const phi = (Math.max(-85.0511, Math.min(85.0511, lat)) * Math.PI) / 180
  return (1 - Math.log(Math.tan(phi) + 1 / Math.cos(phi)) / Math.PI) / 2
}

export interface TuileCarte {
  url: string
  /** Position et côté dans le repère de la vue (px). */
  x: number
  y: number
  cote: number
}

export interface VueCarte {
  largeur: number
  hauteur: number
  /** Zoom fractionnaire choisi pour que tous les tracés tiennent dans la vue. */
  zoom: number
  tuiles: TuileCarte[]
  /** Chaque tracé en points SVG « x,y x,y … » dans le repère de la vue. */
  lignes: string[]
  /** Projection d'un point (latitude, longitude) dans le repère de la vue. */
  projeter: (lat: number, lon: number) => [number, number]
}

// Vue centrée sur l'ensemble des tracés, `marge` px de pourtour. Zoom plafonné (17) pour une très petite boucle.
export function calculerVue(traces: Trace[], largeur: number, hauteur: number, marge = 24): VueCarte | null {
  const pts = traces.flat()
  if (pts.length === 0) return null
  const xs = pts.map((p) => mx(p[1]))
  const ys = pts.map((p) => my(p[0]))
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
  const etendue = Math.max(maxX - minX, 1e-9)
  const hauteurE = Math.max(maxY - minY, 1e-9)
  const zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, Math.log2(Math.min((largeur - 2 * marge) / (etendue * TUILE), (hauteur - 2 * marge) / (hauteurE * TUILE)))))
  const monde = TUILE * 2 ** zoom
  const [cx, cy] = [(minX + maxX) / 2, (minY + maxY) / 2]
  const projeter = (lat: number, lon: number): [number, number] => [(mx(lon) - cx) * monde + largeur / 2, (my(lat) - cy) * monde + hauteur / 2]

  const z = Math.floor(zoom)
  const cote = TUILE * 2 ** (zoom - z)
  const n = 2 ** z
  const [t0x, t1x] = [Math.floor(cx * n - largeur / 2 / cote), Math.floor(cx * n + largeur / 2 / cote)]
  const [t0y, t1y] = [Math.floor(cy * n - hauteur / 2 / cote), Math.floor(cy * n + hauteur / 2 / cote)]
  const tuiles: TuileCarte[] = []
  for (let ty = Math.max(0, t0y); ty <= Math.min(n - 1, t1y); ty++) {
    for (let tx = t0x; tx <= t1x; tx++) {
      // Le monde se répète en longitude : l'indice de tuile est ramené dans [0, n[
      const tuileX = ((tx % n) + n) % n
      tuiles.push({
        url: URL_TUILE.replace('{z}', String(z)).replace('{x}', String(tuileX)).replace('{y}', String(ty)),
        x: (tx - cx * n) * cote + largeur / 2,
        y: (ty - cy * n) * cote + hauteur / 2,
        cote,
      })
    }
  }
  const lignes = traces.map((t) => t.map(([lat, lon]) => projeter(lat, lon).map((v) => v.toFixed(1)).join(',')).join(' '))
  return { largeur, hauteur, zoom, tuiles, lignes, projeter }
}
