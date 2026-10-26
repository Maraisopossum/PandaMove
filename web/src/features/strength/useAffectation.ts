import { useCallback, useMemo, useState } from 'react'
import type { Seance } from '../../core/db/types'
import { dateIsoValide, ErreurSeance } from './affectation'
import { datesDuFormulaire, formulaireInitial, type FormulaireAffectation, type ModeAffectation } from './planification'
import { aujourdhuiIso } from './saisie'

const jmaa = (iso: string) => iso.split('-').reverse().join('/')

// État du dialogue d'affectation d'une séance au calendrier : une date, plusieurs dates ou une répétition.
// `affecter` vient de useSeanceList (crée une instance par date, tout ou rien) ; `surSucces` reçoit le message de
// confirmation (et, pour une seule date, l'instance créée) une fois le dialogue fermé.
export interface SuccesAffectation {
  texte: string
  /** Instance créée quand une seule date a été affectée */
  instanceId: string | null
}

export function useAffectation(
  affecter: (seanceId: string, dates: string[]) => Promise<string[]>,
  surSucces: (succes: SuccesAffectation) => void,
) {
  const [cible, setCible] = useState<Seance | null>(null)
  const [form, setForm] = useState<FormulaireAffectation>(() => formulaireInitial(aujourdhuiIso()))
  const [erreur, setErreur] = useState<string | null>(null)
  const [enCours, setEnCours] = useState(false)

  const ouvrir = useCallback((seance: Seance) => {
    setCible(seance)
    setForm(formulaireInitial(aujourdhuiIso()))
    setErreur(null)
  }, [])

  const fermer = useCallback(() => setCible(null), [])

  const modifier = useCallback((patch: Partial<FormulaireAffectation>) => {
    setErreur(null)
    setForm((f) => ({ ...f, ...patch }))
  }, [])

  const choisirMode = useCallback((mode: ModeAffectation) => modifier({ mode }), [modifier])

  // Mode « plusieurs dates » : la date saisie rejoint la liste (doublons ignorés)
  const dateSaisie = form.date
  const ajouterDate = useCallback(() => {
    if (!dateIsoValide(dateSaisie)) {
      setErreur('Date invalide : choisissez une date réelle au format jj/mm/aaaa.')
      return
    }
    setErreur(null)
    setForm((f) => (f.dates.includes(dateSaisie) ? f : { ...f, dates: [...f.dates, dateSaisie].sort() }))
  }, [dateSaisie])

  const retirerDate = useCallback((date: string) => {
    setForm((f) => ({ ...f, dates: f.dates.filter((d) => d !== date) }))
  }, [])

  // Résumé du nombre de séances qui seront créées (répétition et dates multiples) ; null si la saisie est incomplète
  const apercu = useMemo(() => {
    if (form.mode === 'une') return null
    try {
      const dates = datesDuFormulaire(form)
      const n = dates.length
      if (n === 1) return `1 séance sera créée le ${jmaa(dates[0])}.`
      return `${n} séances seront créées, du ${jmaa(dates[0])} au ${jmaa(dates[n - 1])}.`
    } catch {
      return null
    }
  }, [form])

  const confirmer = useCallback(async () => {
    if (!cible || enCours) return
    setErreur(null)
    setEnCours(true)
    try {
      const dates = datesDuFormulaire(form)
      const ids = await affecter(cible.id, dates)
      setCible(null)
      surSucces({
        texte:
          ids.length === 1
            ? `« ${cible.nom} » est affectée au ${jmaa(dates[0])}.`
            : `« ${cible.nom} » est affectée à ${ids.length} dates, du ${jmaa(dates[0])} au ${jmaa(dates[dates.length - 1])}.`,
        instanceId: ids.length === 1 ? ids[0] : null,
      })
    } catch (e) {
      if (e instanceof ErreurSeance) setErreur(e.message)
      else {
        console.error('Affectation de la séance impossible', e)
        setErreur("L'affectation a échoué.")
      }
    } finally {
      setEnCours(false)
    }
  }, [affecter, cible, enCours, form, surSucces])

  return {
    cible, form, erreur, enCours, apercu,
    ouvrir, fermer, modifier, choisirMode, ajouterDate, retirerDate, confirmer,
  }
}
