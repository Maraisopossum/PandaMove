import { useCallback, useState } from 'react'
import { SEANCES_TYPES, TOUTES_ZONES, type MomentSeance, type SportId, type ZoneCorps } from './donnees'
import { genererSeance, type PlanSeance } from './generer'
import { bilanSemaine, ecrireChoix, ecrirePlan, lireChoix, lireHistorique, type ChoixMobilite } from './stockage'

const MAINTENANT = () => new Date()

// Écran de choix : temps disponible, séance type (sport), zones à cibler et moment. Le choix est retenu par appareil.
// « Générer » prépare une séance, la garde pour l'aperçu et rend le plan.
export function useChoixMobilite({ maintenant = MAINTENANT }: { maintenant?: () => Date } = {}) {
  const [choix, setChoix] = useState<ChoixMobilite>(lireChoix)
  const [historique] = useState(lireHistorique)

  const modifier = useCallback((partiel: Partial<ChoixMobilite>) => {
    setChoix((c) => {
      const suite = { ...c, ...partiel }
      ecrireChoix(suite)
      return suite
    })
  }, [])

  // Une séance type pré-remplit zones et moment ; retoucher ensuite les zones ou le moment la détache du sport
  const choisirSport = useCallback(
    (id: SportId) => {
      if (choix.sport === id) return modifier({ sport: null })
      const s = SEANCES_TYPES.find((x) => x.id === id)
      if (s) modifier({ sport: id, zones: s.zones, moment: s.moment })
    },
    [choix.sport, modifier],
  )
  const basculerZone = useCallback(
    (z: ZoneCorps) => modifier({ sport: null, zones: choix.zones.includes(z) ? choix.zones.filter((x) => x !== z) : TOUTES_ZONES.filter((x) => x === z || choix.zones.includes(x)) }),
    [choix.zones, modifier],
  )
  const choisirMoment = useCallback((moment: MomentSeance) => modifier({ sport: null, moment }), [modifier])
  const choisirMinutes = useCallback((minutes: number) => modifier({ minutes }), [modifier])
  const toutesLesZones = useCallback(() => modifier({ sport: null, zones: [] }), [modifier])

  const generer = useCallback((): PlanSeance => {
    const plan = genererSeance({ minutes: choix.minutes, zones: choix.zones, moment: choix.moment, graine: Math.floor(Math.random() * 1_000_000) })
    ecrirePlan(plan)
    return plan
  }, [choix])

  return { choix, historique, bilan: bilanSemaine(historique, maintenant()), choisirSport, basculerZone, choisirMoment, choisirMinutes, toutesLesZones, generer }
}
