import { useEffect, useState } from 'react'
import { getDb } from '../../../core/db/client'
import type { DbLecture } from '../../../core/db/Db'
import { bilanInstance, type BilanInstance } from '../../stats/statsQueries'

/** Compléments du rapport d'une séance terminée (écarts, records) ; null tant qu'ils ne sont pas lus ou si la lecture échoue. */
export function useBilanInstance(instanceId: string, db?: DbLecture): BilanInstance | null {
  const [bilan, setBilan] = useState<BilanInstance | null>(null)
  useEffect(() => {
    let annule = false
    bilanInstance(db ?? getDb(), instanceId)
      .then((b) => !annule && setBilan(b))
      .catch((e: unknown) => console.error('Bilan de séance impossible', e))
    return () => {
      annule = true
    }
  }, [instanceId, db])
  return bilan
}
