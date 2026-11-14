import { MUSCLE_GROUPS, type MuscleGroup, type PandaVariant } from '../../core/db/types'
import { LIBELLES_GROUPE } from '../../core/catalogue/muscleToGroup'
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
  /** Vue principale de la zone (« liste » : barre seule sous la figure) */
  vue: VueHeatmap | 'liste'
  /** Tracé sur chaque vue où le groupe figure (une ou deux vues, aucune pour « liste ») */
  traces: Partial<Record<VueHeatmap, string>>
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
      groupe, libelle: LIBELLES_GROUPE[groupe], series, ratio, niveau, libelleNiveau: LIBELLES_NIVEAU[niveau],
      couleur: COULEURS_NIVEAU[niveau], vue: zone.vue, traces: zone.traces,
    }
  }).sort((a, b) => b.series - a.series || rang(a.groupe) - rang(b.groupe))
}

export type UniteHistorique = 'kg' | 'reps' | 's'
export type MesureHistorique = 'charge' | 'rm' | 'volume'

export const MESURES: { id: MesureHistorique; libelle: string }[] = [
  { id: 'charge', libelle: 'Charge max' },
  { id: 'rm', libelle: '1RM estimé' },
  { id: 'volume', libelle: 'Volume' },
]

export interface PointGraphique {
  x: number
  y: number
  valeur: number
  dateIso: string
  /** Séance d'origine : charge, reps, 1RM et volume pour la bulle d'information. */
  source: PointHistorique
}

export interface Graphique {
  largeur: number
  hauteur: number
  unite: UniteHistorique
  mesure: MesureHistorique
  /** Mesures proposées : charge max seule pour un exercice au poids du corps ou en durée. */
  mesuresDisponibles: MesureHistorique[]
  /** Points du tracé (repère SVG), dans l'ordre chronologique */
  points: PointGraphique[]
  polyligne: string
  /** Extrêmes des valeurs tracées (étiquettes « Min » et « Max »). */
  min: number
  max: number
  /** Graduations des axes : trait et étiquette. */
  graduationsY: { y: number; libelle: string }[]
  graduationsX: { x: number; libelle: string }[]
  /** Zone de tracé (repère SVG) : de quoi dessiner la grille et l'axe. */
  zone: { gauche: number; droite: number; haut: number; bas: number }
  /** Rang du point record (valeur maximale, la plus récente à égalité) ; -1 sans point. */
  indexRecord: number
}

const LARGEUR = 330
const HAUTEUR = 196
const ZONE = { gauche: 40, droite: 14, haut: 20, bas: 164 }

// Pas « rond » (1, 2, 2,5, 5 × 10^n) pour une quinzaine de graduations au plus : 4 à 5 reperes lisibles.
function pasRond(etendue: number, reperes: number): number {
  const brut = etendue / reperes
  const puissance = 10 ** Math.floor(Math.log10(brut))
  const normalise = brut / puissance
  return (normalise <= 1 ? 1 : normalise <= 2 ? 2 : normalise <= 2.5 ? 2.5 : normalise <= 5 ? 5 : 10) * puissance
}

const MOIS_COURTS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']
export const formaterJourMois = (iso: string) => `${Number(iso.slice(8))} ${MOIS_COURTS[Number(iso.slice(5, 7)) - 1]}`
const dateAxe = (iso: string, avecAnnee: boolean) => `${Number(iso.slice(8))} ${MOIS_COURTS[Number(iso.slice(5, 7)) - 1]}${avecAnnee ? ` ${iso.slice(2, 4)}` : ''}`

const valeurDe = (p: PointHistorique, mesure: MesureHistorique, avecCharge: boolean) =>
  !avecCharge ? p.reps : mesure === 'rm' ? p.rmEstimeKg : mesure === 'volume' ? p.volumeKg : p.maxChargeKg

// Courbe de l'historique : la charge max (ou, à défaut, reps / secondes), le 1RM estimé ou le volume de chaque séance.
// Historique mixte (certaines séances au poids du corps) : les points sans charge sont écartés plutôt que tracés à 0 kg,
// ce qui ferait croire à une chute de charge. Axes : graduations rondes en Y, dates en X.
export function construireGraphique(tout: PointHistorique[], mesure: MesureHistorique = 'charge'): Graphique {
  const avecCharge = tout.some((p) => p.maxChargeKg > 0)
  const actuelle: MesureHistorique = avecCharge ? mesure : 'charge'
  const historique = (avecCharge ? tout.filter((p) => valeurDe(p, actuelle, true) > 0) : tout)
  const unite: UniteHistorique = avecCharge ? 'kg' : tout.some((p) => p.enSecondes) ? 's' : 'reps'
  const valeurs = historique.map((p) => valeurDe(p, actuelle, avecCharge))
  const min = valeurs.length ? Math.min(...valeurs) : 0
  const max = valeurs.length ? Math.max(...valeurs) : 0
  // Échelle : de la graduation ronde sous le minimum à celle au-dessus du maximum (un exercice constant garde de l'air)
  const pas = pasRond(max - min || Math.max(max, 1) * 0.2, 4)
  const bas = Math.max(0, Math.floor(min / pas) * pas - (min === max ? pas : 0))
  const haut = Math.ceil(max / pas) * pas + (min === max ? pas : 0)
  const etendue = haut - bas || 1
  // Premier et dernier point à 6 px des bords de la zone : les marqueurs ne sont pas rognés
  const pasX = historique.length > 1 ? (LARGEUR - ZONE.droite - ZONE.gauche - 12) / (historique.length - 1) : 0
  const xi = (i: number) => (historique.length > 1 ? ZONE.gauche + 6 + i * pasX : (ZONE.gauche + LARGEUR - ZONE.droite) / 2)
  const yv = (v: number) => ZONE.bas - ((v - bas) / etendue) * (ZONE.bas - ZONE.haut)
  const arrondi1 = (n: number) => Math.round(n * 10) / 10
  const points: PointGraphique[] = historique.map((p, i) => ({ x: arrondi1(xi(i)), y: arrondi1(yv(valeurs[i])), valeur: valeurs[i], dateIso: p.dateIso, source: p }))
  const graduationsY: Graphique['graduationsY'] = []
  for (let v = bas; v <= haut + 1e-9; v += pas) graduationsY.push({ y: arrondi1(yv(v)), libelle: new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(Math.round(v * 100) / 100) })
  // Dates en X : première, dernière et au plus deux intermédiaires, assez espacées pour ne pas se chevaucher
  const avecAnnee = historique.length > 1 && historique[0].dateIso.slice(0, 4) !== historique[historique.length - 1].dateIso.slice(0, 4)
  const rangsX = historique.length <= 3 ? historique.map((_, i) => i) : [0, Math.round((historique.length - 1) / 3), Math.round(((historique.length - 1) * 2) / 3), historique.length - 1]
  const graduationsX = [...new Set(rangsX)].map((i) => ({ x: points[i].x, libelle: dateAxe(historique[i].dateIso, avecAnnee) }))
  let indexRecord = -1
  valeurs.forEach((v, i) => {
    if (indexRecord === -1 || v >= valeurs[indexRecord]) indexRecord = i
  })
  return {
    largeur: LARGEUR, hauteur: HAUTEUR, unite, mesure: actuelle, mesuresDisponibles: avecCharge ? ['charge', 'rm', 'volume'] : ['charge'],
    points, min, max, graduationsY, graduationsX, zone: ZONE, indexRecord,
    polyligne: points.map((p) => `${p.x},${p.y}`).join(' '),
  }
}

export function formaterValeur(valeur: number, unite: UniteHistorique): string {
  if (unite === 'kg') return `${formaterNombre(valeur)} kg`
  return unite === 's' ? `${formaterNombre(valeur)} s` : `${formaterNombre(valeur)} reps`
}

// Trois repères de l'exercice : record de charge, progression depuis la première séance, meilleur 1RM estimé.
export interface SyntheseExercice {
  recordKg: number
  recordDateIso: string
  progressionKg: number
  depuisIso: string
  rmKg: number
}

export function syntheseExercice(historique: PointHistorique[]): SyntheseExercice | null {
  const chargees = historique.filter((p) => p.maxChargeKg > 0 && !p.enSecondes)
  if (chargees.length === 0) return null
  const record = chargees.reduce((m, p) => (p.maxChargeKg >= m.maxChargeKg ? p : m))
  const meilleurRm = chargees.reduce((m, p) => (p.rmEstimeKg >= m.rmEstimeKg ? p : m))
  return {
    recordKg: record.maxChargeKg,
    recordDateIso: record.dateIso,
    progressionKg: Math.round((chargees[chargees.length - 1].maxChargeKg - chargees[0].maxChargeKg) * 100) / 100,
    depuisIso: chargees[0].dateIso,
    rmKg: meilleurRm.rmEstimeKg,
  }
}
