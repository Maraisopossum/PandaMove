import { useCallback, useEffect, useState } from 'react'
import { getDb } from '../../core/db/client'
import type { Db } from '../../core/db/Db'
import {
  ajouterEau, copierRepas, lireJour, lireObjectifsNutrition, restaurerEntree, supprimerEntree, type EntreeJournal, type ObjectifNutrition,
} from '../../core/db/repos/nutrition'
import { REPAS, sommer, type Apport, type Repas } from '../../core/nutrition/calculs'
import { decalerJour } from './outils'

export interface EtatJournal {
  pret: boolean
  erreur: string
  entrees: EntreeJournal[]
  objectifs: ObjectifNutrition | null
  /** Repas de la veille qui ont au moins une entrée (pour proposer « Copier d'hier »). */
  repasHier: Repas[]
}

const VIDE: EtatJournal = { pret: false, erreur: '', entrees: [], objectifs: null, repasHier: [] }

export const entreesDuRepas = (entrees: readonly EntreeJournal[], repas: Repas) => entrees.filter((e) => e.repas === repas)
export const apportDuRepas = (entrees: readonly EntreeJournal[], repas: Repas): Apport => sommer(entreesDuRepas(entrees, repas).map((e) => e.apport))
export const apportDuJour = (entrees: readonly EntreeJournal[]): Apport => sommer(entrees.filter((e) => e.repas !== 'eau').map((e) => e.apport))
export const eauDuJour = (entrees: readonly EntreeJournal[]) => entrees.filter((e) => e.repas === 'eau').reduce((t, e) => t + e.quantiteG, 0)

/** Journal d'un jour : entrées, objectifs, et actions rapides (eau, copie du repas d'hier, suppression). Relit après chaque action. */
export function useJournalNutrition(date: string, { db }: { db?: Db } = {}) {
  const [etat, setEtat] = useState<EtatJournal>(VIDE)
  const [version, setVersion] = useState(0)
  const recharger = useCallback(() => setVersion((v) => v + 1), [])

  useEffect(() => {
    let annule = false
    const base = db ?? getDb()
    Promise.all([lireJour(base, date), lireJour(base, decalerJour(date, -1)), lireObjectifsNutrition(base)])
      .then(([entrees, hier, objectifs]) => {
        if (annule) return
        setEtat({ pret: true, erreur: '', entrees, objectifs, repasHier: REPAS.filter((r) => hier.some((e) => e.repas === r)) })
      })
      .catch(() => {
        if (!annule) setEtat((e) => ({ ...e, pret: true, erreur: 'Le journal n’a pas pu être lu.' }))
      })
    return () => {
      annule = true
    }
  }, [date, db, version])

  const executer = useCallback(
    async (action: (base: Db) => Promise<unknown>, echec: string) => {
      try {
        await action(db ?? getDb())
        recharger()
      } catch {
        setEtat((e) => ({ ...e, erreur: echec }))
      }
    },
    [db, recharger],
  )

  return {
    ...etat,
    recharger,
    ajouterEau: (ml: number) => executer((b) => ajouterEau(b, date, ml), 'L’eau n’a pas pu être ajoutée.'),
    /** Ajoute de l'eau et rend l'identifiant de la ligne créée (pour l'annuler à coup sûr), ou null si l'ajout a échoué. */
    ajouterEauAnnulable: async (ml: number): Promise<string | null> => {
      try {
        const id = await ajouterEau(db ?? getDb(), date, ml)
        recharger()
        return id
      } catch {
        setEtat((e) => ({ ...e, erreur: 'L’eau n’a pas pu être ajoutée.' }))
        return null
      }
    },
    annulerDerniereEau: () => {
      const derniere = [...etat.entrees].reverse().find((e) => e.repas === 'eau')
      return derniere ? executer((b) => supprimerEntree(b, derniere.id), 'L’ajout n’a pas pu être annulé.') : Promise.resolve()
    },
    copierDepuisHier: (repas: Repas) => executer((b) => copierRepas(b, decalerJour(date, -1), repas, date), 'Le repas n’a pas pu être copié.'),
    supprimer: (id: string) => executer((b) => supprimerEntree(b, id), 'La ligne n’a pas pu être supprimée.'),
    /** Annule une suppression : la ligne revient dans le journal. */
    restaurer: (id: string) => executer((b) => restaurerEntree(b, id), 'La ligne n’a pas pu être rétablie.'),
  }
}
