import { useEffect, useState } from 'react'
import { useLocation } from 'react-router'
import { getDb } from '../../../core/db/client'
import { choisirSeanceActive, type LigneActive, type SeanceActive } from './seanceActive'

const PERIODE_MS = 10_000

// Séance démarrée et non terminée, relue en base à chaque changement d'écran puis toutes les 10 s (une autre
// fenêtre peut l'avoir démarrée, terminée ou supprimée). Base indisponible ou erreur : aucune séance, sans bruit.
export function useSeanceActive(): SeanceActive | null {
  const { pathname } = useLocation()
  const [seance, setSeance] = useState<SeanceActive | null>(null)

  useEffect(() => {
    let annule = false
    const lire = async () => {
      try {
        const lignes = await getDb().getAll<LigneActive>(
          `SELECT i.id AS id, COALESCE(NULLIF(TRIM(i.nom), ''), s.nom, 'Séance') AS nom, i.started_at AS started_at, i.paused_json AS paused_json
           FROM instances_seance i LEFT JOIN seances s ON s.id = i.seance_id
           WHERE i.started_at IS NOT NULL AND i.is_completed = 0 AND i.deleted_at IS NULL`,
        )
        if (!annule) setSeance(choisirSeanceActive(lignes, Date.now()))
      } catch {
        if (!annule) setSeance(null)
      }
    }
    void lire()
    const id = setInterval(() => void lire(), PERIODE_MS)
    return () => {
      annule = true
      clearInterval(id)
    }
  }, [pathname])

  return seance
}
