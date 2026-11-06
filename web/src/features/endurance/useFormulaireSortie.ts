import { useCallback, useEffect, useState } from 'react'
import { dateIsoLocale, dateIsoValide } from '../../core/common/dates'
import { getDb } from '../../core/db/client'
import type { Db } from '../../core/db/Db'
import { definirValidation, lireParId, lirePlage, type SeanceCardio } from '../../core/db/repos/seancesCardio'
import { creerSortie, ErreurSortie, lireSortie, modifierSortie, type Sport } from '../../core/db/repos/sorties'
import { formaterDuree } from './presentation'
import { BROUILLON_VIERGE, lireBrouillon, type BrouillonSortie, type ErreursSortie } from './saisieSortie'

export interface DepsFormulaire {
  /** Base à utiliser (défaut : base de l'application, résolue à l'usage). */
  db?: Db
  /** Jour proposé pour une nouvelle sortie (défaut : aujourd'hui, jour local). */
  aujourdhui?: () => string
}

const texte = (n: number | null) => (n === null ? '' : String(n))

// Création et modification d'une sortie. `id` absent : création ; présent : le brouillon est rempli avec la sortie
// existante (`introuvable` si elle n'existe plus). Séances planifiées proposées : celles du même sport, du jour choisi,
// pas encore validées (plus celle déjà liée à la sortie). `enregistrer` renvoie true si la sortie est enregistrée ; la
// séance planifiée choisie est alors validée.
export function useFormulaireSortie(sport: Sport, id: string | undefined, { db, aujourdhui = () => dateIsoLocale(new Date()) }: DepsFormulaire = {}) {
  const [brouillon, setBrouillon] = useState<BrouillonSortie>(() => BROUILLON_VIERGE(aujourdhui()))
  const [chargement, setChargement] = useState(id !== undefined)
  const [introuvable, setIntrouvable] = useState(false)
  const [erreurs, setErreurs] = useState<ErreursSortie>({})
  const [erreur, setErreur] = useState<string | null>(null)
  const [enCours, setEnCours] = useState(false)
  const [seances, setSeances] = useState<SeanceCardio[]>([])
  // Séance déjà liée à la sortie modifiée : conservée dans les choix même si elle est déjà validée.
  const [seanceInitiale, setSeanceInitiale] = useState<string | null>(null)

  useEffect(() => {
    if (id === undefined) return
    let annule = false
    lireSortie(db ?? getDb(), id)
      .then((s) => {
        if (annule) return
        if (!s || s.sport !== sport) setIntrouvable(true)
        else {
          setSeanceInitiale(s.seanceId)
          setBrouillon({
            date: s.date,
            titre: s.titre,
            duree: s.dureeS === null ? '' : formaterDuree(s.dureeS),
            distanceKm: s.distanceM === null ? '' : String(s.distanceM / 1000).replace('.', ','),
            denivele: texte(s.denivelePosM),
            fcMoy: texte(s.fcMoy),
            fcMax: texte(s.fcMax),
            rpe: texte(s.rpe),
            notes: s.notes ?? '',
            lien: s.lien ?? '',
            enSalle: s.enSalle,
            seanceId: s.seanceId ?? '',
          })
        }
      })
      .catch((e: unknown) => {
        console.error('Chargement de la sortie impossible', e)
        if (!annule) setErreur('Le chargement de la sortie a échoué.')
      })
      .finally(() => {
        if (!annule) setChargement(false)
      })
    return () => {
      annule = true
    }
  }, [id, sport, db])

  // Séances planifiées du jour choisi
  const { date } = brouillon
  useEffect(() => {
    if (!dateIsoValide(date)) return
    let annule = false
    const base = db ?? getDb()
    void (async () => {
      const duJour = (await lirePlage(base, sport, date, date)).filter((s) => !s.isValidated && !s.supprimee)
      const liee = seanceInitiale && !duJour.some((s) => s.id === seanceInitiale) ? await lireParId(base, sport, seanceInitiale) : null
      if (!annule) setSeances(liee && !liee.supprimee ? [liee, ...duJour] : duJour)
    })().catch((e: unknown) => console.error('Lecture des séances planifiées impossible', e))
    return () => {
      annule = true
    }
  }, [date, sport, db, seanceInitiale])

  const modifierChamps = useCallback((partiel: Partial<BrouillonSortie>) => {
    setBrouillon((b) => ({ ...b, ...partiel }))
    setErreurs((e) => {
      const restant = { ...e }
      for (const cle of Object.keys(partiel) as (keyof BrouillonSortie)[]) delete restant[cle]
      return restant
    })
  }, [])

  const peutEnregistrer = !chargement && !introuvable && !enCours && dateIsoValide(brouillon.date)

  const enregistrer = useCallback(async (): Promise<boolean> => {
    if (!peutEnregistrer) return false
    setErreur(null)
    const lu = lireBrouillon(brouillon, sport)
    if (!lu.ok) {
      setErreurs(lu.erreurs)
      return false
    }
    setErreurs({})
    setEnCours(true)
    const base = db ?? getDb()
    try {
      if (id === undefined) await creerSortie(base, lu.saisie)
      else await modifierSortie(base, id, lu.saisie)
      // La sortie est enregistrée : la séance planifiée choisie est validée (sans effet si elle l'est déjà).
      if (lu.saisie.seanceId) await definirValidation(base, sport, lu.saisie.seanceId, true).catch((e: unknown) => console.error('Validation de la séance impossible', e))
      return true
    } catch (e) {
      if (e instanceof ErreurSortie) setErreur(e.message)
      else {
        console.error("Enregistrement de la sortie impossible", e)
        setErreur("L'enregistrement de la sortie a échoué.")
      }
      return false
    } finally {
      setEnCours(false)
    }
  }, [peutEnregistrer, brouillon, sport, id, db])

  return { brouillon, erreurs, erreur, chargement, introuvable, enCours, peutEnregistrer, seances: dateIsoValide(date) ? seances : [], modifierChamps, enregistrer }
}
