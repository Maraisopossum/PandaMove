import { useCallback, useEffect, useState } from 'react'
import { getDb } from '../../core/db/client'
import type { Db } from '../../core/db/Db'
import { listSeanceTemplates } from '../../core/db/repos/seances'
import type { Seance } from '../../core/db/types'
import { archiverSeance, assignerSeance, ErreurSeance } from './affectation'
import { compterHistorique, supprimerSeance, type Historique, type ModeSuppression } from './suppression'

export interface DepsListeSeances {
  /** Base à utiliser (défaut : base de l'application, résolue à l'usage). */
  db?: Db
}

interface Chargement {
  seances: Seance[]
  nbExercices: Record<string, number>
}

// Modèles de renforcement visibles : vivants, non archivés, catégorie STRENGTH.
async function lire(db: Db): Promise<Chargement> {
  const tous = await listSeanceTemplates(db)
  const seances = tous.filter((s) => !s.isArchived && s.seanceCategory.toUpperCase() === 'STRENGTH')
  const lignes = await db.getAll<{ seance_id: string; n: number }>(
    `SELECT seance_id, COUNT(*) AS n FROM exercices_seance
     WHERE instance_seance_id IS NULL AND deleted_at IS NULL GROUP BY seance_id`,
  )
  return { seances, nbExercices: Object.fromEntries(lignes.map((l) => [l.seance_id, l.n])) }
}

// Liste des séances. La base n'expose pas d'observation : la liste est relue après chaque écriture
// de ce hook (même principe que useCatalog).
export function useSeanceList({ db }: DepsListeSeances = {}) {
  const [donnees, setDonnees] = useState<Chargement>({ seances: [], nbExercices: {} })
  const [charge, setCharge] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  const recharger = useCallback(async () => {
    setDonnees(await lire(db ?? getDb()))
    setCharge(true)
  }, [db])

  useEffect(() => {
    let annule = false
    lire(db ?? getDb())
      .then((d) => {
        if (annule) return
        setDonnees(d)
        setCharge(true)
      })
      .catch((e: unknown) => {
        console.error('Chargement des séances impossible', e)
        if (!annule) setErreur('Le chargement des séances a échoué.')
      })
    return () => {
      annule = true
    }
  }, [db])

  const archiver = useCallback(
    async (id: string) => {
      setErreur(null)
      try {
        await archiverSeance(db ?? getDb(), id)
        await recharger()
      } catch (e) {
        if (e instanceof ErreurSeance) setErreur(e.message)
        else {
          console.error("Archivage de la séance impossible", e)
          setErreur("L'archivage a échoué.")
        }
      }
    },
    [db, recharger],
  )

  // Rejette avec un message français si la date ou la séance est invalide (affiché par le dialogue).
  const assigner = useCallback(
    async (seanceId: string, dateIso: string) => {
      const id = await assignerSeance(db ?? getDb(), seanceId, dateIso)
      await recharger()
      return id
    },
    [db, recharger],
  )

  // Effectifs de l'historique pour le dialogue de suppression ; null (et message) en cas d'échec.
  const compter = useCallback(
    async (seanceId: string): Promise<Historique | null> => {
      setErreur(null)
      try {
        return await compterHistorique(db ?? getDb(), seanceId)
      } catch (e) {
        console.error("Décompte de l'historique impossible", e)
        setErreur("Le décompte de l'historique a échoué.")
        return null
      }
    },
    [db],
  )

  // Suppression logique (voir suppression.ts). Renvoie true en cas de succès ; sinon le message
  // français est dans `erreur` (jamais de rejet non géré).
  const supprimer = useCallback(
    async (seanceId: string, mode: ModeSuppression): Promise<boolean> => {
      setErreur(null)
      try {
        await supprimerSeance(db ?? getDb(), seanceId, mode)
        await recharger()
        return true
      } catch (e) {
        if (e instanceof ErreurSeance) setErreur(e.message)
        else {
          console.error('Suppression de la séance impossible', e)
          setErreur('La suppression a échoué.')
        }
        return false
      }
    },
    [db, recharger],
  )

  return {
    seances: donnees.seances, nbExercices: donnees.nbExercices, charge, erreur, archiver, assigner,
    compterHistorique: compter, supprimer,
  }
}
