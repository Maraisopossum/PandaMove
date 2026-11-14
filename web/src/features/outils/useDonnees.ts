import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../../core/auth/AuthProvider'
import { getDb } from '../../core/db/client'
import type { DbLecture } from '../../core/db/Db'
import { telechargerFichier } from '../../core/export/fichier'
import { CLE_DERNIERE_SAUVEGARDE, useExport } from '../profile/useExport'
import { lireDonneesCiblees, nomFichierCible, resumerSelection, versCsv, versJson, type FormatExport, type ModuleExport, type PeriodeExport } from './exportCible'
import { resumerIntegrite, verifierIntegrite } from './integrite'
import { ecrireFrequenceRappel, ilYa, joursDepuis, lireFrequenceRappel, rappelDu, type FrequenceRappel } from './rappelSauvegarde'

export interface ComptesDonnees {
  seances: number
  seancesJouees: number
  sorties: number
  methodes: number
}

// Effectifs de ce que contient la base locale (lignes vivantes). Renforcement : modèles de séance non archivés et séances
// terminées. Les sorties et les méthodes de respiration sont aussi dans l'export JSON (champ pandamoveWeb).
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

export interface EtatSynchro {
  /** Modifications locales pas encore envoyées ; null si l'appareil ne sait pas le dire. */
  enAttente: number | null
  derniere: Date | null
  connecte: boolean | null
}

// Sous-ensemble de PowerSyncDatabase lu pour l'état de synchronisation (absent des bases de test).
interface BaseSynchro {
  currentStatus?: { connected?: boolean; lastSyncedAt?: Date }
  getUploadQueueStats?: () => Promise<{ count: number }>
  registerListener?: (l: { statusChanged?: () => void }) => () => void
}

export async function lireEtatSynchro(base: unknown): Promise<EtatSynchro> {
  const b = base as BaseSynchro
  const stats = b.getUploadQueueStats ? await b.getUploadQueueStats().catch(() => null) : null
  return { enAttente: stats ? stats.count : null, derniere: b.currentStatus?.lastSyncedAt ?? null, connecte: b.currentStatus?.connected ?? null }
}

/** Phrase d'état : modifications en attente, hors ligne, ou tout est envoyé. */
export function resumerSynchro(e: EtatSynchro, maintenant: Date): string {
  if (e.enAttente !== null && e.enAttente > 0) return `${e.enAttente} modification${e.enAttente > 1 ? 's' : ''} en attente d’envoi${e.connecte === false ? ' (appareil hors ligne)' : ''}.`
  if (e.connecte === false) return 'Appareil hors ligne : vos données sont sur l’appareil et seront envoyées au retour du réseau.'
  if (e.derniere) return `Tout est synchronisé. Dernière synchronisation ${ilYa(e.derniere, maintenant)}${e.enAttente === 0 ? ', aucun changement en attente' : ''}.`
  return e.enAttente === 0 ? 'Aucun changement en attente.' : 'État de synchronisation indisponible sur cet appareil.'
}

export function formaterTaille(octets: number): string {
  if (octets < 1024 * 1024) return `${Math.max(1, Math.round(octets / 1024))} Ko`
  return `${(octets / (1024 * 1024)).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Mo`
}

interface DepsDonnees {
  db?: DbLecture
  /** Horloge (défaut : maintenant). */
  maintenant?: () => Date
  /** Remise du fichier ciblé au navigateur (défaut : téléchargement Blob). */
  telecharger?: (nom: string, contenu: string, type: string) => void
}

// Écran « Mes données » : effectifs, synchronisation, intégrité, sauvegarde et rappel, export ciblé.
export function useDonnees({ db, maintenant = () => new Date(), telecharger = telechargerFichier }: DepsDonnees = {}) {
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

  // Synchronisation : relue à chaque changement de statut
  const [synchro, setSynchro] = useState<EtatSynchro | null>(null)
  useEffect(() => {
    let annule = false
    const base = db ?? getDb()
    const relire = () => void lireEtatSynchro(base).then((e) => !annule && setSynchro(e))
    relire()
    const arreter = (base as BaseSynchro).registerListener?.({ statusChanged: relire })
    return () => {
      annule = true
      arreter?.()
    }
  }, [db])

  const [taille, setTaille] = useState<string | null>(null)
  useEffect(() => {
    let annule = false
    const estimation = globalThis.navigator?.storage?.estimate?.()
    estimation?.then((e) => !annule && e.usage && setTaille(formaterTaille(e.usage))).catch(() => undefined)
    return () => {
      annule = true
    }
  }, [])

  const [integrite, setIntegrite] = useState<string | null>(null)
  const [verification, setVerification] = useState(false)
  const verifier = useCallback(async () => {
    setVerification(true)
    try {
      setIntegrite(resumerIntegrite(await verifierIntegrite(db ?? getDb())))
    } catch (e) {
      console.error("Vérification d'intégrité impossible", e)
      setIntegrite('La vérification a échoué. Réessayez.')
    } finally {
      setVerification(false)
    }
  }, [db])

  // Rappel de sauvegarde (réglage d'appareil)
  const [frequence, setFrequenceEtat] = useState<FrequenceRappel>(lireFrequenceRappel)
  const changerFrequence = useCallback((f: FrequenceRappel) => {
    ecrireFrequenceRappel(f)
    setFrequenceEtat(f)
  }, [])
  const horloge = useRef(maintenant)
  useEffect(() => {
    horloge.current = maintenant
  })
  const [instant] = useState(() => maintenant())

  // Export ciblé : sélection, aperçu chiffré et téléchargement
  const [modules, setModules] = useState<ModuleExport[]>([])
  const [periode, setPeriode] = useState<PeriodeExport>('mois')
  const [format, setFormat] = useState<FormatExport>('json')
  const [apercu, setApercu] = useState<string | null>(null)
  const [messageCible, setMessageCible] = useState('')
  const [erreurCible, setErreurCible] = useState<string | null>(null)
  const cleModules = modules.join(',')
  useEffect(() => {
    if (!cleModules) return
    let annule = false
    lireDonneesCiblees(db ?? getDb(), cleModules.split(',') as ModuleExport[], periode, horloge.current())
      .then((d) => !annule && setApercu(resumerSelection(d)))
      .catch((e: unknown) => console.error("Aperçu de l'export impossible", e))
    return () => {
      annule = true
    }
  }, [db, cleModules, periode])

  const basculerModule = useCallback((m: ModuleExport) => setModules((courant) => (courant.includes(m) ? courant.filter((x) => x !== m) : [...courant, m])), [])
  const exporterSelection = useCallback(async () => {
    setErreurCible(null)
    setMessageCible('')
    try {
      const date = horloge.current()
      const donnees = await lireDonneesCiblees(db ?? getDb(), modules, periode, date)
      const nom = nomFichierCible(date, format)
      telecharger(nom, format === 'json' ? versJson(donnees, periode, date) : versCsv(donnees), format === 'json' ? 'application/json' : 'text/csv;charset=utf-8')
      setMessageCible(`Fichier ${nom} téléchargé : retrouvez-le dans vos téléchargements.`)
    } catch (e) {
      console.error('Export ciblé impossible', e)
      setErreurCible("L'export a échoué : aucun fichier n'a été créé. Réessayez.")
    }
  }, [db, modules, periode, format, telecharger])

  return {
    comptes, erreur, sauvegarde, derniere: formaterDerniereSauvegarde(derniere),
    synchro: synchro ? resumerSynchro(synchro, instant) : null, taille,
    integrite, verification, verifier,
    frequence, changerFrequence, rappel: rappelDu(derniere, frequence, instant), joursSansSauvegarde: joursDepuis(derniere, instant),
    cible: {
      modules, periode, format, apercu: cleModules ? apercu : null, message: messageCible, erreur: erreurCible,
      basculerModule, setPeriode, setFormat, exporter: exporterSelection,
    },
  }
}
