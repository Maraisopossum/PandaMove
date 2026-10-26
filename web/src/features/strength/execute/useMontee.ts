import { useCallback, useState } from 'react'
import type { EquipmentStocke } from '../../../core/import/equipment'
import { chargesAtteignablesExercice, parseChargeKg } from '../progression/cible'
import { calculerPaliers, marquerFait, protocoleDefaut, tempsRepos, type Palier, type Protocole } from './montee'
import type { ExerciceVue } from './vue'

export interface EtatMontee {
  protocole: Protocole
  paliers: Palier[]
  /** Fin du chrono de repos entre paliers (ms, horodatage), null sans chrono */
  finReposMs: number | null
}

// Paliers d'échauffement par exercice, gardés tant que l'écran est ouvert (éphémères comme sur Android : openWarmupSheet,
// changeWarmupProtocole, markWarmupPalierDone). Le chrono de repos inter-paliers est une fin absolue.
export function useMontee(materiel: EquipmentStocke, nowFn: () => number = Date.now) {
  const [etats, setEtats] = useState<Record<string, EtatMontee>>({})

  const calculer = useCallback(
    (e: ExerciceVue, protocole: Protocole): Palier[] => {
      const charge = parseChargeKg(e.chargeCible) ?? 0
      const charges = chargesAtteignablesExercice(e.equipement, materiel) ?? []
      return calculerPaliers(charge, protocole, charges)
    },
    [materiel],
  )

  // Ouverture : crée les paliers du protocole conseillé pour le type d'exercice (standard par défaut) s'il n'existent pas encore
  const ouvrir = useCallback(
    (e: ExerciceVue) =>
      setEtats((s) => {
        if (s[e.id]) return s
        const protocole = protocoleDefaut(e.ligne.typeExercice) ?? 'STANDARD'
        return { ...s, [e.id]: { protocole, paliers: calculer(e, protocole), finReposMs: null } }
      }),
    [calculer],
  )

  const changerProtocole = useCallback(
    (e: ExerciceVue, protocole: Protocole) =>
      setEtats((s) => ({ ...s, [e.id]: { protocole, paliers: calculer(e, protocole), finReposMs: null } })),
    [calculer],
  )

  // Coche un palier (dans l'ordre) et lance son repos
  const cocher = useCallback(
    (e: ExerciceVue, index: number) =>
      setEtats((s) => {
        const etat = s[e.id]
        if (!etat) return s
        const paliers = marquerFait(etat.paliers, index)
        if (paliers === etat.paliers) return s
        const repos = tempsRepos(paliers, index)
        return { ...s, [e.id]: { ...etat, paliers, finReposMs: repos > 0 ? nowFn() + repos * 1000 : null } }
      }),
    [nowFn],
  )

  return { etats, ouvrir, changerProtocole, cocher }
}
