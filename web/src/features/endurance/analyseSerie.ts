import type { Echantillon } from './statsSorties'

// Analyse de la série d'échantillons d'une sortie (300 points au plus, réduits à l'import) : distance cumulée, meilleur temps
// sur une distance, meilleur effort moyen de puissance sur une durée, temps passé par zone. Fonctions pures. Les échantillons
// sont espacés de plusieurs secondes (de 5 à 40 s selon la durée de la sortie) : les résultats sont des estimations, et une
// mesure trop fine pour cet espacement n'est pas calculée (null) plutôt qu'inventée.

interface Point {
  t: number
  v: number | null
  w: number | null
  fc: number | null
}

/** Échantillons exploitables : temps connu, ordre chronologique, doublons de temps écartés. */
function points(serie: readonly Echantillon[]): Point[] {
  const sortis = serie
    .filter((e): e is Echantillon & { t: number } => e.t !== null && Number.isFinite(e.t))
    .map((e) => ({ t: e.t, v: e.v, w: e.w, fc: e.fc }))
    .sort((a, b) => a.t - b.t)
  return sortis.filter((p, i) => i === 0 || p.t > sortis[i - 1].t)
}

/** Écart médian entre deux échantillons, en secondes (0 sans deux points). */
export function ecartMedian(serie: readonly Echantillon[]): number {
  const p = points(serie)
  if (p.length < 2) return 0
  const ecarts = p.slice(1).map((x, i) => x.t - p[i].t).sort((a, b) => a - b)
  return ecarts[Math.floor(ecarts.length / 2)]
}

export interface DistanceCumulee {
  /** Instants (s depuis le départ) et distance parcourue à chacun (m). */
  t: number[]
  d: number[]
}

/**
 * Distance cumulée par intégration de la vitesse (trapèzes). Quand la distance officielle de la sortie est connue, la courbe est
 * remise à l'échelle pour l'atteindre ; un écart de plus de 40 % entre les deux signale une vitesse inexploitable : null.
 */
export function distanceCumulee(serie: readonly Echantillon[], distanceTotaleM: number | null): DistanceCumulee | null {
  const p = points(serie)
  if (p.length < 3) return null
  const t = [p[0].t]
  const d = [0]
  let v = p[0].v ?? 0
  for (let i = 1; i < p.length; i++) {
    const suivante = p[i].v ?? v
    d.push(d[i - 1] + ((v + suivante) / 2) * (p[i].t - p[i - 1].t))
    t.push(p[i].t)
    v = suivante
  }
  const total = d[d.length - 1]
  if (total <= 0) return null
  if (distanceTotaleM !== null && distanceTotaleM > 0) {
    const rapport = distanceTotaleM / total
    if (rapport < 0.6 || rapport > 1.4) return null
    return { t, d: d.map((x) => x * rapport) }
  }
  return { t, d }
}

/** Meilleur temps (s) sur `cibleM` mètres consécutifs ; null si la sortie est plus courte. */
export function meilleurTemps(cumul: DistanceCumulee, cibleM: number): number | null {
  const { t, d } = cumul
  const n = t.length
  if (n < 2 || d[n - 1] < cibleM) return null
  let meilleur = Infinity
  let j = 1
  for (let i = 0; i < n - 1; i++) {
    const visee = d[i] + cibleM
    if (visee > d[n - 1]) break
    while (j < n && d[j] < visee) j++
    if (j >= n) break
    // Interpolation linéaire de l'instant où la distance visée est atteinte
    const ecartD = d[j] - d[j - 1]
    const tFin = ecartD > 0 ? t[j - 1] + ((visee - d[j - 1]) / ecartD) * (t[j] - t[j - 1]) : t[j]
    meilleur = Math.min(meilleur, tFin - t[i])
  }
  return Number.isFinite(meilleur) && meilleur > 0 ? meilleur : null
}

/**
 * Meilleure puissance moyenne (W) sur `dureeS` secondes consécutives. Exige de la puissance sur 80 % des échantillons, une sortie
 * au moins aussi longue que l'effort et un espacement médian d'au plus le quart de sa durée ; sinon null.
 */
export function meilleurEffort(serie: readonly Echantillon[], dureeS: number): number | null {
  const p = points(serie)
  if (p.length < 3) return null
  if (p.filter((x) => x.w !== null).length < p.length * 0.8) return null
  const ecarts = p.slice(1).map((x, i) => x.t - p[i].t).sort((a, b) => a - b)
  if (ecarts[Math.floor(ecarts.length / 2)] > dureeS / 4) return null
  if (p[p.length - 1].t - p[0].t < dureeS) return null
  // Énergie cumulée (W·s) aux échantillons ; la puissance d'un échantillon vaut jusqu'au suivant
  const e = [0]
  for (let i = 1; i < p.length; i++) e.push(e[i - 1] + (p[i - 1].w ?? 0) * (p[i].t - p[i - 1].t))
  const energieA = (instant: number): number => {
    let k = p.findIndex((x) => x.t > instant) - 1
    if (k < 0) k = instant >= p[p.length - 1].t ? p.length - 1 : 0
    return e[k] + (k < p.length - 1 ? (p[k].w ?? 0) * (instant - p[k].t) : 0)
  }
  let meilleur = 0
  for (let i = 0; i < p.length; i++) {
    const fin = p[i].t + dureeS
    if (fin > p[p.length - 1].t) break
    meilleur = Math.max(meilleur, (energieA(fin) - e[i]) / dureeS)
  }
  return meilleur > 0 ? Math.round(meilleur) : null
}

// ── Zones ────────────────────────────────────────────────────────────────────────────────────────────────────

/** Limites hautes des quatre premières zones, en part de la FTP (puissance) ou de la FC max (cœur). */
export const LIMITES_ZONES = {
  w: [0.55, 0.75, 0.9, 1.05],
  fc: [0.6, 0.7, 0.8, 0.9],
} as const

export type MesureZones = keyof typeof LIMITES_ZONES

export interface ZoneTemps {
  nom: string
  /** « < 146 W », « 146 – 198 W », « > 278 W » (ou bpm). */
  plage: string
  dureeS: number
  /** Part du temps mesuré, 0..1. */
  part: number
}

const UNITE = { w: 'W', fc: 'bpm' } as const
// Un échantillon vaut jusqu'au suivant, mais pas au-delà de 2 min (pause, arrêt de l'enregistrement)
const DUREE_MAX_ECHANTILLON_S = 120

/**
 * Temps passé dans chacune des cinq zones. `reference` : FTP (W) ou FC max (bpm). null sans référence ou sans mesure sur au
 * moins 80 % des échantillons.
 */
export function tempsParZone(serie: readonly Echantillon[], mesure: MesureZones, reference: number | null): ZoneTemps[] | null {
  if (!reference || reference <= 0) return null
  const p = points(serie)
  if (p.length < 3) return null
  if (p.filter((x) => x[mesure] !== null && x[mesure]! > 0).length < p.length * 0.8) return null
  const limites = LIMITES_ZONES[mesure].map((x) => x * reference)
  const secondes = [0, 0, 0, 0, 0]
  for (let i = 0; i < p.length - 1; i++) {
    const valeur = p[i][mesure]
    if (valeur === null) continue
    const duree = Math.min(p[i + 1].t - p[i].t, DUREE_MAX_ECHANTILLON_S)
    const zone = limites.findIndex((l) => valeur < l)
    secondes[zone === -1 ? 4 : zone] += duree
  }
  const total = secondes.reduce((a, b) => a + b, 0)
  if (total <= 0) return null
  const u = UNITE[mesure]
  const bornes = limites.map(Math.round)
  const plages = [
    `< ${bornes[0]} ${u}`,
    `${bornes[0]} – ${bornes[1] - 1} ${u}`,
    `${bornes[1]} – ${bornes[2] - 1} ${u}`,
    `${bornes[2]} – ${bornes[3] - 1} ${u}`,
    `≥ ${bornes[3]} ${u}`,
  ]
  return secondes.map((s, i) => ({ nom: `Z${i + 1}`, plage: plages[i], dureeS: Math.round(s), part: s / total }))
}
