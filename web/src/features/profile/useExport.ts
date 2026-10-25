import { useCallback, useRef, useState } from 'react'
import { getDb } from '../../core/db/client'
import type { DbLecture } from '../../core/db/Db'
import { construireExport } from '../../core/export/construireExport'
import { nomFichierExport, telechargerJson } from '../../core/export/fichier'

export type StatutExport = 'repos' | 'generation' | 'termine' | 'erreur'

export interface DepsExport {
  /** Base à lire (défaut : base de l'application, résolue à l'usage). */
  db?: DbLecture
  /** Remise du fichier au navigateur (défaut : téléchargement Blob + <a download>). */
  telecharger?: (nom: string, contenu: string) => void
  /** Horloge (défaut : maintenant) : date le fichier et son nom. */
  maintenant?: () => Date
}

export const ERREUR_EXPORT = "L'export a échoué : aucun fichier n'a été créé. Réessayez."

// Sauvegarde : génère l'export JSON v3.2 de la base locale et le télécharge. Un seul export à la fois.
export function useExport({ db, telecharger = telechargerJson, maintenant = () => new Date() }: DepsExport = {}) {
  const [statut, setStatut] = useState<StatutExport>('repos')
  const [nomFichier, setNomFichier] = useState<string | null>(null)
  const enCoursRef = useRef(false)

  const exporter = useCallback(async () => {
    if (enCoursRef.current) return
    enCoursRef.current = true
    setStatut('generation')
    try {
      const date = maintenant()
      const contenu = JSON.stringify(await construireExport(db ?? getDb(), date), null, 2)
      const nom = nomFichierExport(date)
      telecharger(nom, contenu)
      setNomFichier(nom)
      setStatut('termine')
    } catch (e) {
      console.error("Export des données impossible", e)
      setStatut('erreur')
    } finally {
      enCoursRef.current = false
    }
  }, [db, telecharger, maintenant])

  const message =
    statut === 'generation'
      ? "Préparation du fichier d'export…"
      : statut === 'termine' && nomFichier
        ? `Fichier ${nomFichier} téléchargé : retrouvez-le dans vos téléchargements.`
        : ''

  return {
    exporter,
    statut,
    enCours: statut === 'generation',
    /** Retour à annoncer (role="status") ; vide au repos et en cas d'erreur. */
    message,
    erreur: statut === 'erreur' ? ERREUR_EXPORT : null,
  }
}
