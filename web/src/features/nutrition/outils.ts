import { dateIsoLocale, dateIsoValide } from '../../core/common/dates'
import { estRepas, repasParDefaut, type Repas } from '../../core/nutrition/calculs'

// Petits outils partagés par les écrans de nutrition : jours, paramètres d'adresse, ajustement de quantité, formats.

/** Jour décalé de `n` jours (yyyy-MM-dd), calculé à midi pour échapper aux changements d'heure. */
export function decalerJour(date: string, n: number): string {
  const d = new Date(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10), 12)
  d.setDate(d.getDate() + n)
  return dateIsoLocale(d)
}

/** Jour demandé dans l'adresse (`?date=`), sinon aujourd'hui. */
export function jourDemande(param: string | null, aujourdhui: string): string {
  return param && dateIsoValide(param) ? param : aujourdhui
}

/** Repas demandé dans l'adresse (`?repas=`), sinon celui de l'heure. */
export function repasDemande(param: string | null, heure = new Date().getHours()): Repas {
  return estRepas(param) ? param : repasParDefaut(heure)
}

export function libelleJour(date: string, aujourdhui: string): string {
  if (date === aujourdhui) return 'Aujourd’hui'
  if (date === decalerJour(aujourdhui, -1)) return 'Hier'
  if (date === decalerJour(aujourdhui, 1)) return 'Demain'
  return new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10), 12))
}

export const libelleCourt = (date: string) => new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric' }).format(new Date(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10), 12))

/** Pas des boutons de quantité (grammes), comme le prévoit le design (« -10 g, -5 g, +5 g, +10 g, -50 g, +50 g »). */
export const PAS_QUANTITE = [-50, -10, -5, 5, 10, 50] as const
export const QUANTITE_MAX = 5000

export const ajusterQuantite = (q: number, delta: number) => Math.min(QUANTITE_MAX, Math.max(0, Math.round((q + delta) * 10) / 10))

/** 1 234 : séparateur de milliers français insécable. */
export const entier = (v: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Math.round(v))
export const decimal = (v: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(v)

/** Lecture du code-barres par la caméra : seulement là où le navigateur sait le faire (BarcodeDetector). Ailleurs, la saisie du numéro reste possible. */
export const scanPossible = (): boolean =>
  typeof window !== 'undefined' && 'BarcodeDetector' in window && typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia
