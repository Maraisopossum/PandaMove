import type { JourCharge } from './calculCharge'

// Géométrie du graphique de charge (repère SVG) : calcul pur, le composant ne fait que dessiner.

export const LARGEUR_GRAPHIQUE = 600
export const HAUTEUR_GRAPHIQUE = 220
const MARGE = { gauche: 38, droite: 10, haut: 10, bas: 24 }

export interface GraduationY {
  valeur: number
  y: number
}

export interface GraphiqueCharge {
  largeur: number
  hauteur: number
  /** Points « x,y » des trois courbes. */
  forme: string
  fatigue: string
  fraicheur: string
  /** Ordonnée du zéro (limite fraîcheur positive / négative). */
  yZero: number
  graduations: GraduationY[]
  /** Étiquettes de dates sous l'axe : début, milieu et fin de la fenêtre. */
  dates: { date: string; x: number }[]
  zone: { x: number; y: number; largeur: number; hauteur: number }
}

// Pas « lisible » (10, 20, 50, 100…) donnant 3 à 6 graduations
function pasGraduation(etendue: number): number {
  const brut = etendue / 4
  const puissance = 10 ** Math.floor(Math.log10(Math.max(brut, 1)))
  for (const m of [1, 2, 5, 10]) if (m * puissance >= brut) return m * puissance
  return 10 * puissance
}

/** Dessin des courbes forme / fatigue / fraîcheur ; null si la série est vide. */
export function construireGraphiqueCharge(serie: readonly JourCharge[]): GraphiqueCharge | null {
  if (serie.length === 0) return null
  const zone = {
    x: MARGE.gauche,
    y: MARGE.haut,
    largeur: LARGEUR_GRAPHIQUE - MARGE.gauche - MARGE.droite,
    hauteur: HAUTEUR_GRAPHIQUE - MARGE.haut - MARGE.bas,
  }
  const valeurs = serie.flatMap((j) => [j.forme, j.fatigue, j.fraicheur])
  const pas = pasGraduation(Math.max(...valeurs, 0) - Math.min(...valeurs, 0) || 10)
  const min = Math.floor(Math.min(...valeurs, 0) / pas) * pas
  const max = Math.ceil(Math.max(...valeurs, 0) / pas) * pas || pas
  const y = (v: number) => zone.y + zone.hauteur - ((v - min) / (max - min)) * zone.hauteur
  const x = (i: number) => zone.x + (serie.length === 1 ? zone.largeur / 2 : (i / (serie.length - 1)) * zone.largeur)
  const courbe = (champ: 'forme' | 'fatigue' | 'fraicheur') =>
    serie.map((j, i) => `${x(i).toFixed(1)},${y(j[champ]).toFixed(1)}`).join(' ')

  const graduations: GraduationY[] = []
  for (let v = min; v <= max + 1e-9; v += pas) graduations.push({ valeur: Math.round(v), y: y(v) })

  const indices = [...new Set([0, Math.floor((serie.length - 1) / 2), serie.length - 1])]
  return {
    largeur: LARGEUR_GRAPHIQUE,
    hauteur: HAUTEUR_GRAPHIQUE,
    forme: courbe('forme'),
    fatigue: courbe('fatigue'),
    fraicheur: courbe('fraicheur'),
    yZero: y(0),
    graduations,
    dates: indices.map((i) => ({ date: serie[i].date, x: x(i) })),
    zone,
  }
}
