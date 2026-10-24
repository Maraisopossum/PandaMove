import { useCallback, useEffect, useState } from 'react'
import { getDb } from '../../core/db/client'
import type { Db } from '../../core/db/Db'
import { listSeanceTemplates } from '../../core/db/repos/seances'
import type { Seance } from '../../core/db/types'
import { archiverSeance, assignerSeance, ErreurSeance } from './affectation'

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

  return { seances: donnees.seances, nbExercices: donnees.nbExercices, charge, erreur, archiver, assigner }
}
