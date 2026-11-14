import { useCallback, useEffect, useState } from 'react'
import { dateIsoLocale } from '../../core/common/dates'
import { getDb } from '../../core/db/client'
import type { DbLecture } from '../../core/db/Db'
import { lirePlage } from '../../core/db/repos/seancesCardio'
import { construirePlan, realisationJusquA, semaineCourante, joursEntre, type Plan, type Realisation } from './plan'
import { chargerReglagesPlans, enregistrerReglagesPlans, retablirReglagesPlans, type ReglagesPlans } from './reglagesPlans'

export interface EtatPlans {
  pret: boolean
  erreur: string
  plan: Plan | null
  /** Indice de la semaine en cours ; -1 avant le plan, nombre de semaines après. */
  courante: number
  realisation: Realisation | null
  prochainJalon: { nom: string; date: string; jours: number } | null
}

const VIDE: EtatPlans = { pret: false, erreur: '', plan: null, courante: -1, realisation: null, prochainJalon: null }

/** Plan d'endurance (frise, phases, réalisation) dérivé des séances de course et de vélo de l'agenda. */
export function usePlans({ db, aujourdhui = dateIsoLocale(new Date()) }: { db?: DbLecture; aujourdhui?: string } = {}) {
  const [reglages, setReglages] = useState<ReglagesPlans>(chargerReglagesPlans)
  const [etat, setEtat] = useState<EtatPlans>(VIDE)

  useEffect(() => {
    let annule = false
    const base = db ?? getDb()
    Promise.all([lirePlage(base, 'course', '0000-01-01', '9999-12-31'), lirePlage(base, 'velo', '0000-01-01', '9999-12-31')])
      .then(([course, velo]) => {
        if (annule) return
        const plan = construirePlan([...course, ...velo], { reductionAffutagePct: reglages.reductionAffutagePct, allegeePct: reglages.allegeePct })
        if (!plan) {
          setEtat({ ...VIDE, pret: true })
          return
        }
        const courante = semaineCourante(plan, aujourdhui)
        const prochain = plan.jalons.find((j) => j.date >= aujourdhui) ?? null
        setEtat({
          pret: true, erreur: '', plan, courante,
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
  }, [db, aujourdhui, reglages.reductionAffutagePct, reglages.allegeePct, reglages.mesure])

  const changer = useCallback((suite: Partial<ReglagesPlans>) => {
    setReglages((r) => {
      const n = { ...r, ...suite }
      enregistrerReglagesPlans(n)
      return n
    })
  }, [])

  const retablir = useCallback(() => setReglages(retablirReglagesPlans()), [])

  return { ...etat, reglages, changer, retablir }
}
