import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getDb } from '../../core/db/client'
import type { Db } from '../../core/db/Db'
import { ErreurRespiration, lireMethodes, lireSeances, supprimerMethode, supprimerSeance, type SeanceRespiration } from '../../core/db/repos/respiration'
import { depuisMethodePerso, METHODES_INTEGREES, type Methode } from './methodes'

export interface DepsRespiration {
  /** Base à utiliser (défaut : base de l'application, résolue à l'usage). */
  db?: Db
}

export const NB_SEANCES_HISTORIQUE = 15

// Écran de choix : méthodes intégrées puis personnalisées (ordre de création), et les 15 dernières séances. La base
// n'expose pas d'observation : les données sont relues après chaque action. Les actions renvoient true si elles ont
// réussi ; sinon le message français est dans `erreur` (jamais de rejet non géré).
export function useRespiration({ db }: DepsRespiration = {}) {
  const [personnalisees, setPersonnalisees] = useState<Methode[]>([])
  const [seances, setSeances] = useState<SeanceRespiration[]>([])
  const [charge, setCharge] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const sequence = useRef(0)

  const lire = useCallback(async () => {
    const numero = ++sequence.current
    const base = db ?? getDb()
    const [methodes, historique] = await Promise.all([lireMethodes(base), lireSeances(base, NB_SEANCES_HISTORIQUE)])
    if (numero !== sequence.current) return
    setPersonnalisees(methodes.map(depuisMethodePerso))
    setSeances(historique)
  }, [db])

  useEffect(() => {
    let annule = false
    lire()
      .catch((e: unknown) => {
        console.error('Chargement de la respiration impossible', e)
        if (!annule) setErreur('Le chargement de la respiration a échoué.')
      })
      .finally(() => {
        if (!annule) setCharge(true)
      })
    return () => {
      annule = true
    }
  }, [lire])

  const agir = useCallback(
    async (ecrire: (base: Db) => Promise<unknown>, echec: string): Promise<boolean> => {
      setErreur(null)
      try {
        await ecrire(db ?? getDb())
        await lire()
        return true
      } catch (e) {
        if (e instanceof ErreurRespiration) setErreur(e.message)
        else {
          console.error(echec, e)
          setErreur(echec)
        }
        return false
      }
    },
    [db, lire],
  )

  const methodes = useMemo(() => [...METHODES_INTEGREES, ...personnalisees], [personnalisees])

  return {
    methodes,
    seances,
    charge,
    erreur,
    supprimerMethode: (id: string) => agir((base) => supprimerMethode(base, id), 'La suppression de la méthode a échoué.'),
    supprimerSeance: (id: string) => agir((base) => supprimerSeance(base, id), 'La suppression de la séance a échoué.'),
  }
}
