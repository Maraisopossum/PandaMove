import { useEffect, useMemo, useState } from 'react'
import { getDb } from '../../core/db/client'
import {
  creerCourseHyrox, definirReference, enregistrerCourseOfficielle, lireHistoriqueStation, modifierCourseHyrox, modifierNotesSimulation, supprimerCourseHyrox, supprimerSimulation,
  type CourseOfficielle, type PassageStation, type SaisieCourseHyrox,
} from '../../core/db/repos/hyrox'
import { apercuAgendaHyrox, appliquerPlanAgenda, retirerPlanAgenda, type ApercuAgendaHyrox } from './agendaHyrox'
import type { SemaineHyrox } from './planHyrox'

// Accès à la base des écrans Hyrox : les composants n'appellent ni `getDb()` ni les dépôts, ils passent par ces fonctions (règle
// « écran = composant + hook », CLAUDE.md ; vérifiée par architectureEcrans.test.ts). Chaque fonction ne fait que relayer un dépôt.

/** Écritures de l'objectif, des simulations et de l'agenda du plan. */
export function useEcrituresHyrox() {
  return useMemo(
    () => ({
      creerObjectif: (saisie: SaisieCourseHyrox) => creerCourseHyrox(getDb(), saisie),
      modifierObjectif: (id: string, saisie: SaisieCourseHyrox) => modifierCourseHyrox(getDb(), id, saisie),
      supprimerObjectif: (id: string) => supprimerCourseHyrox(getDb(), id),
      enregistrerCourseOfficielle: (course: CourseOfficielle) => enregistrerCourseOfficielle(getDb(), course),
      modifierNotes: (simulationId: string, notes: string) => modifierNotesSimulation(getDb(), simulationId, notes),
      definirReference: (simulationId: string, reference: boolean) => definirReference(getDb(), simulationId, reference),
      supprimerSimulation: (simulationId: string) => supprimerSimulation(getDb(), simulationId),
      appliquerPlanAgenda: (plan: readonly SemaineHyrox[], aujourdhui: string) => appliquerPlanAgenda(getDb(), plan, aujourdhui),
      retirerPlanAgenda: (aujourdhui: string) => retirerPlanAgenda(getDb(), aujourdhui),
    }),
    [],
  )
}

/** Temps des derniers passages sur une station (vide tant que la clé n'est pas valide). */
export function useHistoriqueStation(cle: string, valide: boolean): PassageStation[] {
  const [passages, setPassages] = useState<PassageStation[]>([])
  useEffect(() => {
    if (!valide) return
    let annule = false
    lireHistoriqueStation(getDb(), cle).then((p) => !annule && setPassages(p)).catch(() => {})
    return () => {
      annule = true
    }
  }, [cle, valide])
  return passages
}

/** Aperçu de ce que le plan ajouterait à l'agenda ; `version` force une relecture après une application ou un retrait. */
export function useApercuAgendaHyrox(plan: readonly SemaineHyrox[], aujourdhui: string, version: number): ApercuAgendaHyrox | null {
  const [apercu, setApercu] = useState<ApercuAgendaHyrox | null>(null)
  useEffect(() => {
    let annule = false
    apercuAgendaHyrox(getDb(), plan, aujourdhui).then((a) => !annule && setApercu(a)).catch(() => !annule && setApercu(null))
    return () => {
      annule = true
    }
  }, [plan, aujourdhui, version])
  return apercu
}
