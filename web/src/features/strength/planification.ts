import type { Db } from '../../core/db/Db'
import { createInstance } from '../../core/db/repos/instances'
import { dateIsoValide, ErreurSeance } from './affectation'

// Affectation de plusieurs séances à la fois (équivalents d'assignToDates / assignRecurring d'Android).

/** Plafond d'occurrences d'une récurrence (garde-fou : 365 séances d'un coup seraient une erreur de saisie). */
export const MAX_OCCURRENCES = 365

export type UniteRecurrence = 'jour' | 'semaine' | 'mois'
export type FinRecurrence = { type: 'jamais' } | { type: 'date'; date: string } | { type: 'occurrences'; n: number }

export interface Recurrence {
  /** Première date (yyyy-MM-dd) */
  debut: string
  /** « Tous les N … » */
  pas: number
  unite: UniteRecurrence
  fin: FinRecurrence
}

// Comme Android : un mois = 30 jours (pas de calendrier mensuel), une semaine = 7 jours.
const JOURS: Record<UniteRecurrence, number> = { jour: 1, semaine: 7, mois: 30 }
// Sans fin choisie : un an de séances au plus (Android : 365 jours / 52 semaines / 12 mois).
const PLAFOND_SANS_FIN: Record<UniteRecurrence, number> = { jour: 365, semaine: 52, mois: 12 }

function ajouterJours(dateIso: string, jours: number): string {
  const [a, m, j] = dateIso.split('-').map(Number)
  return new Date(Date.UTC(a, m - 1, j + jours)).toISOString().slice(0, 10)
}

// Dates d'une récurrence, dans l'ordre. Lève ErreurSeance (message français) si un paramètre est invalide.
export function datesRecurrence({ debut, pas, unite, fin }: Recurrence): string[] {
  if (!dateIsoValide(debut)) throw new ErreurSeance('Date de début invalide : choisissez une date réelle.')
  if (!Number.isInteger(pas) || pas < 1 || pas > 365) throw new ErreurSeance('Répétition invalide : choisissez un nombre entier de 1 à 365.')
  const intervalle = pas * JOURS[unite]
  let nombre: number
  if (fin.type === 'occurrences') {
    if (!Number.isInteger(fin.n) || fin.n < 1 || fin.n > MAX_OCCURRENCES) {
      throw new ErreurSeance(`Nombre de séances invalide : choisissez un nombre entier de 1 à ${MAX_OCCURRENCES}.`)
    }
    nombre = fin.n
  } else if (fin.type === 'date') {
    if (!dateIsoValide(fin.date)) throw new ErreurSeance('Date de fin invalide : choisissez une date réelle.')
    // Différence en jours entiers (UTC : pas de décalage d'heure d'été)
    const ecart = (Date.parse(fin.date) - Date.parse(debut)) / 86_400_000
    nombre = ecart >= 0 ? Math.min(Math.floor(ecart / intervalle) + 1, MAX_OCCURRENCES) : 1
  } else {
    nombre = PLAFOND_SANS_FIN[unite]
  }
  return Array.from({ length: nombre }, (_, i) => ajouterJours(debut, i * intervalle))
}

// Crée UNE instance par date distincte (triées), en une transaction : tout ou rien. Aucune copie des
// blocs/exercices ici (elle a lieu à l'ouverture de l'exécution, voir copyTemplateToInstance).
export async function assignerDates(db: Db, seanceId: string, dates: string[]): Promise<string[]> {
  const distinctes = [...new Set(dates)].sort()
  if (distinctes.length === 0) throw new ErreurSeance('Choisissez au moins une date.')
  if (distinctes.some((d) => !dateIsoValide(d))) throw new ErreurSeance('Date invalide : choisissez des dates réelles.')
  return db.writeTransaction(async (tx) => {
    const modele = await tx.getOptional<{ id: string }>('SELECT id FROM seances WHERE id = ? AND deleted_at IS NULL', [seanceId])
    if (!modele) throw new ErreurSeance('Séance introuvable.')
    const ids: string[] = []
    for (const date of distinctes) ids.push(await createInstance(tx, seanceId, date))
    return ids
  })
}
