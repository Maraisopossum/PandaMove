import type { Sortie } from '../../core/db/repos/sorties'
import { dateIsoLocale } from '../../core/common/dates'
import { lundiDe } from '../home/semaine'
import { bornesPeriode, type PeriodeId } from '../stats/periode'

// Statistiques des sorties d'un sport sur une période. Fonctions pures sur les sorties déjà lues.

export interface StatsSorties {
  nombre: number
  distanceM: number
  dureeS: number
  denivelePosM: number
  /** Moyenne des FC moyennes des sorties qui en ont une (null sinon). */
  fcMoy: number | null
  /** Distance par semaine (lundi), les plus anciennes d'abord, semaines vides comprises. */
  semaines: { lundi: string; distanceM: number }[]
  /** Plus longue sortie de la période. */
  plusLongue: { distanceM: number; date: string } | null
}

const JOUR = 86_400_000
const versDate = (iso: string) => new Date(`${iso}T00:00:00Z`)
const versIso = (d: Date) => d.toISOString().slice(0, 10)

export function calculerStats(sorties: Sortie[], periode: PeriodeId, maintenant: Date): StatsSorties {
  const { from, to } = bornesPeriode(periode, maintenant)
  const dans = sorties.filter((s) => s.date >= from && s.date <= to)
  const somme = (f: (s: Sortie) => number | null) => dans.reduce((t, s) => t + (f(s) ?? 0), 0)
  const fcs = dans.map((s) => s.fcMoy).filter((v): v is number => v !== null)

  const parSemaine = new Map<string, number>()
  for (const s of dans) parSemaine.set(lundiDe(s.date), (parSemaine.get(lundiDe(s.date)) ?? 0) + (s.distanceM ?? 0))
  const semaines: StatsSorties['semaines'] = []
  if (dans.length > 0) {
    const premier = [...parSemaine.keys()].sort()[0]
    const debut = periode === 'tout' ? premier : lundiDe(from)
    const dernier = lundiDe(dateIsoLocale(maintenant))
    for (let t = versDate(debut).getTime(); t <= versDate(dernier).getTime() && semaines.length < 60; t += 7 * JOUR) {
      const lundi = versIso(new Date(t))
      semaines.push({ lundi, distanceM: parSemaine.get(lundi) ?? 0 })
    }
  }
  const avecDistance = dans.filter((s) => s.distanceM !== null)
  const plus = avecDistance.sort((a, b) => (b.distanceM as number) - (a.distanceM as number))[0]
  return {
    nombre: dans.length,
    distanceM: somme((s) => s.distanceM),
    dureeS: somme((s) => s.dureeS),
    denivelePosM: somme((s) => s.denivelePosM),
    fcMoy: fcs.length ? Math.round(fcs.reduce((a, b) => a + b, 0) / fcs.length) : null,
    semaines,
    plusLongue: plus ? { distanceM: plus.distanceM as number, date: plus.date } : null,
  }
}

// Trace (polyligne [lat, lon]) et série d'échantillons enregistrées à l'import ; JSON absent ou invalide : liste vide.
export interface Echantillon {
  t: number | null
  fc: number | null
  w: number | null
  v: number | null
  a: number | null
  c: number | null
}

function lireJson<T>(texte: string | null): T[] {
  if (!texte) return []
  try {
    const v: unknown = JSON.parse(texte)
    return Array.isArray(v) ? (v as T[]) : []
  } catch {
    return []
  }
}

export const lireTrace = (s: Pick<Sortie, 'trace'>) => lireJson<[number, number]>(s.trace).filter((p) => Array.isArray(p) && p.length === 2)
export const lireSerie = (s: Pick<Sortie, 'serie'>) => lireJson<Echantillon>(s.serie)

// Points SVG d'une trace, projetés (longitude corrigée par cos(latitude)) dans un cadre largeur × hauteur avec marge.
export function projeterTrace(trace: [number, number][], largeur: number, hauteur: number, marge = 10): string {
  if (trace.length < 2) return ''
  const lats = trace.map((p) => p[0])
  const lat0 = (Math.min(...lats) + Math.max(...lats)) / 2
  const k = Math.cos((lat0 * Math.PI) / 180)
  const xs = trace.map((p) => p[1] * k)
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...lats), Math.max(...lats)]
  const echelle = Math.min((largeur - 2 * marge) / ((maxX - minX) || 1e-9), (hauteur - 2 * marge) / ((maxY - minY) || 1e-9))
  const dx = (largeur - (maxX - minX) * echelle) / 2
  const dy = (hauteur - (maxY - minY) * echelle) / 2
  return trace.map((p, i) => `${((xs[i] - minX) * echelle + dx).toFixed(1)},${(hauteur - ((p[0] - minY) * echelle + dy)).toFixed(1)}`).join(' ')
}

// Courbe d'une grandeur de la série : points SVG normalisés (min en bas, max en haut) et bornes ; null sans donnée.
export function courbeSerie(serie: Echantillon[], champ: 'fc' | 'w' | 'v' | 'a', largeur: number, hauteur: number): { points: string; min: number; max: number } | null {
  const pts = serie.map((e, i) => ({ x: e.t ?? i, y: e[champ] })).filter((p): p is { x: number; y: number } => p.y !== null && p.y > 0)
  if (pts.length < 2) return null
  const [minY, maxY] = [Math.min(...pts.map((p) => p.y)), Math.max(...pts.map((p) => p.y))]
  const [minX, maxX] = [pts[0].x, pts[pts.length - 1].x]
  const points = pts.map((p) => `${(((p.x - minX) / ((maxX - minX) || 1)) * largeur).toFixed(1)},${(hauteur - 4 - ((p.y - minY) / ((maxY - minY) || 1)) * (hauteur - 8)).toFixed(1)}`).join(' ')
  return { points, min: minY, max: maxY }
}
