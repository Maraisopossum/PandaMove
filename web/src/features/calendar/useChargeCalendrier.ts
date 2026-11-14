import { useCallback, useEffect, useMemo, useState } from 'react'
import { getDb } from '../../core/db/client'
import type { DbLecture } from '../../core/db/Db'
import { lireEvenementsPlage } from './calendrier'
import { chargeSemaine, type ChargeSemaine } from './chargeCalendrier'
import { ajouterJours } from './grille'
import type { EvenementAgenda } from './types'

const SEMAINES_HISTORIQUE = 5

// Charge estimée des semaines affichées : lit en plus les cinq semaines qui précèdent la grille (pour la moyenne de chaque semaine)
// et la durée estimée des modèles de renforcement concernés. Lecture seule ; une lecture qui échoue laisse la durée par défaut.
// `evenements` : tous les événements de la grille, filtre de statut non appliqué. Calculs dans chargeCalendrier.ts.
export function useChargeCalendrier(evenements: readonly EvenementAgenda[], debutGrille: string, { db }: { db?: DbLecture } = {}) {
  const [historique, setHistorique] = useState<EvenementAgenda[]>([])
  const [durees, setDurees] = useState<Map<string, number>>(new Map())

  // Modèles à interroger : ceux des événements de la grille et de l'historique
  const idsSeances = useMemo(() => [...new Set([...evenements, ...historique].flatMap((e) => (e.genre === 'renfo' ? [e.instance.seanceId] : [])))].sort(), [evenements, historique])
  const cleIds = idsSeances.join(',')

  useEffect(() => {
    let annule = false
    lireEvenementsPlage(db ?? getDb(), ajouterJours(debutGrille, -7 * SEMAINES_HISTORIQUE), ajouterJours(debutGrille, -1))
      .then((h) => !annule && setHistorique(h))
      .catch((e: unknown) => console.error('Historique de charge du calendrier impossible', e))
    return () => {
      annule = true
    }
  }, [db, debutGrille])

  useEffect(() => {
    if (idsSeances.length === 0) return
    let annule = false
    ;(db ?? getDb())
      .getAll<{ id: string; duree_estimee_min: number | null }>(`SELECT id, duree_estimee_min FROM seances WHERE id IN (${idsSeances.map(() => '?').join(', ')})`, idsSeances)
      .then((lignes) => {
        if (!annule) setDurees(new Map(lignes.flatMap((l) => (l.duree_estimee_min ? [[l.id, l.duree_estimee_min] as const] : []))))
      })
      .catch((e: unknown) => console.error('Durées estimées des séances impossibles', e))
    return () => {
      annule = true
    }
    // La clé résume la liste des modèles
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, cleIds])

  const tous = useMemo(() => {
    const vus = new Set<string>()
    return [...historique, ...evenements].filter((e) => !vus.has(e.id) && vus.add(e.id))
  }, [historique, evenements])

  return useCallback((lundi: string): ChargeSemaine => chargeSemaine(lundi, tous, durees), [tous, durees])
}
