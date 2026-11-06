import type { EvenementAgenda } from '../calendar/types'

// Rythme de la semaine (lundi à dimanche) affiché à l'accueil. Fonctions pures : dates au format yyyy-MM-dd, calculées en
// UTC pour qu'aucun fuseau ni changement d'heure ne décale un jour.

export type EtatJour = 'fait' | 'prevu' | 'manque' | 'repos'

export interface JourSemaine {
  dateIso: string
  lettre: string
  jourDuMois: number
  etat: EtatJour
  estAujourdhui: boolean
  /** Nombre de séances (tous sports) ce jour-là. */
  nombre: number
}

export interface Semaine {
  jours: JourSemaine[]
  terminees: number
  total: number
}

const LETTRES = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
const JOUR_MS = 86_400_000

const versDate = (dateIso: string) => {
  const [a, m, j] = dateIso.split('-').map(Number)
  return new Date(Date.UTC(a, m - 1, j))
}
const versIso = (d: Date) => d.toISOString().slice(0, 10)

/** Lundi de la semaine qui contient la date. */
export function lundiDe(dateIso: string): string {
  const d = versDate(dateIso)
  const decalage = (d.getUTCDay() + 6) % 7
  return versIso(new Date(d.getTime() - decalage * JOUR_MS))
}

/** Premier et dernier jour (lundi, dimanche) de la semaine de la date. */
export function bornesSemaine(dateIso: string): { debut: string; fin: string } {
  const debut = lundiDe(dateIso)
  return { debut, fin: versIso(new Date(versDate(debut).getTime() + 6 * JOUR_MS)) }
}

// Un jour est « fait » s'il compte au moins une séance terminée ; « prévu » s'il compte une séance à faire aujourd'hui ou
// plus tard ; « manqué » si une séance prévue est restée à faire dans le passé ; « repos » sinon.
export function construireSemaine(aujourdhuiIso: string, evenements: EvenementAgenda[]): Semaine {
  const { debut } = bornesSemaine(aujourdhuiIso)
  const base = versDate(debut).getTime()
  const jours: JourSemaine[] = LETTRES.map((lettre, i) => {
    const dateIso = versIso(new Date(base + i * JOUR_MS))
    const duJour = evenements.filter((e) => e.dateIso === dateIso)
    const aFaire = duJour.some((e) => e.etat !== 'terminee')
    let etat: EtatJour = 'repos'
    if (duJour.some((e) => e.etat === 'terminee')) etat = 'fait'
    else if (aFaire) etat = dateIso >= aujourdhuiIso ? 'prevu' : 'manque'
    return { dateIso, lettre, jourDuMois: Number(dateIso.slice(8)), etat, estAujourdhui: dateIso === aujourdhuiIso, nombre: duJour.length }
  })
  const debutIso = jours[0].dateIso
  const finIso = jours[6].dateIso
  const dansSemaine = evenements.filter((e) => e.dateIso >= debutIso && e.dateIso <= finIso)
  return { jours, terminees: dansSemaine.filter((e) => e.etat === 'terminee').length, total: dansSemaine.length }
}

const NOMS_JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']
const MOIS_COURTS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']

/** « Aujourd'hui », « Demain » ou « vendredi 6 nov. ». */
export function libelleJour(dateIso: string, aujourdhuiIso: string): string {
  if (dateIso === aujourdhuiIso) return 'Aujourd’hui'
  if (dateIso === versIso(new Date(versDate(aujourdhuiIso).getTime() + JOUR_MS))) return 'Demain'
  const d = versDate(dateIso)
  return `${NOMS_JOURS[d.getUTCDay()]} ${d.getUTCDate()} ${MOIS_COURTS[d.getUTCMonth()]}`
}
