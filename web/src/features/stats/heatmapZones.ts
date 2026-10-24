import type { MuscleGroup, PandaVariant } from '../../core/db/types'

// Zones de la heatmap musculaire, superposées aux fonds public/panda/heatmap-{variante}-{vue}.webp
// (600 × 900, générés par scripts/make-heatmaps.mjs depuis assets/11_Heatmaps).
// Tracés à la main sur une grille de 50 px posée sur chaque image : polygones approximatifs, mais
// placés sur la bonne région. Silhouettes male et female trop différentes (bras, buste, bassin) :
// chaque variante a son propre tracé. Les zones paires sont tracées à gauche de l'image puis
// symétrisées (x -> 600 - x), les personnages étant de face/dos et symétriques.
// Chaque groupe apparaît UNE fois : sur la vue où il se voit le mieux, ou dans la « liste » (barres
// sous la figure) quand aucune vue ne le montre (adducteurs couverts par le short, « Autre »).

export type VueHeatmap = 'face' | 'dos'

export interface ZoneHeatmap {
  vue: VueHeatmap | 'liste'
  svgPath: string | null
}

export const HEATMAP_VIEWBOX = { largeur: 600, hauteur: 900 } as const

type Point = readonly [number, number]

const polygone = (points: readonly Point[]) => `M${points.map(([x, y]) => `${x},${y}`).join(' L')} Z`
// Zone paire : le polygone de gauche et son symétrique
const paire = (points: readonly Point[]) =>
  `${polygone(points)} ${polygone(points.map(([x, y]) => [HEATMAP_VIEWBOX.largeur - x, y] as const))}`

const face = (svgPath: string): ZoneHeatmap => ({ vue: 'face', svgPath })
const dos = (svgPath: string): ZoneHeatmap => ({ vue: 'dos', svgPath })
const LISTE: ZoneHeatmap = { vue: 'liste', svgPath: null }

const MALE: Record<MuscleGroup, ZoneHeatmap> = {
  PECTORAUX: face(paire([[200, 335], [297, 342], [297, 405], [245, 410], [205, 385]])),
  EPAULES: face(paire([[150, 300], [195, 315], [205, 365], [175, 378], [150, 345]])),
  BICEPS: face(paire([[70, 288], [110, 272], [155, 298], [150, 335], [110, 322], [68, 322]])),
  AVANT_BRAS: face(paire([[58, 212], [104, 210], [100, 285], [50, 290]])),
  ABDOMINAUX: face(polygone([[248, 410], [352, 410], [348, 520], [300, 530], [252, 520]])),
  OBLIQUES: face(paire([[212, 400], [244, 410], [249, 510], [226, 498]])),
  QUADRICEPS: face(paire([[205, 592], [292, 602], [290, 652], [270, 690], [222, 690], [205, 640]])),
  TRAPEZES: dos(polygone([[245, 270], [355, 270], [330, 322], [308, 400], [292, 400], [270, 322]])),
  TRICEPS: dos(paire([[52, 286], [145, 290], [150, 330], [62, 322]])),
  DOS: dos(paire([[200, 322], [268, 326], [288, 400], [284, 450], [242, 468], [215, 420]])),
  LOMBAIRES: dos(polygone([[268, 420], [332, 420], [336, 490], [264, 490]])),
  FESSIERS: dos(polygone([[225, 500], [375, 500], [380, 555], [300, 560], [220, 555]])),
  ISCHIO: dos(paire([[208, 562], [295, 566], [292, 650], [215, 650]])),
  MOLLETS: dos(paire([[190, 655], [248, 655], [245, 760], [200, 760]])),
  ADDUCTEURS: LISTE,
  AUTRE: LISTE,
}

const FEMALE: Record<MuscleGroup, ZoneHeatmap> = {
  PECTORAUX: face(paire([[228, 348], [297, 352], [297, 418], [245, 420], [230, 395]])),
  EPAULES: face(paire([[188, 322], [228, 330], [232, 375], [205, 380], [188, 352]])),
  BICEPS: face(paire([[92, 305], [140, 296], [190, 320], [192, 350], [140, 340], [95, 336]])),
  AVANT_BRAS: face(paire([[72, 218], [118, 212], [122, 295], [80, 305]])),
  ABDOMINAUX: face(polygone([[258, 425], [342, 425], [340, 515], [300, 522], [260, 515]])),
  OBLIQUES: face(paire([[236, 425], [257, 428], [260, 505], [242, 495]])),
  QUADRICEPS: face(paire([[212, 545], [250, 570], [290, 585], [286, 640], [262, 666], [220, 662], [208, 600]])),
  TRAPEZES: dos(polygone([[258, 302], [342, 302], [320, 342], [305, 385], [295, 385], [280, 342]])),
  TRICEPS: dos(paire([[92, 302], [188, 306], [196, 346], [100, 334]])),
  DOS: dos(paire([[228, 342], [286, 352], [290, 430], [252, 440], [236, 400]])),
  LOMBAIRES: dos(polygone([[266, 430], [334, 430], [338, 480], [262, 480]])),
  FESSIERS: dos(polygone([[226, 490], [374, 490], [380, 545], [300, 550], [220, 545]])),
  ISCHIO: dos(paire([[212, 556], [295, 560], [292, 650], [220, 650]])),
  MOLLETS: dos(paire([[196, 670], [245, 670], [246, 780], [200, 780]])),
  ADDUCTEURS: LISTE,
  AUTRE: LISTE,
}

export const HEATMAP_ZONES: Record<PandaVariant, Record<MuscleGroup, ZoneHeatmap>> = { male: MALE, female: FEMALE }

export const imageHeatmap = (variante: PandaVariant, vue: VueHeatmap) => `/panda/heatmap-${variante}-${vue}.webp`

// Échelle séquentielle (famille orange du module Statistiques) : niveau 0 = aucune série (pas de
// couleur), puis 4 niveaux par quart du groupe le plus travaillé. La couleur n'est jamais seule :
// chaque zone porte un <title> et la liste sous la figure donne les valeurs.
export const COULEURS_NIVEAU: readonly (string | null)[] = [null, '#ffcc80', '#ff9800', '#e65100', '#8f2600']
export const LIBELLES_NIVEAU = ['Aucun', 'Faible', 'Moyen', 'Élevé', 'Maximal'] as const

// Ratio volume / volume maximal -> niveau 0..4. Total (NaN, négatif, > 1) et monotone.
export function niveauVolume(ratio: number): number {
  if (!(ratio > 0)) return 0
  const dernier = COULEURS_NIVEAU.length - 1
  return Math.min(dernier, Math.ceil(ratio * dernier))
}
