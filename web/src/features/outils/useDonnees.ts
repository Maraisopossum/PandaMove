import { useEffect, useState } from 'react'
import { useAuth } from '../../core/auth/AuthProvider'
import { getDb } from '../../core/db/client'
import type { DbLecture } from '../../core/db/Db'
import { CLE_DERNIERE_SAUVEGARDE, useExport } from '../profile/useExport'

export interface ComptesDonnees {
  seances: number
  seancesJouees: number
  sorties: number
  methodes: number
}

// Effectifs de ce que contient la base locale (lignes vivantes). Renforcement : modèles de séance non archivés et séances
// terminées. Les sorties et les méthodes de respiration ne sont PAS dans l'export JSON (format Android : renforcement seul).
export async function compterDonnees(db: DbLecture): Promise<ComptesDonnees> {
  const n = async (sql: string) => Number((await db.getOptional<{ n: number }>(sql))?.n ?? 0)
  const [seances, seancesJouees, sorties, methodes] = await Promise.all([
    n("SELECT COUNT(*) AS n FROM seances WHERE deleted_at IS NULL AND is_archived = 0 AND UPPER(seance_category) = 'STRENGTH'"),
    n('SELECT COUNT(*) AS n FROM instances_seance WHERE deleted_at IS NULL AND is_completed = 1'),
    n('SELECT COUNT(*) AS n FROM sorties WHERE deleted_at IS NULL'),
    n('SELECT COUNT(*) AS n FROM methodes_respiration WHERE deleted_at IS NULL'),
  ])
  return { seances, seancesJouees, sorties, methodes }
}

// « hier à 21:40 » n'est pas calculé : la date complète suffit et reste exacte.
export function formaterDerniereSauvegarde(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(d)
}

// Écran « Mes données » : effectifs, date de la dernière sauvegarde et export (même export que le profil).
export function useDonnees({ db }: { db?: DbLecture } = {}) {
  const { session } = useAuth()
  const sauvegarde = useExport({ userId: session?.user.id })
  const [comptes, setComptes] = useState<ComptesDonnees | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [initiale] = useState<string | null>(() => window.localStorage.getItem(CLE_DERNIERE_SAUVEGARDE))

  useEffect(() => {
    let annule = false
    compterDonnees(db ?? getDb())
      .then((c) => !annule && setComptes(c))
      .catch((e: unknown) => {
        console.error('Comptage des données impossible', e)
        if (!annule) setErreur('Le décompte de vos données a échoué.')
      })
    return () => {
      annule = true
    }
  }, [db])

  // L'export réussi enregistre sa date (useExport) : relue aussitôt pour l'afficher.
  const derniere = sauvegarde.statut === 'termine' ? (window.localStorage.getItem(CLE_DERNIERE_SAUVEGARDE) ?? initiale) : initiale

  return { comptes, erreur, sauvegarde, derniere: formaterDerniereSauvegarde(derniere) }
}
