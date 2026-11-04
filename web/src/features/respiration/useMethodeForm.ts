import { useCallback, useEffect, useMemo, useState } from 'react'
import { getDb } from '../../core/db/client'
import type { Db } from '../../core/db/Db'
import { creerMethode, ErreurRespiration, LIMITES_RESPIRATION, lireMethode, modifierMethode } from '../../core/db/repos/respiration'
import { descriptionAuto } from './methodes'

export interface DepsMethodeForm {
  /** Base à utiliser (défaut : base de l'application, résolue à l'usage). */
  db?: Db
}

export interface BrouillonMethode {
  nom: string
  emoji: string
  inspireSec: number
  retentionPleine: boolean
  retentionPleineSec: number
  expireSec: number
  retentionVide: boolean
  retentionVideSec: number
  cyclesDefaut: number
}

export const EMOJI_PAR_DEFAUT = '🌬️'

export const BROUILLON_VIERGE: BrouillonMethode = {
  nom: '', emoji: EMOJI_PAR_DEFAUT, inspireSec: 4, retentionPleine: false, retentionPleineSec: 4, expireSec: 4, retentionVide: false,
  retentionVideSec: 4, cyclesDefaut: 6,
}

const borner = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

export type ChampDuree = 'inspireSec' | 'retentionPleineSec' | 'expireSec' | 'retentionVideSec'

// Création et modification d'une méthode personnalisée. `id` absent : création ; présent : le brouillon est rempli avec la
// méthode existante (`introuvable` si elle n'existe plus). `enregistrer` renvoie true si la méthode est enregistrée.
export function useMethodeForm(id: string | undefined, { db }: DepsMethodeForm = {}) {
  const [brouillon, setBrouillon] = useState<BrouillonMethode>(BROUILLON_VIERGE)
  const [chargement, setChargement] = useState(id !== undefined)
  const [introuvable, setIntrouvable] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [enCours, setEnCours] = useState(false)

  useEffect(() => {
    if (id === undefined) return
    let annule = false
    lireMethode(db ?? getDb(), id)
      .then((m) => {
        if (annule) return
        if (!m) setIntrouvable(true)
        else {
          setBrouillon({
            nom: m.nom, emoji: m.emoji, inspireSec: m.inspireSec, retentionPleine: m.retentionPleineSec > 0,
            retentionPleineSec: Math.max(1, m.retentionPleineSec), expireSec: m.expireSec, retentionVide: m.retentionVideSec > 0,
            retentionVideSec: Math.max(1, m.retentionVideSec), cyclesDefaut: m.cyclesDefaut,
          })
        }
      })
      .catch((e: unknown) => {
        console.error('Chargement de la méthode impossible', e)
        if (!annule) setErreur('Le chargement de la méthode a échoué.')
      })
      .finally(() => {
        if (!annule) setChargement(false)
      })
    return () => {
      annule = true
    }
  }, [id, db])

  const modifierChamps = useCallback((partiel: Partial<BrouillonMethode>) => setBrouillon((b) => ({ ...b, ...partiel })), [])

  const changerDuree = useCallback(
    (champ: ChampDuree, delta: number) =>
      setBrouillon((b) => ({ ...b, [champ]: borner(b[champ] + delta, 1, LIMITES_RESPIRATION.phaseSec) })),
    [],
  )

  const changerCycles = useCallback(
    (delta: number) => setBrouillon((b) => ({ ...b, cyclesDefaut: borner(b.cyclesDefaut + delta, 1, LIMITES_RESPIRATION.cyclesDefaut) })),
    [],
  )

  const apercu = useMemo(
    () =>
      descriptionAuto({
        inspireSec: brouillon.inspireSec,
        retentionPleineSec: brouillon.retentionPleine ? brouillon.retentionPleineSec : 0,
        expireSec: brouillon.expireSec,
        retentionVideSec: brouillon.retentionVide ? brouillon.retentionVideSec : 0,
        cyclesDefaut: brouillon.cyclesDefaut,
      }),
    [brouillon],
  )

  const peutEnregistrer = brouillon.nom.trim() !== '' && !chargement && !introuvable && !enCours

  const enregistrer = useCallback(async (): Promise<boolean> => {
    if (!peutEnregistrer) return false
    setErreur(null)
    setEnCours(true)
    const base = db ?? getDb()
    const saisie = {
      nom: brouillon.nom,
      emoji: brouillon.emoji.trim() === '' ? EMOJI_PAR_DEFAUT : brouillon.emoji,
      inspireSec: brouillon.inspireSec,
      retentionPleineSec: brouillon.retentionPleine ? brouillon.retentionPleineSec : 0,
      expireSec: brouillon.expireSec,
      retentionVideSec: brouillon.retentionVide ? brouillon.retentionVideSec : 0,
      cyclesDefaut: brouillon.cyclesDefaut,
    }
    try {
      if (id === undefined) await creerMethode(base, saisie)
      else await modifierMethode(base, id, saisie)
      return true
    } catch (e) {
      if (e instanceof ErreurRespiration) setErreur(e.message)
      else {
        console.error("Enregistrement de la méthode impossible", e)
        setErreur("L'enregistrement de la méthode a échoué.")
      }
      return false
    } finally {
      setEnCours(false)
    }
  }, [peutEnregistrer, brouillon, id, db])

  return { brouillon, apercu, chargement, introuvable, erreur, enCours, peutEnregistrer, modifierChamps, changerDuree, changerCycles, enregistrer }
}
