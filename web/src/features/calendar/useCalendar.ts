import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getDb } from '../../core/db/client'
import type { Db } from '../../core/db/Db'
import { deplacerInstance, ErreurCalendrier, lireInstancesPlage, lireProchaines, supprimerInstance } from './calendrier'
import { construireGrille, isoDepuisParties, type Mois } from './grille'
import type { Filtre, InstanceVue, JourVue } from './types'

export interface DepsCalendrier {
  /** Base à utiliser (défaut : base de l'application, résolue à l'usage). */
  db?: Db
  /** Horloge injectable pour « aujourd'hui ». */
  nowFn?: () => Date
}

const NB_PROCHAINES = 10

interface Donnees {
  instances: InstanceVue[]
  prochaines: InstanceVue[]
}

const aujourdhuiIso = (maintenant: Date) =>
  isoDepuisParties(maintenant.getFullYear(), maintenant.getMonth() + 1, maintenant.getDate())

// Calendrier du mois : grille de semaines (lundi en premier), séances rattachées à leur date planifiée,
// « prochaines séances », filtre de statut, déplacement et suppression d'une séance.
// La base n'expose pas d'observation : les données sont relues après chaque action.
export function useCalendar(mois: Mois, { db, nowFn }: DepsCalendrier = {}) {
  const { year, month } = mois
  const [donnees, setDonnees] = useState<Donnees>({ instances: [], prochaines: [] })
  const [cleChargee, setCleChargee] = useState<string | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [filtre, setFiltreEtat] = useState<Filtre>({ statut: 'toutes' })
  const sequence = useRef(0)

  const aujourdhui = aujourdhuiIso((nowFn ?? (() => new Date()))())
  const squelette = useMemo(() => construireGrille({ year, month }, aujourdhui), [year, month, aujourdhui])
  const debut = squelette[0].dateIso
  const fin = squelette[squelette.length - 1].dateIso

  // Cl� de la plage affich�e : � chargement � tant que les donn�es lues ne correspondent pas � elle
  const cle = `${debut}|${fin}|${aujourdhui}`
  const chargement = cleChargee !== cle

  // Lecture ; seule la dernière demande est appliquée (changement de mois rapide)
  const lire = useCallback(async () => {
    const numero = ++sequence.current
    const base = db ?? getDb()
    const [instances, prochaines] = await Promise.all([
      lireInstancesPlage(base, debut, fin),
      lireProchaines(base, aujourdhui, NB_PROCHAINES),
    ])
    if (numero === sequence.current) setDonnees({ instances, prochaines })
  }, [db, debut, fin, aujourdhui])

  useEffect(() => {
    let annule = false
    lire()
      .catch((e: unknown) => {
        console.error('Chargement du calendrier impossible', e)
        if (!annule) setErreur('Le chargement du calendrier a échoué.')
      })
      .finally(() => {
        if (!annule) setCleChargee(cle)
      })
    return () => {
      annule = true
    }
  }, [lire, cle])

  // Exécute une écriture puis relit ; toute erreur finit dans `erreur` (jamais de rejet non géré).
  const agir = useCallback(
    async (ecrire: (base: Db) => Promise<void>, echec: string) => {
      setErreur(null)
      try {
        await ecrire(db ?? getDb())
        await lire()
      } catch (e) {
        if (e instanceof ErreurCalendrier) setErreur(e.message)
        else {
          console.error(echec, e)
          setErreur(echec)
        }
      }
    },
    [db, lire],
  )

  const deplacer = useCallback(
    (instanceId: string, dateIso: string) =>
      agir((base) => deplacerInstance(base, instanceId, dateIso), 'Le déplacement de la séance a échoué.'),
    [agir],
  )
  const supprimer = useCallback(
    (instanceId: string) => agir((base) => supprimerInstance(base, instanceId), 'La suppression de la séance a échoué.'),
    [agir],
  )
  const setFiltre = useCallback((f: Filtre) => setFiltreEtat(f), [])

  const jours: JourVue[] = useMemo(() => {
    const garde = (i: InstanceVue) =>
      filtre.statut === 'toutes' || (filtre.statut === 'terminees' ? i.etat === 'terminee' : i.etat !== 'terminee')
    const parDate = new Map<string, InstanceVue[]>()
    for (const i of donnees.instances.filter(garde)) parDate.set(i.dateIso, [...(parDate.get(i.dateIso) ?? []), i])
    return squelette.map((j) => ({ ...j, instances: parDate.get(j.dateIso) ?? [] }))
  }, [squelette, donnees.instances, filtre])

  return {
    chargement, erreur, jours, prochaines: donnees.prochaines, filtre, setFiltre, deplacer,
    supprimerInstance: supprimer,
  }
}
