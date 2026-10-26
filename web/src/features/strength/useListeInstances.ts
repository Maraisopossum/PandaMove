import { useCallback, useEffect, useRef, useState } from 'react'
import { getDb } from '../../core/db/client'
import type { Db } from '../../core/db/Db'
import type { InstanceVue } from '../calendar/types'
import { lireSeancesProgrammees, lireSeancesTerminees } from './listesInstances'

export type TypeListeInstances = 'programmees' | 'terminees'

export interface DepsListeInstances {
  /** Base à utiliser (défaut : base de l'application, résolue à l'usage). */
  db?: Db
}

const LECTURES = { programmees: lireSeancesProgrammees, terminees: lireSeancesTerminees } as const

interface Resultat {
  // Type de liste auquel correspondent ces données (« chargement » tant qu'il diffère du type demandé)
  type: TypeListeInstances
  instances: InstanceVue[]
  erreur: string | null
}

// Séances programmées ou terminées. En cas d'échec : message français et liste vide, `chargement` faux
// (l'écran affiche l'alerte, jamais un faux état vide). `recharger` efface l'erreur puis relit.
export function useListeInstances(type: TypeListeInstances, { db }: DepsListeInstances = {}) {
  const [resultat, setResultat] = useState<Resultat | null>(null)
  const [rechargement, setRechargement] = useState(false)
  // Seule la dernière lecture lancée est appliquée (changement de type, rechargement)
  const sequence = useRef(0)

  const lire = useCallback(async (): Promise<Resultat> => {
    try {
      return { type, instances: await LECTURES[type](db ?? getDb()), erreur: null }
    } catch (e) {
      console.error('Chargement des séances impossible', e)
      return { type, instances: [], erreur: 'Le chargement des séances a échoué.' }
    }
  }, [db, type])

  useEffect(() => {
    const numero = ++sequence.current
    void lire().then((r) => {
      if (numero !== sequence.current) return
      setResultat(r)
      setRechargement(false)
    })
  }, [lire])

  const recharger = useCallback(async () => {
    const numero = ++sequence.current
    setRechargement(true)
    setResultat((r) => (r ? { ...r, erreur: null } : r))
    const r = await lire()
    if (numero === sequence.current) {
      setResultat(r)
      setRechargement(false)
    }
  }, [lire])

  const aJour = resultat !== null && resultat.type === type
  return {
    instances: aJour ? resultat.instances : [],
    chargement: !aJour || rechargement,
    erreur: aJour ? resultat.erreur : null,
    recharger,
  }
}
