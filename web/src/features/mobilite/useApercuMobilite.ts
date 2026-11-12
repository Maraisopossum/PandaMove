import { useCallback, useState } from 'react'
import { dureeTotale, genererSeance, remplacerEtape, type PlanSeance } from './generer'
import { ecrirePlan, lirePlan } from './stockage'

// Aperçu de la séance préparée : la liste des exercices, un autre tirage, le remplacement d'un exercice, le retrait d'un
// exercice. Le plan modifié est gardé pour la séance. Sans plan préparé (lien ouvert directement), `plan` est null.
export function useApercuMobilite() {
  const [plan, setPlanBrut] = useState<PlanSeance | null>(lirePlan)

  const appliquer = useCallback((suite: PlanSeance) => {
    ecrirePlan(suite)
    setPlanBrut(suite)
  }, [])

  const autreTirage = useCallback(() => {
    if (plan) appliquer(genererSeance({ minutes: plan.minutes, zones: plan.zones, moment: plan.moment, graine: plan.graine + 1 + Math.floor(Math.random() * 1000) }))
  }, [plan, appliquer])

  const remplacer = useCallback((index: number) => plan && appliquer(remplacerEtape(plan, index)), [plan, appliquer])

  const retirer = useCallback(
    (index: number) => {
      if (!plan || plan.etapes.length <= 1) return
      const etapes = plan.etapes.filter((_, i) => i !== index)
      appliquer({ ...plan, etapes, dureeTotaleS: dureeTotale(etapes) })
    },
    [plan, appliquer],
  )

  return { plan, autreTirage, remplacer, retirer }
}
