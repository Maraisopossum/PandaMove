import type { PowerSyncDatabase } from '@powersync/web'
import { useCallback, useEffect, useState } from 'react'
import { getDb } from '../../core/db/client'

export interface SeanceDebug {
  id: string
  nom: string
}

// Hook de la page de debug : observe les séances non supprimées et permet d'en insérer une.
// `db` est paramétrable pour les tests ; par défaut, la base de l'application.
export function useDebugSeances(userId: string, db: PowerSyncDatabase = getDb()) {
  const [seances, setSeances] = useState<SeanceDebug[]>([])

  useEffect(() => {
    const abandon = new AbortController()
    db.watchWithCallback(
      'SELECT id, nom FROM seances WHERE deleted_at IS NULL ORDER BY created_at DESC',
      [],
      { onResult: (resultat) => setSeances((resultat.rows?._array ?? []) as SeanceDebug[]) },
      { signal: abandon.signal },
    )
    return () => abandon.abort()
  }, [db])

  const ajouter = useCallback(async () => {
    const maintenant = new Date()
    // user_id explicite : il alimente les règles de synchro et la colonne NOT NULL côté Postgres
    await db.execute(
      `INSERT INTO seances (id, user_id, updated_at, nom, groupes_musculaires, duree_estimee_min, notes,
         seance_category, created_at, is_archived) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        crypto.randomUUID(),
        userId,
        maintenant.toISOString(),
        `Debug ${maintenant.toLocaleTimeString('fr-FR')}`,
        '',
        0,
        '',
        'strength',
        maintenant.toISOString(),
        0,
      ],
    )
  }, [db, userId])

  return { seances, ajouter }
}
