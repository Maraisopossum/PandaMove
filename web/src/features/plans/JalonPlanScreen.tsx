import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router'
import { dateIsoLocale } from '../../core/common/dates'
import { useAuth } from '../../core/auth/AuthProvider'
import { idObjectifDeJalon } from '../../core/db/repos/objectifsPlan'
import { formaterMinutes } from '../calendar/chargeCalendrier'
import { formaterTemps, lireTemps } from './echeances'
import { LIBELLE_PHASE } from './phases'
import { joursEntre, realisationEntre } from './plan'
import { useAccesPlans } from './useAccesPlans'
import { usePlans } from './usePlans'

const jour = (iso: string) => new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8), 12))
const jourCourt = (iso: string) => new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' }).format(new Date(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8), 12))
const NOM_DISCIPLINE = { course: 'Course', velo: 'Vélo', hyrox: 'Hyrox' } as const

// Page d'un jalon : compte à rebours, objectif, préparation restante, séances clés, puis le résultat et l'écart une fois la course faite.
export default function JalonPlanScreen() {
  const { cle = '' } = useParams()
  const { session } = useAuth()
  const aujourdhui = dateIsoLocale(new Date())
  const p = usePlans({ aujourdhui })
  const acces = useAccesPlans()
  const [cibleTexte, setCibleTexte] = useState<string | null>(null)
  const [resultatTexte, setResultatTexte] = useState<string | null>(null)
  const [erreur, setErreur] = useState('')
  const e = p.echeances.find((x) => x.cle === cle) ?? null
  const plan = p.plan
  const jours = e ? joursEntre(aujourdhui, e.date) : 0
  const semaineJalon = e?.semaine ?? null
  const restantes = plan && semaineJalon !== null ? Math.max(0, semaineJalon - Math.max(0, p.courante)) : null
  const aVenir = plan && semaineJalon !== null ? plan.semaines.slice(Math.max(0, p.courante), semaineJalon + 1) : []
  const chargeRestante = aVenir.reduce((t, s) => t + s.prevuMin, 0)
  const realise = plan && p.courante >= 0 ? realisationEntre(plan, 0, p.courante, p.reglages.mesure) : null
  const cles = plan && e && e.seanceId
    ? plan.semaines.flatMap((s) => s.seances).filter((s) => !s.optionnelle && !s.jalon && s.date >= aujourdhui && s.date < e.date && s.genre === (e.discipline === 'velo' ? 'velo' : 'course') && joursEntre(s.date, e.date) <= 56)
        .sort((a, b) => b.prevuMin - a.prevuMin).slice(0, 3).sort((a, b) => a.date.localeCompare(b.date))
    : []
  const cibleAffichee = cibleTexte ?? (e?.cibleS ? formaterTemps(e.cibleS) : '')
  const resultatAffiche = resultatTexte ?? (e?.resultatS ? formaterTemps(e.resultatS) : '')

  async function enregistrer(ev: FormEvent) {
    ev.preventDefault()
    if (!e) return
    setErreur('')
    const cibleS = cibleAffichee.trim() === '' ? null : lireTemps(cibleAffichee)
    const resultatS = resultatAffiche.trim() === '' ? null : lireTemps(resultatAffiche)
    if ((cibleAffichee.trim() !== '' && cibleS === null) || (resultatAffiche.trim() !== '' && resultatS === null)) {
      setErreur('Les temps doivent ressembler à 48:30 ou 1:10:00.')
      return
    }
    try {
      const saisie = { nom: e.nom, discipline: e.discipline, date: e.date, priorite: e.priorite, cibleS, resultatS, statut: resultatS !== null ? ('fait' as const) : e.statut, seanceId: e.seanceId }
      const id = e.objectifId ?? (e.seanceId && session?.user.id ? idObjectifDeJalon(session.user.id, e.seanceId) : null)
      await acces.enregistrerObjectifDeJalon(id, saisie)
      setCibleTexte(null)
      setResultatTexte(null)
      p.recharger()
    } catch {
      setErreur('L’enregistrement a échoué.')
    }
  }

  if (p.pret && !e) return <div className="plans"><h1 className="titre-ecran">Jalon</h1><p>Jalon introuvable. <Link to="/plans">Retour aux plans</Link></p></div>
  if (!e) return <div className="plans"><h1 className="titre-ecran">Jalon</h1></div>
  const ecart = e.resultatS !== null && e.cibleS !== null ? e.resultatS - e.cibleS : null
  return (
    <div className="plans">
      <h1 className="titre-ecran">{e.nom}</h1>
      <section className="plans__entete" aria-labelledby="jp-titre">
        <p className="plans__sur-titre">JALON · PRIORITÉ {e.priorite} · {NOM_DISCIPLINE[e.discipline].toUpperCase()}</p>
        <h2 id="jp-titre" className="plans__grand">{jours > 0 ? `J-${jours}` : jours === 0 ? 'Aujourd’hui' : e.statut === 'fait' ? 'Terminé' : `Il y a ${-jours} j`}</h2>
        <p>{jour(e.date)}</p>
        <div className="outils__chiffres">
          <div className="outils__chiffre"><span className="outils__chiffre-libelle">Objectif</span><strong>{e.cibleS ? formaterTemps(e.cibleS) : '—'}</strong></div>
          <div className="outils__chiffre"><span className="outils__chiffre-libelle">Semaine du plan</span><strong>{semaineJalon !== null && plan ? `${semaineJalon + 1} sur ${plan.semaines.length}` : '—'}</strong>{semaineJalon !== null && plan && <span className="outils__chiffre-detail">{LIBELLE_PHASE[plan.semaines[semaineJalon].phase]}</span>}</div>
        </div>
      </section>

      {restantes !== null && e.statut === 'prevu' && jours >= 0 && (
        <section className="plans__carte" aria-labelledby="jp-prep">
          <h2 id="jp-prep" className="plans__titre">Préparation restante</h2>
          <div className="outils__chiffres">
            <div className="outils__chiffre"><span className="outils__chiffre-libelle">Semaines</span><strong>{restantes}</strong></div>
            <div className="outils__chiffre"><span className="outils__chiffre-libelle">Charge prévue</span><strong>{formaterMinutes(chargeRestante)}</strong></div>
            <div className="outils__chiffre"><span className="outils__chiffre-libelle">Réalisé jusqu’ici</span><strong>{realise && realise.tauxPct !== null ? `${realise.tauxPct} %` : '—'}</strong></div>
          </div>
        </section>
      )}

      {cles.length > 0 && jours >= 0 && (
        <section className="plans__carte" aria-labelledby="jp-cles">
          <h2 id="jp-cles" className="plans__titre">Séances clés avant le jour</h2>
          <ul className="plans__phases">
            {cles.map((s) => (
              <li key={s.id}><span className="plans__phase-texte"><strong>{jourCourt(s.date)}</strong><span className="plans__phase-detail">{s.titre} · {formaterMinutes(s.prevuMin)}</span></span></li>
            ))}
          </ul>
          <p className="aide">Les trois plus longues séances du même sport sur les huit semaines qui précèdent.</p>
        </section>
      )}

      <section className="plans__carte" aria-labelledby="jp-res">
        <h2 id="jp-res" className="plans__titre">{e.statut === 'fait' ? 'Résultat' : 'Après la course'}</h2>
        <form className="plans__formulaire" onSubmit={(ev) => void enregistrer(ev)}>
          <label className="formulaire__champ">
            Temps visé
            <input value={cibleAffichee} onChange={(ev) => setCibleTexte(ev.target.value)} placeholder="48:30 ou 1:10:00" inputMode="numeric" />
          </label>
          <label className="formulaire__champ">
            Temps officiel
            <input value={resultatAffiche} onChange={(ev) => setResultatTexte(ev.target.value)} placeholder="48:30 ou 1:10:00" inputMode="numeric" />
          </label>
          {ecart !== null && (
            <p className="plans__niveau" data-niveau={ecart <= 0 ? 'bon' : 'moyen'} role="status">
              {ecart === 0 ? 'Objectif atteint pile.' : ecart < 0 ? `${formaterTemps(-ecart)} sous l’objectif.` : `${formaterTemps(ecart)} au-dessus de l’objectif.`}
            </p>
          )}
          {erreur && <p role="alert">{erreur}</p>}
          <button type="submit" className="bouton bouton--principal">Enregistrer</button>
        </form>
        {e.objectifId && e.cle.startsWith('o-') && <Link className="plans__lien" to={`/plans/objectif/${e.objectifId}`}>Modifier l’objectif</Link>}
      </section>
    </div>
  )
}
