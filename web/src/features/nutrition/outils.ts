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

/** Mot d'accueil du journal : selon l'heure pour aujourd'hui, « Bilan de la journée » pour un autre jour (le jour est déjà dans le sélecteur). */
export function salutDuJour(date: string, aujourdhui: string, heure: number): string {
  if (date !== aujourdhui) return 'Bilan de la journée'
  if (heure < 11) return 'Bon matin'
  if (heure < 14) return 'Bon appétit'
  if (heure < 18) return 'Bon après-midi'
  return 'Bonne soirée'
}

export interface BilanJour {
  /** Titre de l'encart quand l'objectif est atteint (sinon l'encart garde le mot d'accueil). */
  titre: string
  texte: string
  /** Énergie à 10 % près de l'objectif : le panda fête. */
  atteint: boolean
}

/**
 * Phrase du bilan d'énergie : informer sans jamais reprocher. Atteint = entre 90 % et 110 % de l'objectif ;
 * au-delà, un ton neutre et bienveillant ; en dessous, ce qu'il reste (aujourd'hui) ou le total (autre jour).
 */
export function bilanDuJour(consomme: number, objectif: number | null, estAujourdhui: boolean): BilanJour {
  if (!objectif || objectif <= 0) {
    return { titre: '', texte: estAujourdhui ? 'Ajoutez vos repas pour suivre votre journée.' : `${entier(consomme)} kcal ce jour-là.`, atteint: false }
  }
  if (consomme >= objectif * 0.9 && consomme <= objectif * 1.1) {
    return { titre: 'Objectif atteint, bravo !', texte: `${entier(consomme)} kcal sur ${entier(objectif)}.`, atteint: true }
  }
  if (consomme > objectif * 1.1) {
    return { titre: '', texte: estAujourdhui ? 'Au-dessus de l’objectif aujourd’hui : rien de grave, on reprend demain.' : 'Au-dessus de l’objectif ce jour-là.', atteint: false }
  }
  return { titre: '', texte: estAujourdhui ? `Il reste ${entier(objectif - consomme)} kcal pour aujourd’hui.` : `${entier(consomme)} kcal sur ${entier(objectif)}.`, atteint: false }
}

/** Petit mot sous la barre d'hydratation. */
export function messageEau(eauMl: number, objectifMl: number): string {
  if (objectifMl <= 0) return ''
  if (eauMl >= objectifMl) return 'Objectif d’eau atteint.'
  return eauMl >= objectifMl / 2 ? `Plus que ${entier(objectifMl - eauMl)} ml.` : 'Un verre de plus ?'
}

/** 1 234 : séparateur de milliers français insécable. */
export const entier = (v: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Math.round(v))
export const decimal = (v: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(v)

/** Lecture du code-barres par la caméra : seulement là où le navigateur sait le faire (BarcodeDetector). Ailleurs, la saisie du numéro reste possible. */
export const scanPossible = (): boolean =>
  typeof window !== 'undefined' && 'BarcodeDetector' in window && typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia
