import { parseTimestamp } from '../../../core/common/parseTimestamp'
import { clockFromRow, type SessionClock } from './sessionClock'

// Séance en cours « à reprendre » et titre d'onglet : l'équivalent web du service / de la notification de séance
// active de l'Android. Fonctions pures.

const DELAI_MAX_MS = 24 * 3600 * 1000

export interface LigneActive {
  id: string
  nom: string
  started_at: string | null
  paused_json: string | null
}

export interface SeanceActive {
  id: string
  nom: string
  horloge: SessionClock
}

/**
 * La séance démarrée et non terminée à proposer de reprendre : la plus récemment démarrée, pas plus ancienne que 24 h
 * (une séance oubliée depuis des jours n'est pas une séance « en cours »).
 */
export function choisirSeanceActive(lignes: LigneActive[], maintenantMs: number): SeanceActive | null {
  let retenue: { ligne: LigneActive; debutMs: number } | null = null
  for (const ligne of lignes) {
    const debutMs = parseTimestamp(ligne.started_at)
    if (debutMs === null || maintenantMs - debutMs > DELAI_MAX_MS) continue
    if (!retenue || debutMs > retenue.debutMs) retenue = { ligne, debutMs }
  }
  return retenue ? { id: retenue.ligne.id, nom: retenue.ligne.nom, horloge: clockFromRow(retenue.ligne) } : null
}

interface EntreeTitre {
  nomSeance: string
  chrono: string
  /** Repos restant formaté (« 01:05 »), null sans repos en cours */
  repos: string | null
  enPause: boolean
  termine: boolean
  demarre: boolean
}

/** Titre de l'onglet : repos et chrono visibles même quand l'onglet est en arrière-plan. */
export function titreOnglet({ nomSeance, chrono, repos, enPause, termine, demarre }: EntreeTitre): string {
  const marque = 'PandaMove'
  if (termine || !demarre) return `${nomSeance} · ${marque}`
  if (enPause) return `En pause · ${nomSeance} · ${marque}`
  return [repos ? `Repos ${repos}` : null, chrono, nomSeance, marque].filter(Boolean).join(' · ')
}
