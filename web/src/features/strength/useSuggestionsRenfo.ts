import { useCallback, useEffect, useMemo, useState } from 'react'
import { dateIsoLocale } from '../../core/common/dates'
import { getDb } from '../../core/db/client'
import type { DbLecture } from '../../core/db/Db'
import type { MuscleGroup } from '../../core/db/types'
import { ajouterJours } from '../endurance/calculCharge'
import { resumesInstancesTerminees, tonnageBlocs7Jours, volumeParMuscle } from '../stats/statsQueries'
import {
  alerteCharge, lireGroupesParSeance, resumesParSeance, suggererSeances, type AlerteCharge, type ResumeSeanceType, type SuggestionSeance,
} from './suggestionsRenfo'

const MAINTENANT = () => new Date()
/** Fenêtre d'équilibre musculaire de la séance suggérée, en jours (aujourd'hui compris). */
export const JOURS_EQUILIBRE = 14
/** Recul de lecture des séances jouées pour « dernière fois » et tendance. */
const JOURS_RESUMES = 120

// Données de l'écran Renforcement qui aident à choisir : séance suggérée (et « autre idée »), alerte de charge, dernière fois et
// tendance de chaque séance type. Lecture seule, relue à l'ouverture ; une lecture qui échoue masque simplement ces aides.
export function useSuggestionsRenfo({ db, maintenant = MAINTENANT }: { db?: DbLecture; maintenant?: () => Date } = {}) {
  const [donnees, setDonnees] = useState<{
    volume: Record<MuscleGroup, number>
    groupes: Map<string, MuscleGroup[]>
    alerte: AlerteCharge | null
    resumes: Map<string, ResumeSeanceType>
  } | null>(null)
  const [rang, setRang] = useState(0)
  // Jour lu une fois à l'ouverture : l'écran ne bouge pas à minuit
  const [aujourdhui] = useState(() => dateIsoLocale(maintenant()))

  useEffect(() => {
    let annule = false
    const base = db ?? getDb()
    Promise.all([
      volumeParMuscle(base, ajouterJours(aujourdhui, -(JOURS_EQUILIBRE - 1)), aujourdhui),
      lireGroupesParSeance(base),
      tonnageBlocs7Jours(base, aujourdhui, 5),
      resumesInstancesTerminees(base, ajouterJours(aujourdhui, -JOURS_RESUMES), aujourdhui),
    ])
      .then(([volume, groupes, blocs, instances]) => {
        if (!annule) setDonnees({ volume, groupes, alerte: alerteCharge(blocs), resumes: resumesParSeance(instances) })
      })
      .catch((e: unknown) => console.error('Suggestions du renforcement impossibles', e))
    return () => {
      annule = true
    }
  }, [db, aujourdhui])

  const classees = useMemo<SuggestionSeance[]>(() => (donnees ? suggererSeances(donnees.volume, donnees.groupes) : []), [donnees])
  const suggestion = classees.length > 0 ? classees[rang % classees.length] : null
  // « Autre idée » : la suivante du classement, en boucle
  const autreIdee = useCallback(() => setRang((r) => r + 1), [])

  return {
    aujourdhui,
    suggestion,
    nombreSuggestions: classees.length,
    autreIdee,
    alerte: donnees?.alerte ?? null,
    resumes: donnees?.resumes ?? new Map<string, ResumeSeanceType>(),
  }
}
