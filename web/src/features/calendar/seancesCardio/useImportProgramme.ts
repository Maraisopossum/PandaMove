import { useCallback, useEffect, useRef, useState } from 'react'
import { getDb } from '../../../core/db/client'
import type { Db } from '../../../core/db/Db'
import type { SyncState } from '../../../core/sync/useSyncStatus'
import { importerProgramme2027, type ResultatImportProgramme } from './importerProgramme2027'
import programme from './programme2027.json'
import type { SourceSynchro } from './useSourceSynchro'

export type StatutImportProgramme = 'idle' | 'importing' | 'done' | 'error'

export interface DepsImportProgramme {
  /** Base à utiliser (défaut : base de l'application, résolue au moment de l'écriture). */
  db?: Db
  /** Utilisateur connecté ; sans lui, aucun import n'est possible. */
  userId?: string
  /** Synchronisation de cet appareil : sans elle, aucun import n'est possible (voir `raisonBlocage`). */
  synchro: SourceSynchro
}

const MESSAGE_GENERIQUE = "L'import a échoué, aucune donnée n'a été modifiée."
const MESSAGE_CONNEXION = 'Vous devez être connecté pour importer le programme.'
const MESSAGE_FILE = 'Des modifications de cet appareil ne sont pas encore envoyées. Attendez la fin de la synchronisation.'

// Pourquoi l'import n'est pas possible maintenant, ou null s'il l'est. `fileVide` vaut null tant que la file d'envoi
// n'a pas été lue. Ces conditions ne prouvent pas qu'un autre appareil a fini d'envoyer ses modifications : elles
// évitent seulement d'importer avant d'avoir reçu l'état du serveur ou avec des écritures locales encore en attente.
function raisonBlocage(premiereSynchro: boolean, etat: SyncState, fileVide: boolean | null): string | null {
  if (!premiereSynchro) return 'En attente de la première synchronisation de cet appareil…'
  if (etat === 'offline') return 'Appareil hors ligne : reconnectez-vous pour importer.'
  if (etat === 'syncing') return 'Synchronisation en cours : patientez quelques secondes.'
  if (fileVide === null) return 'Vérification des modifications en attente…'
  if (!fileVide) return MESSAGE_FILE
  return null
}

// État de l'onglet « Programme 2027 » : un bouton, un résultat. La logique d'écriture est dans importerProgramme2027.
export function useImportProgramme({ db, userId, synchro }: DepsImportProgramme) {
  const [statut, setStatut] = useState<StatutImportProgramme>('idle')
  const [resultat, setResultat] = useState<ResultatImportProgramme | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [premiereSynchro, setPremiereSynchro] = useState(false)
  const [fileVide, setFileVide] = useState<boolean | null>(null)
  // Import en cours : un second appel le réutilise au lieu d'écrire deux fois
  const enCours = useRef<Promise<void> | null>(null)
  // Les effets lisent la source la plus récente sans se relancer à chaque nouvel objet
  const synchroCourante = useRef(synchro)
  useEffect(() => {
    synchroCourante.current = synchro
  })

  useEffect(() => {
    const annulation = new AbortController()
    synchroCourante.current.attendrePremiereSynchro(annulation.signal).then(
      () => {
        if (!annulation.signal.aborted) setPremiereSynchro(true)
      },
      (e: unknown) => {
        if (!annulation.signal.aborted) console.error('Attente de la première synchronisation impossible', e)
      },
    )
    return () => annulation.abort()
  }, [])

  // La file d'envoi change avec l'état de synchronisation : on la relit à chaque changement
  const etat = synchro.etat
  useEffect(() => {
    let annule = false
    synchroCourante.current.compterFileEnvoi().then(
      (n) => {
        if (!annule) setFileVide(n === 0)
      },
      (e: unknown) => {
        console.error("Lecture de la file d'envoi impossible", e)
        if (!annule) setFileVide(false)
      },
    )
    return () => {
      annule = true
    }
  }, [etat])

  const blocage = raisonBlocage(premiereSynchro, etat, fileVide)

  const echec = useCallback((message: string) => {
    setErreur(message)
    setStatut('error')
  }, [])

  const importer = useCallback((): Promise<void> => {
    if (enCours.current) return enCours.current
    setResultat(null)
    setErreur(null)
    if (!userId) {
      echec(MESSAGE_CONNEXION)
      return Promise.resolve()
    }
    setStatut('importing')
    const promesse = (async () => {
      // La file est relue au clic : une écriture a pu apparaître depuis le dernier affichage du bouton
      let file: number
      try {
        file = await synchro.compterFileEnvoi()
      } catch (e) {
        console.error("Lecture de la file d'envoi impossible", e)
        return echec(MESSAGE_FILE)
      }
      const refus = raisonBlocage(premiereSynchro, etat, file === 0)
      if (refus) return echec(refus)
      try {
        setResultat(await importerProgramme2027(db ?? getDb(), userId))
        setStatut('done')
      } catch (e) {
        console.error("Échec de l'import du programme 2027", e)
        echec(MESSAGE_GENERIQUE)
      }
    })()
    enCours.current = promesse
    void promesse.then(() => {
      enCours.current = null
    })
    return promesse
  }, [db, userId, synchro, premiereSynchro, etat, echec])

  return {
    statut, resultat, erreur, importer,
    nbSeances: programme.length, nbJalons: programme.filter((e) => e.jalon).length,
    debut: programme[0]?.date ?? '', fin: programme[programme.length - 1]?.date ?? '',
    peutImporter: blocage === null && statut !== 'importing',
    raisonBlocage: blocage,
  }
}
