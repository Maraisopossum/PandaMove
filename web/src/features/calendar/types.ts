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

export interface JourVue {
  dateIso: string
  jourDuMois: number
  dansLeMois: boolean
  estAujourdhui: boolean
  instances: InstanceVue[]
}

export type StatutFiltre = 'toutes' | 'planifiees' | 'terminees'
export interface Filtre {
  statut: StatutFiltre
}
