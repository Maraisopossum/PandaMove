import { useCallback, useEffect, useState } from 'react'
import { getDb } from '../../core/db/client'
import type { Db } from '../../core/db/Db'
import { listSeanceTemplates } from '../../core/db/repos/seances'
import type { Seance } from '../../core/db/types'
import { archiverSeance, assignerSeance, desarchiverSeance, ErreurSeance, lancerSeanceMaintenant } from './affectation'
import { dupliquerSeance } from './duplication'
import { assignerDates } from './planification'
import { creerSeanceDirecte } from './seanceDirecte'
import { compterHistorique, supprimerSeance, type Historique, type ModeSuppression } from './suppression'

export interface DepsListeSeances {
  /** Base à utiliser (défaut : base de l'application, résolue à l'usage). */
  db?: Db
}

interface Chargement {
  seances: Seance[]
  /** Modèles archivés (masqués de la liste, conservés pour l'historique) */
  archivees: Seance[]
  nbExercices: Record<string, number>
}

// Modèles de renforcement : vivants, catégorie STRENGTH (les séances directes STRENGTH_ONESHOT n'en sont pas),
// répartis entre visibles et archivés.
async function lire(db: Db): Promise<Chargement> {
  const tous = (await listSeanceTemplates(db)).filter((s) => s.seanceCategory.toUpperCase() === 'STRENGTH')
  const seances = tous.filter((s) => !s.isArchived)
  const archivees = tous.filter((s) => s.isArchived)
  const lignes = await db.getAll<{ seance_id: string; n: number }>(
    `SELECT seance_id, COUNT(*) AS n FROM exercices_seance
     WHERE instance_seance_id IS NULL AND deleted_at IS NULL GROUP BY seance_id`,
  )
  return { seances, archivees, nbExercices: Object.fromEntries(lignes.map((l) => [l.seance_id, l.n])) }
}

// Liste des séances. La base n'expose pas d'observation : la liste est relue après chaque écriture
// de ce hook (même principe que useCatalog).
export function useSeanceList({ db }: DepsListeSeances = {}) {
  const [donnees, setDonnees] = useState<Chargement>({ seances: [], archivees: [], nbExercices: {} })
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

  // Archive (réversible) ; renvoie true en cas de succès, sinon le message français est dans `erreur`.
  const archiver = useCallback(
    async (id: string): Promise<boolean> => {
      setErreur(null)
      try {
        await archiverSeance(db ?? getDb(), id)
        await recharger()
        return true
      } catch (e) {
        if (e instanceof ErreurSeance) setErreur(e.message)
        else {
          console.error("Archivage de la séance impossible", e)
          setErreur("L'archivage a échoué.")
        }
        return false
      }
    },
    [db, recharger],
  )

  // Exécute une écriture suivie d'un rechargement ; en cas d'échec, message français dans `erreur` et `echec` renvoyé.
  const ecrire = useCallback(
    async <T,>(action: (d: Db) => Promise<T>, echec: string, repli: T): Promise<T> => {
      setErreur(null)
      try {
        const r = await action(db ?? getDb())
        await recharger()
        return r
      } catch (e) {
        if (e instanceof ErreurSeance) setErreur(e.message)
        else {
          console.error(echec, e)
          setErreur(echec)
        }
        return repli
      }
    },
    [db, recharger],
  )

  const desarchiver = useCallback(
    (id: string) => ecrire(async (d) => (await desarchiverSeance(d, id), true), 'Le désarchivage a échoué.', false),
    [ecrire],
  )

  // Copie complète du modèle (voir dupliquerSeance) ; renvoie l'id de la copie, ou null (message dans `erreur`).
  const dupliquer = useCallback(
    (id: string) => ecrire<string | null>((d) => dupliquerSeance(d, id), 'La duplication a échoué.', null),
    [ecrire],
  )

  // Rejette avec un message français si une date ou la séance est invalide (affiché par le dialogue).
  const affecter = useCallback(
    async (seanceId: string, dates: string[]) => {
      const ids = await assignerDates(db ?? getDb(), seanceId, dates)
      await recharger()
      return ids
    },
    [db, recharger],
  )

  // Séance directe : crée la séance et son instance du jour ; rejette avec un message français (dialogue).
  const creerDirecte = useCallback(
    async (nom: string, dateIso: string) => {
      const r = await creerSeanceDirecte(db ?? getDb(), nom, dateIso)
      await recharger()
      return r
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

  // Crée (ou reprend) l'instance du jour et la démarre ; renvoie son id (voir lancerSeanceMaintenant).
  const lancer = useCallback((seanceId: string) => lancerSeanceMaintenant(db ?? getDb(), seanceId, new Date()), [db])

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
    seances: donnees.seances, archivees: donnees.archivees, nbExercices: donnees.nbExercices, charge, erreur, archiver,
    desarchiver, dupliquer, assigner, affecter, creerDirecte, lancer, compterHistorique: compter, supprimer,
  }
}
