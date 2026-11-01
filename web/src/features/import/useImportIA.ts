import { useCallback, useRef, useState } from 'react'
import { getDb } from '../../core/db/client'
import type { Db } from '../../core/db/Db'
import { analyserTexteIA } from '../../core/import-ia/analyser'
import { ErreurImportIA, appliquerImportIA, lireContextePlan, type ResultatImportIA } from '../../core/import-ia/apply'
import { genererModeleIA, lireExercicesPersonnalises, NOMS_FICHIERS_MODELE, type ModeleIA } from '../../core/import-ia/modele'
import { planifierImportIA, type PlanImportIA } from '../../core/import-ia/planifier'
import { copierTexte, telechargerTexte } from './telecharger'

export const TAILLE_MAX_IA_OCTETS = 2 * 1024 * 1024

export type StatutImportIA = 'idle' | 'ready' | 'importing' | 'done' | 'error'
export type PieceModele = 'consigne' | 'exemple' | 'schema'

export interface DepsImportIA {
  /** Base à utiliser (défaut : base de l'application, résolue au moment de l'usage). */
  db?: Db
  /** Utilisateur connecté ; sans lui, aucun import n'est possible. */
  userId?: string
}

const MESSAGE_GENERIQUE = "L'import a échoué, aucune donnée n'a été modifiée."
const TYPES_MIME: Record<PieceModele, string> = { consigne: 'text/markdown', exemple: 'application/json', schema: 'application/json' }
const CONFIRMATIONS: Record<PieceModele, string> = {
  consigne: 'Consigne téléchargée.',
  exemple: 'Exemple téléchargé.',
  schema: 'Schéma téléchargé.',
}

function messageErreur(e: unknown): string {
  if (e instanceof ErreurImportIA) return e.message
  console.error("Échec de l'import de séances IA", e)
  return MESSAGE_GENERIQUE
}

// État et actions de l'onglet « Séances créées par une IA » : préparation du fichier modèle, lecture du fichier
// ou du texte collé, aperçu, import. Toute la logique métier est dans core/import-ia ; ce hook l'orchestre.
export function useImportIA(deps: DepsImportIA = {}) {
  const { db, userId } = deps
  const [statut, setStatut] = useState<StatutImportIA>('idle')
  const [texte, setTexteBrut] = useState('')
  const [plan, setPlan] = useState<PlanImportIA | null>(null)
  const [erreurs, setErreurs] = useState<string[]>([])
  const [avertissements, setAvertissements] = useState<string[]>([])
  const [notes, setNotes] = useState<string[]>([])
  const [echec, setEchec] = useState<string | null>(null)
  const [resultat, setResultat] = useState<ResultatImportIA | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const enCours = useRef<Promise<ResultatImportIA> | null>(null)

  const viderAnalyse = useCallback(() => {
    setPlan(null)
    setErreurs([])
    setAvertissements([])
    setNotes([])
    setEchec(null)
    setResultat(null)
  }, [])

  const reinitialiser = useCallback(() => {
    viderAnalyse()
    setTexteBrut('')
    setInfo(null)
    setStatut('idle')
  }, [viderAnalyse])

  // Modifier le texte invalide l'aperçu : on n'importe jamais autre chose que ce qui est affiché
  const setTexte = useCallback(
    (valeur: string) => {
      setTexteBrut(valeur)
      if (enCours.current) return
      viderAnalyse()
      setStatut('idle')
    },
    [viderAnalyse],
  )

  const analyser = useCallback(
    async (contenu: string) => {
      if (enCours.current) return
      viderAnalyse()
      setInfo(null)
      if (!userId) {
        setErreurs(['Vous devez être connecté pour importer des données.'])
        setStatut('error')
        return
      }
      const analyse = analyserTexteIA(contenu)
      setAvertissements(analyse.avertissements)
      setNotes(analyse.notes)
      if (!analyse.donnees) {
        setErreurs(analyse.erreurs)
        setStatut('error')
        return
      }
      try {
        const construit = planifierImportIA(analyse.donnees, await lireContextePlan(db ?? getDb(), userId))
        setPlan(construit)
        setErreurs(construit.erreurs)
        setStatut(construit.erreurs.length > 0 ? 'error' : 'ready')
      } catch (e) {
        setEchec(messageErreur(e))
        setStatut('error')
      }
    },
    [db, userId, viderAnalyse],
  )

  const chargerFichier = useCallback(
    async (fichier: File) => {
      if (fichier.size > TAILLE_MAX_IA_OCTETS) {
        viderAnalyse()
        setErreurs([`Fichier trop volumineux (maximum ${TAILLE_MAX_IA_OCTETS / (1024 * 1024)} Mo).`])
        setStatut('error')
        return
      }
      const contenu = await fichier.text()
      setTexteBrut(contenu)
      await analyser(contenu)
    },
    [analyser, viderAnalyse],
  )

  const analyserTexte = useCallback(() => analyser(texte), [analyser, texte])

  const confirmer = useCallback((): Promise<ResultatImportIA> => {
    if (enCours.current) return enCours.current
    if (!plan || !userId || plan.erreurs.length > 0) return Promise.reject(new Error("Aucun fichier valide à importer"))
    setStatut('importing')
    setEchec(null)
    const promesse = appliquerImportIA(db ?? getDb(), plan, userId).then(
      (r) => {
        setResultat(r)
        setStatut('done')
        return r
      },
      (e: unknown) => {
        setEchec(messageErreur(e))
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
  }, [db, plan, userId])

  // Fichier modèle : consigne + exemple + schéma, générés localement avec le catalogue de base et les noms des
  // exercices personnalisés de l'utilisateur.
  const preparerModele = useCallback(async (): Promise<ModeleIA> => {
    const personnalises = await lireExercicesPersonnalises(db ?? getDb()).catch(() => [])
    return genererModeleIA({ exercicesPersonnalises: personnalises })
  }, [db])

  const telecharger = useCallback(
    async (piece: PieceModele) => {
      const modele = await preparerModele()
      const ok = telechargerTexte(NOMS_FICHIERS_MODELE[piece], modele[piece], TYPES_MIME[piece])
      setInfo(ok ? CONFIRMATIONS[piece] : "Le téléchargement n'a pas pu démarrer sur cet appareil.")
    },
    [preparerModele],
  )

  const copierConsigne = useCallback(async () => {
    const modele = await preparerModele()
    const ok = await copierTexte(modele.consigne)
    setInfo(ok ? 'Consigne copiée. Collez-la dans votre IA.' : 'Copie impossible sur cet appareil : utilisez le téléchargement.')
  }, [preparerModele])

  const nbNouvelles = plan?.brouillons.length ?? 0
  return {
    statut, texte, setTexte, plan, erreurs, avertissements, notes, echec, resultat, info,
    nbSeancesNouvelles: nbNouvelles,
    peutImporter: statut === 'ready' && erreurs.length === 0 && nbNouvelles > 0,
    chargerFichier, analyserTexte, confirmer, reinitialiser, telecharger, copierConsigne,
  }
}
