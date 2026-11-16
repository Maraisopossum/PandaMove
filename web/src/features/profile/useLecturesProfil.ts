import { useEffect, useState } from 'react'
import { getDb } from '../../core/db/client'
import type { DbLecture } from '../../core/db/Db'
import { lireMethodes } from '../../core/db/repos/respiration'
import { lireFavorite } from '../respiration/reglages'
import { lireExerciceDefaut } from '../stats/exerciceDefaut'
import { lireProgressionObjectifs, type ProgressionObjectif } from './objectifs'
import type { NomsReglages } from './reglagesAppareil'

// Lectures en base des sections du Profil (les composants n'appellent ni `getDb()` ni les dépôts : architectureEcrans.test.ts).
// `db` permet aux tests d'injecter une base ; `version` force une relecture après un enregistrement.

/** Avancement des objectifs personnels ; null tant que la lecture n'est pas terminée, liste vide si elle échoue. */
export function useProgressionObjectifs(db: DbLecture | undefined, maintenant: () => Date, version: number): ProgressionObjectif[] | null {
  const [progression, setProgression] = useState<ProgressionObjectif[] | null>(null)
  useEffect(() => {
    let annule = false
    lireProgressionObjectifs(db ?? getDb(), maintenant())
      .then((p) => !annule && setProgression(p))
      .catch((e: unknown) => {
        console.error('Progression des objectifs impossible', e)
        if (!annule) setProgression([])
      })
    return () => {
      annule = true
    }
    // « Maintenant » est lu au chargement et après chaque enregistrement
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, version])
  return progression
}

/** Noms de l'exercice et de la méthode de respiration favoris ; un réglage qui pointe vers quelque chose de supprimé reste absent. */
export function useNomsReglages(db: DbLecture | undefined, version: number): NomsReglages {
  const [noms, setNoms] = useState<NomsReglages>({ exercice: null, methode: null })
  useEffect(() => {
    let annule = false
    const base = db ?? getDb()
    const exerciceId = lireExerciceDefaut()
    const favorite = lireFavorite()
    Promise.all([
      exerciceId ? base.getOptional<{ name: string }>('SELECT name FROM exercises WHERE id = ? AND deleted_at IS NULL', [exerciceId]) : Promise.resolve(null),
      favorite ? lireMethodes(base) : Promise.resolve([]),
    ])
      .then(([exercice, methodes]) => {
        if (!annule) setNoms({ exercice: exercice?.name ?? null, methode: methodes.find((m) => m.id === favorite)?.nom ?? null })
      })
      .catch((e: unknown) => console.error('Noms des réglages impossibles', e))
    return () => {
      annule = true
    }
  }, [db, version])
  return noms
}
