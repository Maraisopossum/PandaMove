import { useCallback, useMemo, useState } from 'react'
import { useAuth } from '../../core/auth/AuthProvider'
import type { Db } from '../../core/db/Db'
import { SEANCES_TYPES, TOUS_TYPES, TOUTES_ZONES, type MomentSeance, type SportId, type TypeExercice, type ZoneCorps } from './donnees'
import { genererSeance, type PlanSeance } from './generer'
import { ajouterRoutine, ecrireRoutines, lireRoutines, nomSuggere, preparerSeance } from './routines'
import { bilanSemaine, ecrireChoix, ecrirePlan, lireChoix, type ChoixMobilite } from './stockage'
import { useHistoriqueMobilite } from './useHistoriqueMobilite'

const MAINTENANT = () => new Date()
const GRAINE_ALEATOIRE = () => Math.floor(Math.random() * 1_000_000)

// Écran de choix : temps disponible, séance type, types d'exercices, zones à cibler et moment. Le choix est retenu par appareil ;
// l'historique (bilan de la semaine, dernières séances) est synchronisé, les routines restent sur l'appareil.
// Le programme annoncé (« Au programme ») est la séance même que « Générer » prépare : la graine est tirée une fois et gardée
// tant que l'écran est ouvert, seuls les réglages la font varier.
export function useChoixMobilite({ maintenant = MAINTENANT, db }: { maintenant?: () => Date; db?: Db } = {}) {
  const { session } = useAuth()
  const [choix, setChoix] = useState<ChoixMobilite>(lireChoix)
  const [graine, setGraine] = useState(GRAINE_ALEATOIRE)
  const [routines, setRoutines] = useState(lireRoutines)
  const historique = useHistoriqueMobilite({ db, userId: session?.user.id })

  const modifier = useCallback((partiel: Partial<ChoixMobilite>) => {
    setChoix((c) => {
      const suite = { ...c, ...partiel }
      ecrireChoix(suite)
      return suite
    })
  }, [])

  // Une séance type pré-remplit zones, moment et types ; retoucher ensuite l'un d'eux la détache du sport
  const choisirSport = useCallback(
    (id: SportId) => {
      if (choix.sport === id) return modifier({ sport: null })
      const s = SEANCES_TYPES.find((x) => x.id === id)
      if (s) modifier({ sport: id, zones: s.zones, moment: s.moment, types: s.types ?? TOUS_TYPES })
    },
    [choix.sport, modifier],
  )
  const basculerZone = useCallback(
    (z: ZoneCorps) => modifier({ sport: null, zones: choix.zones.includes(z) ? choix.zones.filter((x) => x !== z) : TOUTES_ZONES.filter((x) => x === z || choix.zones.includes(x)) }),
    [choix.zones, modifier],
  )
  // Au moins un type reste actif : décocher le dernier est sans effet
  const basculerType = useCallback(
    (t: TypeExercice) => {
      const actif = choix.types.includes(t)
      if (actif && choix.types.length === 1) return
      modifier({ sport: null, types: TOUS_TYPES.filter((x) => (x === t ? !actif : choix.types.includes(x))) })
    },
    [choix.types, modifier],
  )
  const choisirMoment = useCallback((moment: MomentSeance) => modifier({ sport: null, moment }), [modifier])
  const choisirMinutes = useCallback((minutes: number) => modifier({ minutes }), [modifier])
  const toutesLesZones = useCallback(() => modifier({ sport: null, zones: [] }), [modifier])

  // Séance annoncée : mêmes réglages et même graine que « Générer »
  const apercu = useMemo(
    () => genererSeance({ minutes: choix.minutes, zones: choix.zones, moment: choix.moment, types: choix.types, graine }),
    [choix, graine],
  )

  const generer = useCallback((): PlanSeance => {
    ecrirePlan(apercu)
    return apercu
  }, [apercu])

  const enregistrerRoutine = useCallback(
    (nom: string) => {
      setRoutines((liste) => {
        const suite = ajouterRoutine(liste, nom, choix, crypto.randomUUID())
        ecrireRoutines(suite)
        return suite
      })
    },
    [choix],
  )

  // Lance une routine : le choix devient le sien, la séance est préparée et l'aperçu peut s'ouvrir
  const lancerRoutine = useCallback((c: ChoixMobilite): PlanSeance => {
    setChoix(c)
    setGraine(GRAINE_ALEATOIRE())
    return preparerSeance(c)
  }, [])

  return {
    choix, historique, bilan: bilanSemaine(historique, maintenant()), apercu, routines, nomPropose: nomSuggere(choix),
    choisirSport, basculerZone, basculerType, choisirMoment, choisirMinutes, toutesLesZones, generer, enregistrerRoutine, lancerRoutine,
  }
}
