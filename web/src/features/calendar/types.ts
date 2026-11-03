import type { GenreCardio } from '../../core/db/repos/seancesCardio'

export type EtatInstance = 'planifiee' | 'en_cours' | 'terminee'

export interface InstanceVue {
  id: string
  seanceId: string
  nom: string
  dateIso: string
  etat: EtatInstance
  dureeSec?: number
  nbSeries?: number
}

// Un élément de l'agenda, quelle que soit sa source. `genre` est la discriminante : un `switch` exhaustif sur ce champ
// fait échouer la compilation dès qu'un genre n'est pas traité (voir `exhaustif` dans evenements.ts).
export type GenreAgenda = 'renfo' | GenreCardio

interface EvenementCommun {
  id: string
  dateIso: string
  /** Nom de la séance jouée (renforcement) ou titre de la séance de cardio. */
  titre: string
  /** Une séance de cardio validée prend l'état « terminee » (filtres, points et légende réutilisés). */
  etat: EtatInstance
}

export interface EvenementRenfo extends EvenementCommun {
  genre: 'renfo'
  /** L'instance d'origine, inchangée : le renforcement garde tous ses champs. */
  instance: InstanceVue
}

export interface EvenementCardio extends EvenementCommun {
  genre: GenreCardio
  consigne: string | null
  /** Texte « durée · zone » du programme, non découpé. */
  detail: string | null
  optionnelle: boolean
  jalon: string | null
  lien: string | null
}

export type EvenementAgenda = EvenementRenfo | EvenementCardio

export interface JourVue {
  dateIso: string
  jourDuMois: number
  dansLeMois: boolean
  estAujourdhui: boolean
  evenements: EvenementAgenda[]
}

export type StatutFiltre = 'toutes' | 'planifiees' | 'terminees'
export interface Filtre {
  statut: StatutFiltre
}
