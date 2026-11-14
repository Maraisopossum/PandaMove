import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getDb } from '../../core/db/client'
import type { Db } from '../../core/db/Db'
import { dateIsoLocale } from '../../core/common/dates'
import {
  ErreurRespiration, lireMethodes, lireSeances, lireSeancesDepuis, supprimerMethode, supprimerSeance, type SeanceRespiration, type SeanceRespirationDatee,
} from '../../core/db/repos/respiration'
import { depuisMethodePerso, METHODES_INTEGREES, type Methode } from './methodes'
import { ecrireFavorite, ecrireObjectifQuotidien, lireFavorite, lireObjectifQuotidien } from './reglages'
import { bilanSemaine, methodePreferee, serieDeJours, usage30Jours } from './statsRespiration'

export interface DepsRespiration {
  /** Base à utiliser (défaut : base de l'application, résolue à l'usage). */
  db?: Db
  /** Horloge injectable pour « aujourd'hui ». */
  maintenant?: () => Date
}

export const NB_SEANCES_HISTORIQUE = 15

// Écran de choix : méthodes intégrées puis personnalisées (ordre de création), et les 15 dernières séances. La base
// n'expose pas d'observation : les données sont relues après chaque action. Les actions renvoient true si elles ont
// réussi ; sinon le message français est dans `erreur` (jamais de rejet non géré).
export function useRespiration({ db, maintenant = () => new Date() }: DepsRespiration = {}) {
  const [personnalisees, setPersonnalisees] = useState<Methode[]>([])
  const [seances, setSeances] = useState<SeanceRespiration[]>([])
  // Toutes les séances, avec leur instant d'enregistrement : régularité, usage des méthodes et statistiques
  const [toutes, setToutes] = useState<SeanceRespirationDatee[]>([])
  const [favorite, setFavorite] = useState<string | null>(lireFavorite)
  const [objectif, setObjectif] = useState(lireObjectifQuotidien)
  const [charge, setCharge] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const sequence = useRef(0)

  const lire = useCallback(async () => {
    const numero = ++sequence.current
    const base = db ?? getDb()
    const [methodes, historique, toutesLesSeances] = await Promise.all([lireMethodes(base), lireSeances(base, NB_SEANCES_HISTORIQUE), lireSeancesDepuis(base, '0000-01-01')])
    if (numero !== sequence.current) return
    setPersonnalisees(methodes.map(depuisMethodePerso))
    setSeances(historique)
    setToutes(toutesLesSeances)
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

  const methodesBrutes = useMemo(() => [...METHODES_INTEGREES, ...personnalisees], [personnalisees])
  // La méthode favorite passe en premier (si elle existe encore) ; le reste garde l'ordre habituel
  const methodes = useMemo(() => {
    const f = methodesBrutes.find((m) => m.id === favorite)
    return f ? [f, ...methodesBrutes.filter((m) => m !== f)] : methodesBrutes
  }, [methodesBrutes, favorite])

  const aujourdhui = dateIsoLocale(maintenant())
  const regularite = useMemo(
    () => ({ semaine: bilanSemaine(toutes, aujourdhui, objectif), serie: serieDeJours(toutes, aujourdhui) }),
    [toutes, aujourdhui, objectif],
  )
  const usage = useMemo(() => usage30Jours(toutes, aujourdhui), [toutes, aujourdhui])
  const preferee = useMemo(() => methodePreferee(toutes, aujourdhui), [toutes, aujourdhui])
  const definirFavorite = useCallback((id: string | null) => {
    ecrireFavorite(id)
    setFavorite(id)
  }, [])
  const definirObjectif = useCallback((minutes: number) => {
    if (ecrireObjectifQuotidien(minutes)) setObjectif(minutes)
  }, [])

  return {
    methodes,
    seances,
    toutes,
    favorite, definirFavorite, objectif, definirObjectif, regularite, usage, preferee,
    charge,
    erreur,
    supprimerMethode: (id: string) => agir((base) => supprimerMethode(base, id), 'La suppression de la méthode a échoué.'),
    supprimerSeance: (id: string) => agir((base) => supprimerSeance(base, id), 'La suppression de la séance a échoué.'),
  }
}
