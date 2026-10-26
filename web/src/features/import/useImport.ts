import { useCallback, useRef, useState } from 'react'
import { getDb } from '../../core/db/client'
import type { Db } from '../../core/db/Db'
import { applyImportPlan, type ImportReport } from '../../core/import/apply'
import { parseImportFile } from '../../core/import/parseFile'
import { buildImportPlan, ImportError, type ImportPlan } from '../../core/import/plan'

export const TAILLE_MAX_OCTETS = 20 * 1024 * 1024

export type StatutImport = 'idle' | 'ready' | 'importing' | 'done' | 'error'
export type ApercuImport = ImportPlan['report'] & { ignores: string[] }

export interface DepsImport {
  /** Base à utiliser (défaut : base de l'application, résolue au moment de l'écriture). */
  db?: Db
  /** Utilisateur connecté ; sans lui, aucun import n'est possible. */
  userId?: string
  /** Horloge injectable (horodatage ISO des lignes sans date dans l'export). */
  now?: () => string
}

const MESSAGE_GENERIQUE = "L'import a échoué, aucune donnée n'a été modifiée."

// Message affiché à l'utilisateur : ImportError (français, avec le chemin fautif si le message
// ne le contient pas déjà) ; toute autre erreur est journalisée et masquée derrière un message générique.
function messagePour(e: unknown): string {
  if (e instanceof ImportError) {
    return e.chemin && !e.message.includes(e.chemin) ? `${e.message} (${e.chemin})` : e.message
  }
  console.error("Échec de l'import", e)
  return MESSAGE_GENERIQUE
}

export function useImport(deps: DepsImport = {}) {
  const { db, userId, now } = deps
  const [statut, setStatut] = useState<StatutImport>('idle')
  const [apercu, setApercu] = useState<ApercuImport | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [resultat, setResultat] = useState<ImportReport | null>(null)
  const plan = useRef<ImportPlan | null>(null)
  // Promesse de l'import en cours : un second confirm() la réutilise au lieu d'écrire deux fois.
  const enCours = useRef<Promise<ImportReport> | null>(null)

  const reset = useCallback(() => {
    plan.current = null
    setStatut('idle')
    setApercu(null)
    setErreur(null)
    setResultat(null)
  }, [])

  const echec = useCallback((message: string) => {
    plan.current = null
    setApercu(null)
    setResultat(null)
    setErreur(message)
    setStatut('error')
  }, [])

  const load = useCallback(
    async (fichier: File) => {
      if (enCours.current) return
      plan.current = null
      setApercu(null)
      setResultat(null)
      setErreur(null)
      try {
        if (!userId) throw new ImportError('Vous devez être connecté pour importer des données')
        if (fichier.size > TAILLE_MAX_OCTETS) {
          throw new ImportError(`Fichier trop volumineux (maximum ${TAILLE_MAX_OCTETS / (1024 * 1024)} Mo)`)
        }
        const { data } = parseImportFile(await fichier.text())
        const construit = buildImportPlan(data, userId, now ? { now: now() } : undefined)
        plan.current = construit
        setApercu({ ...construit.report, ignores: construit.report.ignores })
        setStatut('ready')
      } catch (e) {
        echec(messagePour(e))
      }
    },
    [userId, now, echec],
  )

  const confirm = useCallback((): Promise<ImportReport> => {
    if (enCours.current) return enCours.current
    const aImporter = plan.current
    if (!aImporter) return Promise.reject(new Error("Aucun fichier à importer : chargez d'abord un fichier"))
    setStatut('importing')
    setErreur(null)
    const promesse = applyImportPlan(db ?? getDb(), aImporter).then(
      (rapport) => {
        setResultat(rapport)
        setStatut('done')
        return rapport
      },
      (e: unknown) => {
        setErreur(messagePour(e))
        setStatut('error')
        throw e
      },
    )
    enCours.current = promesse
    const liberer = () => {
      enCours.current = null
    }
    promesse.then(liberer, liberer)
    return promesse
  }, [db])

  return { preview: apercu, error: erreur, load, confirm, status: statut, resultat, reset }
}
