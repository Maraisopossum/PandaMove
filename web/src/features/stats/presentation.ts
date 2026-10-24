import { MUSCLE_GROUPS, type MuscleGroup, type PandaVariant } from '../../core/db/types'
import { libelleMuscle } from '../strength/catalog/libelles'
import { COULEURS_NIVEAU, HEATMAP_ZONES, LIBELLES_NIVEAU, niveauVolume, type VueHeatmap } from './heatmapZones'
import type { PointHistorique } from './statsQueries'

// Mise en forme pure des statistiques pour l'écran (aucune logique dans les composants).

const FORMAT_KG = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 })
const FORMAT_DATE = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })

// « 12 345,5 kg » : séparateur de milliers et virgule décimale à la française
export const formaterTonnage = (kg: number) => `${FORMAT_KG.format(kg)} kg`
export const formaterNombre = (n: number) => FORMAT_KG.format(n)

// Date `YYYY-MM-DD` lue en local (jamais via UTC)
export function formaterDate(dateIso: string): string {
  const [y, m, d] = dateIso.split('-').map(Number)
  return FORMAT_DATE.format(new Date(y, m - 1, d))
}

export const libelleSeries = (n: number) => `${n} série${n > 1 ? 's' : ''}`

export interface GroupeVue {
  groupe: MuscleGroup
  libelle: string
  series: number
  /** Part du groupe le plus travaillé, 0..1 */
  ratio: number
  niveau: number
  libelleNiveau: string
  couleur: string | null
  /** Vue de la figure où se trouve la zone (« liste » : barre seule sous la figure) */
  vue: VueHeatmap | 'liste'
  svgPath: string | null
}

// Les 16 groupes, du plus travaillé au moins travaillé (puis ordre du catalogue).
export function groupesVue(volume: Record<MuscleGroup, number>, variante: PandaVariant): GroupeVue[] {
  const max = Math.max(0, ...MUSCLE_GROUPS.map((g) => volume[g] ?? 0))
  const rang = (g: MuscleGroup) => MUSCLE_GROUPS.indexOf(g)
  return MUSCLE_GROUPS.map((groupe): GroupeVue => {
    const series = volume[groupe] ?? 0
    const ratio = max > 0 ? series / max : 0
    const niveau = niveauVolume(ratio)
    const zone = HEATMAP_ZONES[variante][groupe]
    return {
      groupe, libelle: libelleMuscle(groupe), series, ratio, niveau, libelleNiveau: LIBELLES_NIVEAU[niveau],
      couleur: COULEURS_NIVEAU[niveau], vue: zone.vue, svgPath: zone.svgPath,
    }
  }).sort((a, b) => b.series - a.series || rang(a.groupe) - rang(b.groupe))
}

export type UniteHistorique = 'kg' | 'reps' | 's'

export interface Graphique {
  largeur: number
  hauteur: number
  unite: UniteHistorique
  /** Points du tracé (repère SVG), dans l'ordre chronologique */
  points: { x: number; y: number; valeur: number; dateIso: string }[]
  polyligne: string
  min: number
  max: number
}

const LARGEUR = 320
const HAUTEUR = 160
const MARGE = 20

// Courbe de l'historique : la charge max, ou à défaut (poids du corps, gainage) les reps / secondes.
export function construireGraphique(historique: PointHistorique[]): Graphique {
  const avecCharge = historique.some((p) => p.maxChargeKg > 0)
  const unite: UniteHistorique = avecCharge ? 'kg' : historique.some((p) => p.enSecondes) ? 's' : 'reps'
  const valeurs = historique.map((p) => (avecCharge ? p.maxChargeKg : p.reps))
  const min = valeurs.length ? Math.min(...valeurs) : 0
  const max = valeurs.length ? Math.max(...valeurs) : 0
  const etendue = max - min || 1
  const pasX = historique.length > 1 ? (LARGEUR - 2 * MARGE) / (historique.length - 1) : 0
  const points = historique.map((p, i) => ({
    x: Math.round((historique.length > 1 ? MARGE + i * pasX : LARGEUR / 2) * 10) / 10,
    // Valeur constante : ligne au milieu ; sinon min en bas, max en haut
    y: Math.round((max === min ? HAUTEUR / 2 : HAUTEUR - MARGE - ((valeurs[i] - min) / etendue) * (HAUTEUR - 2 * MARGE)) * 10) / 10,
    valeur: valeurs[i],
    dateIso: p.dateIso,
  }))
  return {
    largeur: LARGEUR, hauteur: HAUTEUR, unite, points, min, max,
    polyligne: points.map((p) => `${p.x},${p.y}`).join(' '),
  }
}

export function formaterValeur(valeur: number, unite: UniteHistorique): string {
  if (unite === 'kg') return `${formaterNombre(valeur)} kg`
  return unite === 's' ? `${formaterNombre(valeur)} s` : `${formaterNombre(valeur)} reps`
}
