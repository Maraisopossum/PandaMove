import type { InstanceVue, JourVue } from './types'

export interface Mois {
  year: number
  /** 1 à 12 */
  month: number
}

const deux = (n: number) => String(n).padStart(2, '0')

// Toute l'arithmétique de dates passe par des Date construites avec des parties LOCALES
// (année, mois, jour), jamais par new Date('yyyy-MM-dd') qui est interprété en UTC et décale d'un jour.
export function isoDepuisParties(annee: number, mois: number, jour: number): string {
  return `${String(annee).padStart(4, '0')}-${deux(mois)}-${deux(jour)}`
}

function partiesIso(iso: string): [number, number, number] {
  const [a, m, j] = iso.split('-').map(Number)
  return [a, m, j]
}

// Date locale (à midi, loin des bascules d'heure) correspondant à un jour ISO.
function dateLocale(iso: string): Date {
  const [a, m, j] = partiesIso(iso)
  return new Date(a, m - 1, j, 12)
}

export function ajouterJours(iso: string, n: number): string {
  const [a, m, j] = partiesIso(iso)
  const d = new Date(a, m - 1, j + n, 12)
  return isoDepuisParties(d.getFullYear(), d.getMonth() + 1, d.getDate())
}

export const moisSuivant = ({ year, month }: Mois): Mois => (month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 })
export const moisPrecedent = ({ year, month }: Mois): Mois => (month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 })

export function moisDe(iso: string): Mois {
  const [year, month] = partiesIso(iso)
  return { year, month }
}

// Position dans la semaine française : lundi = 0 … dimanche = 6.
const indexLundi = (d: Date) => (d.getDay() + 6) % 7

// Grille du mois : semaines complètes commençant le lundi ; les jours des mois voisins sont marqués
// `dansLeMois: false`. Les instances sont vides ici (rattachées ensuite par le hook).
export function construireGrille(mois: Mois, aujourdhuiIso: string): JourVue[] {
  const premier = new Date(mois.year, mois.month - 1, 1, 12)
  const dernier = new Date(mois.year, mois.month, 0, 12)
  const debutIso = ajouterJours(isoDepuisParties(mois.year, mois.month, 1), -indexLundi(premier))
  const total = indexLundi(premier) + dernier.getDate() + (6 - indexLundi(dernier))
  const prefixe = isoDepuisParties(mois.year, mois.month, 1).slice(0, 7)
  return Array.from({ length: total }, (_, i) => {
    const dateIso = ajouterJours(debutIso, i)
    return {
      dateIso,
      jourDuMois: Number(dateIso.slice(8)),
      dansLeMois: dateIso.startsWith(prefixe),
      estAujourdhui: dateIso === aujourdhuiIso,
      instances: [] as InstanceVue[],
    }
  })
}

export function formaterMois({ year, month }: Mois): string {
  return new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1, 12))
}

export function formaterJourLong(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(dateLocale(iso))
}

export function formaterJourCourt(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }).format(dateLocale(iso))
}

export const JOURS_SEMAINE = ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.'] as const
