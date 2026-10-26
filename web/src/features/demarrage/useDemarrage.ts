import { useCallback, useEffect, useState } from 'react'
import { getDb } from '../../core/db/client'
import type { Db } from '../../core/db/Db'
import { etapesDemarrage, type Demarrage } from './etapesDemarrage'

export const CLE_DEMARRAGE_MASQUE = 'pandamove.demarrage.masque'

// localStorage peut lever (données de site bloquées) : lecture et écriture ne cassent jamais l'écran.
function lireMasque(): boolean {
  try {
    return window.localStorage.getItem(CLE_DEMARRAGE_MASQUE) === '1'
  } catch {
    return false
  }
}
function ecrireMasque(): void {
  try {
    window.localStorage.setItem(CLE_DEMARRAGE_MASQUE, '1')
  } catch {
    // sans conséquence : la carte reviendra au prochain affichage tant que la première séance n'existe pas
  }
}

async function compter(db: Db, sql: string): Promise<number> {
  return (await db.get<{ n: number }>(sql)).n
}

// Carte « Pour commencer » : étapes déduites des données locales (aucun état « fait » stocké). Pendant le chargement ou
// en cas d'erreur de lecture, rien n'est affiché (jamais une fausse carte).
export function useDemarrage(db?: Db): { demarrage: Demarrage | null; masquer: () => void } {
  const [demarrage, setDemarrage] = useState<Demarrage | null>(null)

  useEffect(() => {
    let annule = false
    const base = db ?? getDb()
    ;(async () => {
      const [seances, instances, exercicesBase] = await Promise.all([
        compter(base, "SELECT COUNT(*) AS n FROM seances WHERE deleted_at IS NULL AND UPPER(COALESCE(seance_category, 'STRENGTH')) IN ('STRENGTH', 'STRENGTH_ONESHOT')"),
        compter(base, 'SELECT COUNT(*) AS n FROM instances_seance WHERE deleted_at IS NULL'),
        compter(base, 'SELECT COUNT(*) AS n FROM exercises WHERE deleted_at IS NULL AND is_custom = 0'),
      ])
      if (!annule) setDemarrage(etapesDemarrage({ seances, instances, exercicesBase, masque: lireMasque() }))
    })().catch((e: unknown) => {
      console.error('Lecture de l’état de démarrage impossible', e)
      if (!annule) setDemarrage(null)
    })
    return () => {
      annule = true
    }
  }, [db])

  const masquer = useCallback(() => {
    ecrireMasque()
    setDemarrage((d) => (d ? { ...d, visible: false } : d))
  }, [])

  return { demarrage, masquer }
}
