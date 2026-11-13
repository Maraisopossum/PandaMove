import { useCallback, useEffect, useMemo, useState } from 'react'
import { getDb } from '../../core/db/client'
import type { DbLecture } from '../../core/db/Db'
import { dateIsoLocale } from '../../core/common/dates'
import { lireSorties, type Sortie } from '../../core/db/repos/sorties'
import {
  ajouterJours,
  calculerSerieCharge,
  etatForme,
  parametresEffectifs,
  repartitionMethodes,
  type ReglagesCharge,
} from './calculCharge'

export const CLE_REGLAGES_CHARGE = 'pandamove.charge.reglages'

export const FENETRES = [
  { id: 42, libelle: '6 semaines' },
  { id: 90, libelle: '3 mois' },
  { id: 180, libelle: '6 mois' },
] as const
export type FenetreId = (typeof FENETRES)[number]['id']

export interface DepsCharge {
  db?: DbLecture
  maintenant?: () => Date
}

const MAINTENANT = () => new Date()

// Réglages propres à l'appareil (comme les autres préférences de calcul) ; toute valeur invalide est ignorée.
export function lireReglagesCharge(): ReglagesCharge {
  try {
    const v = JSON.parse(globalThis.localStorage?.getItem(CLE_REGLAGES_CHARGE) ?? 'null') as Record<string, unknown> | null
    const nombre = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? x : undefined)
    return v && typeof v === 'object' ? { ftpW: nombre(v.ftpW), fcMax: nombre(v.fcMax), fcRepos: nombre(v.fcRepos) } : {}
  } catch {
    return {}
  }
}

function ecrireReglagesCharge(r: ReglagesCharge): void {
  try {
    globalThis.localStorage?.setItem(CLE_REGLAGES_CHARGE, JSON.stringify(r))
  } catch {
    // stockage indisponible : le réglage vaut pour la session seulement
  }
}

// Charge d'entraînement (course et vélo ensemble) : sorties lues une fois, paramètres estimés ou réglés, série quotidienne
// forme / fatigue / fraîcheur sur la fenêtre choisie. Calculs dans calculCharge.ts.
export function useChargeEntrainement({ db, maintenant = MAINTENANT }: DepsCharge = {}) {
  const [sorties, setSorties] = useState<Sortie[] | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [fenetre, setFenetre] = useState<FenetreId>(90)
  const [reglages, setReglagesEtat] = useState<ReglagesCharge>(lireReglagesCharge)

  useEffect(() => {
    let annule = false
    lireSorties(db ?? getDb())
      .then((l) => !annule && setSorties(l))
      .catch((e: unknown) => {
        console.error('Lecture des sorties impossible', e)
        if (!annule) setErreur('Le chargement des sorties a échoué.')
      })
    return () => {
      annule = true
    }
  }, [db])

  const regler = useCallback((r: ReglagesCharge) => {
    setReglagesEtat(r)
    ecrireReglagesCharge(r)
  }, [])

  const calculs = useMemo(() => {
    if (!sorties) return null
    const aujourdhui = dateIsoLocale(maintenant())
    const parametres = parametresEffectifs(sorties, reglages)
    const complete = calculerSerieCharge(sorties, parametres, aujourdhui)
    const debut = ajouterJours(aujourdhui, -(fenetre - 1))
    const serie = complete.filter((j) => j.date >= debut)
    const dernier = complete.at(-1) ?? null
    return {
      parametres,
      serie,
      dernier,
      etat: dernier ? etatForme(dernier.fraicheur) : null,
      methodes: repartitionMethodes(sorties, parametres),
      nombreSorties: sorties.length,
    }
  }, [sorties, reglages, fenetre, maintenant])

  return {
    pret: sorties !== null || erreur !== null,
    erreur,
    fenetre,
    choisirFenetre: setFenetre,
    reglages,
    regler,
    ...(calculs ?? { parametres: null, serie: [], dernier: null, etat: null, methodes: null, nombreSorties: 0 }),
  }
}
