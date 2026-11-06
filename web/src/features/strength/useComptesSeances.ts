import { useEffect, useState } from 'react'
import { getDb } from '../../core/db/client'
import type { Db } from '../../core/db/Db'
import { listSeanceTemplates } from '../../core/db/repos/seances'
import { lireSeancesProgrammees, lireSeancesTerminees } from './listesInstances'
import type { VueSeances } from './OngletsSeances'

export type ComptesSeances = Partial<Record<VueSeances, number>>

export interface DepsComptes {
  /** Base à lire (défaut : base de l'application, résolue à l'usage). */
  db?: Db
}

// Effectifs des trois vues de séances (types actifs, programmées, terminées), pour les onglets : mêmes lectures que les
// listes, donc mêmes nombres. Une lecture qui échoue laisse simplement les onglets sans effectif.
export function useComptesSeances({ db }: DepsComptes = {}): ComptesSeances {
  const [comptes, setComptes] = useState<ComptesSeances>({})
  useEffect(() => {
    let annule = false
    const base = db ?? getDb()
    void Promise.all([listSeanceTemplates(base), lireSeancesProgrammees(base), lireSeancesTerminees(base)])
      .then(([modeles, programmees, terminees]) => {
        if (annule) return
        const types = modeles.filter((s) => s.seanceCategory.toUpperCase() === 'STRENGTH' && !s.isArchived).length
        setComptes({ types, programmees: programmees.length, terminees: terminees.length })
      })
      .catch((e: unknown) => console.error('Lecture des effectifs de séances impossible', e))
    return () => {
      annule = true
    }
  }, [db])
  return comptes
}
