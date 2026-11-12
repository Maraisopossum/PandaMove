import { useEffect, useState } from 'react'
import { getDb } from '../../core/db/client'
import { lireParId, type SeanceCardio } from '../../core/db/repos/seancesCardio'
import type { Sortie } from '../../core/db/repos/sorties'

// Séance du calendrier à laquelle une sortie est liée (null : aucune, ou séance supprimée).
export function useSeanceLiee(sortie: Pick<Sortie, 'sport' | 'seanceId'> | null): SeanceCardio | null {
  const [lue, setLue] = useState<{ id: string; seance: SeanceCardio | null } | null>(null)
  const id = sortie?.seanceId ?? null
  const sport = sortie?.sport
  useEffect(() => {
    if (!id || !sport) return
    let annule = false
    lireParId(getDb(), sport, id)
      .then((s) => !annule && setLue({ id, seance: s && !s.supprimee ? s : null }))
      .catch((e: unknown) => console.error('Lecture de la séance liée impossible', e))
    return () => {
      annule = true
    }
  }, [id, sport])
  return id && lue?.id === id ? lue.seance : null
}
