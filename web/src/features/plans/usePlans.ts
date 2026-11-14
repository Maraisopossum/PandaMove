import { useCallback, useEffect, useState } from 'react'
import { dateIsoLocale } from '../../core/common/dates'
import { getDb } from '../../core/db/client'
import type { Db, DbLecture } from '../../core/db/Db'
import { definirValidation, lirePlage, type GenreCardio } from '../../core/db/repos/seancesCardio'
import { lierSeance, lireSorties, type Sortie } from '../../core/db/repos/sorties'
import { construirePlan, joursEntre, realisationJusquA, semaineCourante, type Plan, type Realisation } from './plan'
import { chargerReglagesPlans, enregistrerReglagesPlans, retablirReglagesPlans, type ReglagesPlans } from './reglagesPlans'

export interface EtatPlans {
  pret: boolean
  erreur: string
  plan: Plan | null
  sorties: Sortie[]
  /** Indice de la semaine en cours ; -1 avant le plan, nombre de semaines après. */
  courante: number
  realisation: Realisation | null
  prochainJalon: { nom: string; date: string; jours: number } | null
}

const VIDE: EtatPlans = { pret: false, erreur: '', plan: null, sorties: [], courante: -1, realisation: null, prochainJalon: null }

/** Plan d'endurance (frise, phases, réalisation) dérivé des séances de course et de vélo de l'agenda et des sorties réalisées. */
export function usePlans({ db, aujourdhui = dateIsoLocale(new Date()) }: { db?: Db; aujourdhui?: string } = {}) {
  const [reglages, setReglages] = useState<ReglagesPlans>(chargerReglagesPlans)
  const [etat, setEtat] = useState<EtatPlans>(VIDE)
  const [version, setVersion] = useState(0)
  const [erreurAction, setErreurAction] = useState('')

  useEffect(() => {
    let annule = false
    const base: DbLecture = db ?? getDb()
    Promise.all([lirePlage(base, 'course', '0000-01-01', '9999-12-31'), lirePlage(base, 'velo', '0000-01-01', '9999-12-31'), lireSorties(base)])
      .then(([course, velo, sorties]) => {
        if (annule) return
        const plan = construirePlan([...course, ...velo], sorties, {
          parametres: { reductionAffutagePct: reglages.reductionAffutagePct, allegeePct: reglages.allegeePct },
          dureeMinPct: reglages.dureeMinPct, autrementPct: reglages.autrementPct, aujourdhui,
        })
        if (!plan) {
          setEtat({ ...VIDE, pret: true })
          return
        }
        const courante = semaineCourante(plan, aujourdhui)
        const prochain = plan.jalons.find((j) => j.date >= aujourdhui) ?? null
        setEtat({
          pret: true, erreur: '', plan, sorties, courante,
          realisation: courante >= 0 ? realisationJusquA(plan, courante, reglages.mesure) : null,
          prochainJalon: prochain ? { nom: prochain.nom, date: prochain.date, jours: joursEntre(aujourdhui, prochain.date) } : null,
        })
      })
      .catch(() => {
        if (!annule) setEtat({ ...VIDE, pret: true, erreur: 'Impossible de lire le plan pour le moment.' })
      })
    return () => {
      annule = true
    }
  }, [db, aujourdhui, version, reglages.reductionAffutagePct, reglages.allegeePct, reglages.mesure, reglages.dureeMinPct, reglages.autrementPct])

  const changer = useCallback((suite: Partial<ReglagesPlans>) => {
    setReglages((r) => {
      const n = { ...r, ...suite }
      enregistrerReglagesPlans(n)
      return n
    })
  }, [])

  const retablir = useCallback(() => setReglages(retablirReglagesPlans()), [])

  // Rattache une sortie à une séance prévue du même sport et valide la séance, comme l'import de fichier.
  const rattacher = useCallback(
    async (sortieId: string, seanceId: string, genre: GenreCardio) => {
      setErreurAction('')
      try {
        const base = db ?? getDb()
        await lierSeance(base, sortieId, seanceId)
        await definirValidation(base, genre, seanceId, true)
        setVersion((v) => v + 1)
      } catch (e) {
        console.error('Rattachement de la sortie impossible', e)
        setErreurAction('Le rattachement de la sortie à la séance a échoué.')
      }
    },
    [db],
  )

  return { ...etat, reglages, changer, retablir, rattacher, erreurAction }
}
