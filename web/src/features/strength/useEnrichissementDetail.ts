import { useEffect, useMemo, useState } from 'react'
import { getDb } from '../../core/db/client'
import type { DbLecture } from '../../core/db/Db'
import type { ZoneCorps } from '../mobilite/donnees'
import { historiqueExercice, type PointHistorique } from '../stats/statsQueries'
import type { DetailSeance, ExerciceDetail } from './detailSeance'
import { infoExercice, type InfoExercice } from './infoExercice'
import { lireGroupesDeSeance, zonesEchauffement } from './suggestionsRenfo'

function exercicesDe(d: DetailSeance): ExerciceDetail[] {
  return d.entrees.flatMap((e) => (e.kind === 'libre' ? [e.exercice] : e.bloc.exercices))
}

// Compléments du détail d'une séance type : dernière performance et indication de cible de chaque exercice, zones d'échauffement
// d'après les muscles travaillés. Lecture seule ; une lecture qui échoue masque ces aides sans gêner l'écran.
export function useEnrichissementDetail(detail: DetailSeance | null, { db }: { db?: DbLecture } = {}) {
  const [historiques, setHistoriques] = useState<Map<string, PointHistorique[]> | null>(null)
  const [zones, setZones] = useState<ZoneCorps[]>([])
  const cle = detail ? `${detail.id}|${exercicesDe(detail).map((e) => e.exerciseId).join(',')}` : ''

  useEffect(() => {
    if (!detail) return
    let annule = false
    const base = db ?? getDb()
    const ids = [...new Set(exercicesDe(detail).map((e) => e.exerciseId))]
    Promise.all([Promise.all(ids.map(async (id) => [id, await historiqueExercice(base, id)] as const)), lireGroupesDeSeance(base, detail.id)])
      .then(([paires, groupes]) => {
        if (annule) return
        setHistoriques(new Map(paires))
        setZones(zonesEchauffement(groupes))
      })
      .catch((e: unknown) => console.error('Compléments du détail de séance impossibles', e))
    return () => {
      annule = true
    }
    // La clé résume la composition : le détail est relu après chaque écriture, sans changer ce que ces aides lisent
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cle, db])

  const infos = useMemo(() => {
    const m = new Map<string, InfoExercice>()
    if (!detail || !historiques) return m
    for (const e of exercicesDe(detail)) m.set(e.id, infoExercice(historiques.get(e.exerciseId) ?? [], e.chargeKg, e.reps))
    return m
  }, [detail, historiques])

  return { infos, zones }
}
