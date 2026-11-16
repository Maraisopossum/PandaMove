import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { dateIsoLocale } from '../../core/common/dates'
import { getDb } from '../../core/db/client'
import {
  creerObjectifPlan, ErreurObjectif, lireObjectifPlan, modifierObjectifPlan, supprimerObjectifPlan, DISCIPLINES, PRIORITES, type DisciplineObjectif, type PrioriteObjectif,
} from '../../core/db/repos/objectifsPlan'
import { conflitsAvec, formaterTemps, lireTemps, SEUIL_CONFLIT_JOURS } from './echeances'
import { usePlans } from './usePlans'

const LIBELLE_DISCIPLINE: Record<DisciplineObjectif, string> = { course: 'Course', velo: 'Vélo', hyrox: 'Hyrox' }
const LIBELLE_PRIORITE: Record<PrioriteObjectif, string> = { A: 'A · objectif principal', B: 'B · course de préparation', C: 'C · pour le plaisir' }
const jour = (iso: string) => new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8), 12))

// Nouvel objectif (ou modification) : une échéance datée, avec détection des conflits de jalons. Un conflit est signalé, jamais refusé :
// l'enregistrement reste possible.
export default function ObjectifPlanScreen() {
  const { id } = useParams()
  const navigate = useNavigate()
  const p = usePlans()
  const [nom, setNom] = useState('')
  const [discipline, setDiscipline] = useState<DisciplineObjectif>('course')
  const [date, setDate] = useState(dateIsoLocale(new Date()))
  const [priorite, setPriorite] = useState<PrioriteObjectif>('B')
  const [cible, setCible] = useState('')
  const [statut, setStatut] = useState<'prevu' | 'fait' | 'abandonne'>('prevu')
  const [erreur, setErreur] = useState('')
  const [introuvable, setIntrouvable] = useState(false)
  const [charge, setCharge] = useState(!id)

  useEffect(() => {
    if (!id) return
    let annule = false
    lireObjectifPlan(getDb(), id).then((o) => {
      if (annule) return
      if (!o) {
        setIntrouvable(true)
        return
      }
      setNom(o.nom)
      setDiscipline(o.discipline)
      setDate(o.date)
      setPriorite(o.priorite)
      setCible(o.cibleS ? formaterTemps(o.cibleS) : '')
      setStatut(o.statut)
      setCharge(true)
    }).catch(() => !annule && setErreur('Impossible de lire l’objectif.'))
    return () => {
      annule = true
    }
  }, [id])

  const conflits = p.reglages.alerteJalons ? conflitsAvec(date, p.echeances, id ? `o-${id}` : undefined) : []

  async function enregistrer(e: FormEvent) {
    e.preventDefault()
    setErreur('')
    const cibleS = cible.trim() === '' ? null : lireTemps(cible)
    if (cible.trim() !== '' && cibleS === null) {
      setErreur('Le temps visé doit ressembler à 48:30 ou 1:10:00.')
      return
    }
    try {
      const saisie = { nom, discipline, date, priorite, cibleS, statut }
      if (id) await modifierObjectifPlan(getDb(), id, saisie)
      else await creerObjectifPlan(getDb(), saisie)
      navigate('/plans', { replace: true })
    } catch (err) {
      setErreur(err instanceof ErreurObjectif ? err.message : 'L’enregistrement a échoué.')
    }
  }

  async function supprimer() {
    if (!id) return
    try {
      await supprimerObjectifPlan(getDb(), id)
      navigate('/plans', { replace: true })
    } catch {
      setErreur('La suppression a échoué.')
    }
  }

  if (introuvable) return <div className="plans"><h1 className="titre-ecran">Objectif</h1><p>Objectif introuvable. <Link to="/plans">Retour aux plans</Link></p></div>
  return (
    <div className="plans">
      <h1 className="titre-ecran">{id ? 'Modifier l’objectif' : 'Nouvel objectif'}</h1>
      {charge && (
        <form className="plans__formulaire" onSubmit={(e) => void enregistrer(e)}>
          <label className="formulaire__champ">
            Nom
            <input value={nom} onChange={(e) => setNom(e.target.value)} maxLength={200} required />
          </label>
          <label className="formulaire__champ">
            Discipline
            <select value={discipline} onChange={(e) => setDiscipline(e.target.value as DisciplineObjectif)}>
              {DISCIPLINES.map((d) => <option key={d} value={d}>{LIBELLE_DISCIPLINE[d]}</option>)}
            </select>
          </label>
          <label className="formulaire__champ">
            Date
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </label>
          <label className="formulaire__champ">
            Priorité
            <select value={priorite} onChange={(e) => setPriorite(e.target.value as PrioriteObjectif)}>
              {PRIORITES.map((q) => <option key={q} value={q}>{LIBELLE_PRIORITE[q]}</option>)}
            </select>
          </label>
          <label className="formulaire__champ">
            Temps visé (facultatif)
            <input value={cible} onChange={(e) => setCible(e.target.value)} placeholder="48:30 ou 1:10:00" inputMode="numeric" />
          </label>
          {id && (
            <label className="formulaire__champ">
              Statut
              <select value={statut} onChange={(e) => setStatut(e.target.value as typeof statut)}>
                <option value="prevu">Prévu</option>
                <option value="fait">Fait</option>
                <option value="abandonne">Abandonné</option>
              </select>
            </label>
          )}

          {conflits.length > 0 && (
            <div className="plans__conflit" role="alert">
              <strong>Trop proche d’une autre échéance</strong>
              <ul>
                {conflits.map(({ echeance, jours }) => (
                  <li key={echeance.cle}>
                    {echeance.nom} ({jour(echeance.date)}) : {jours === 0 ? 'le même jour' : `${jours} jour${jours > 1 ? 's' : ''} d’écart`}
                  </li>
                ))}
              </ul>
              <p className="aide">Deux échéances à moins de {SEUIL_CONFLIT_JOURS} jours rendent leurs affûtages incompatibles. Changez la date, ou baissez la priorité de l’une des deux. L’enregistrement reste possible.</p>
            </div>
          )}

          {erreur && <p role="alert">{erreur}</p>}
          <button type="submit" className="bouton bouton--principal">{conflits.length > 0 ? 'Enregistrer quand même' : 'Enregistrer'}</button>
          <Link className="plans__lien" to="/plans" replace>Annuler</Link>
          {id && <button type="button" className="bouton bouton--alerte" onClick={() => void supprimer()}>Supprimer l’objectif</button>}
        </form>
      )}
    </div>
  )
}
