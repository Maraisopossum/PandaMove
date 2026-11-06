import type { Sport } from '../../core/db/repos/sorties'

// Présentation des métriques d'une sortie (texte en français). Fonctions pures, sans accès aux données.

export const LIBELLE_SPORT: Record<Sport, string> = { course: 'Course', velo: 'Vélo' }

const deux = (n: number) => String(n).padStart(2, '0')

// 3000 -> « 50:00 » ; 3900 -> « 1:05:00 » (heures sans zéro initial, minutes et secondes sur deux chiffres).
export function formaterDuree(secondes: number): string {
  const total = Math.max(0, Math.round(secondes))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return h > 0 ? `${h}:${deux(m)}:${deux(s)}` : `${m}:${deux(s)}`
}

// 10020 -> « 10,02 » (virgule française, deux décimales) : le nombre seul, l'unité est affichée à part.
export function distanceKm(metres: number): string {
  return (metres / 1000).toFixed(2).replace('.', ',')
}

// 10020 -> « 10,02 km ».
export function formaterDistance(metres: number): string {
  return `${distanceKm(metres)} km`
}

// Allure de course : durée par kilomètre, « 5:00 /km ». null sans distance ou sans durée.
export function formaterAllure(distanceM: number | null, dureeS: number | null): string | null {
  if (!distanceM || !dureeS || distanceM <= 0 || dureeS <= 0) return null
  return `${formaterDuree(dureeS / (distanceM / 1000))} /km`
}

// Vitesse moyenne du vélo, « 28,3 km/h ». null sans distance ou sans durée.
export function formaterVitesse(distanceM: number | null, dureeS: number | null): string | null {
  if (!distanceM || !dureeS || distanceM <= 0 || dureeS <= 0) return null
  return `${((distanceM / 1000) / (dureeS / 3600)).toFixed(1).replace('.', ',')} km/h`
}

// « 5 nov. 2026 » depuis yyyy-MM-dd, sans décalage de fuseau (le jour est celui que l'utilisateur a choisi).
export function formaterDate(dateIso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateIso)
  if (!m) return dateIso
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(d)
}

// « 5 nov. » depuis yyyy-MM-dd (liste : l'année est inutile et prend de la place).
export function formaterDateCourte(dateIso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateIso)
  if (!m) return dateIso
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(d)
}

export interface ResumeSortie {
  sport: Sport
  dureeS: number | null
  distanceM: number | null
}

// Allure (course) ou vitesse (vélo) selon le sport.
export function formaterRythme(s: ResumeSortie): string | null {
  return s.sport === 'course' ? formaterAllure(s.distanceM, s.dureeS) : formaterVitesse(s.distanceM, s.dureeS)
}
