import { useCallback, useEffect, useState } from 'react'
import { getDb } from '../../core/db/client'
import type { Db } from '../../core/db/Db'
import { lireSeancesMobilite, reprendreHistoriqueLocal } from '../../core/db/repos/mobilite'
import { TOUTES_ZONES, type ZoneCorps } from './donnees'
import { effacerHistoriqueLocal, lireHistorique, sportEnregistre, type SeanceFaite } from './stockage'

export interface DepsHistorique {
  /** Base à utiliser (défaut : base de l'application, résolue à l'usage). */
  db?: Db
  userId?: string | null
}

const estZone = (z: string): z is ZoneCorps => TOUTES_ZONES.includes(z as ZoneCorps)

// Historique des séances de mobilité, synchronisé entre appareils. Au premier affichage, l'historique gardé jusqu'ici dans
// le navigateur est repris en base (une fois, sans doublon) puis effacé du navigateur. Une erreur de lecture laisse la
// liste vide : l'écran reste utilisable.
export function useHistoriqueMobilite({ db, userId }: DepsHistorique = {}) {
  const [historique, setHistorique] = useState<SeanceFaite[]>([])

  const lire = useCallback(async (): Promise<SeanceFaite[]> => {
    const base = db ?? getDb()
    const anciennes = lireHistorique()
    if (userId && anciennes.length > 0) {
      await reprendreHistoriqueLocal(base, userId, anciennes.map((s) => ({ ...s, sport: sportEnregistre(s.sport) })))
      effacerHistoriqueLocal()
    }
    const seances = await lireSeancesMobilite(base)
    return seances.map((s) => ({ date: s.date, dureeS: s.dureeS, exercices: s.exercices, zones: s.zones.filter(estZone), sport: s.sport }))
  }, [db, userId])

  useEffect(() => {
    let annule = false
    lire()
      .then((liste) => {
        if (!annule) setHistorique(liste)
      })
      .catch((e: unknown) => console.error("Lecture de l'historique de mobilité impossible", e))
    return () => {
      annule = true
    }
  }, [lire])

  return historique
}
