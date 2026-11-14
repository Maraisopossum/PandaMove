import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { formaterMinutes, libelleSemaine } from '../calendar/chargeCalendrier'
import { LIBELLE_PHASE } from './phases'
import { proposerRattachements, realisationEntre, type EtatSeance } from './plan'
import { usePlans } from './usePlans'

const ETAT: Record<EtatSeance, { libelle: string; niveau: string }> = {
  faite: { libelle: 'Faite', niveau: 'bon' },
  autrement: { libelle: 'Faite autrement', niveau: 'moyen' },
  manquee: { libelle: 'Manquée', niveau: 'bas' },
  facultative: { libelle: 'Facultative', niveau: 'neutre' },
  aVenir: { libelle: 'À venir', niveau: 'neutre' },
}

const jourCourt = (iso: string) => new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric' }).format(new Date(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8), 12))
const nombre = (n: number) => (Math.round(n * 10) / 10).toString().replace('.', ',')

// Semaine du plan : prévu contre réalisé, état de chaque séance et rattachement des sorties (proposé, jamais appliqué sans confirmation).
export default function SemainePlanScreen() {
  const { debut } = useParams()
  const navigate = useNavigate()
  const p = usePlans()
  const [ecartees, setEcartees] = useState<string[]>([])
  const { plan } = p
  const indice = plan ? (debut ? plan.semaines.findIndex((s) => s.debut === debut) : Math.min(Math.max(p.courante, 0), plan.semaines.length - 1)) : -1
  const semaine = plan && indice >= 0 ? plan.semaines[indice] : null
  const r = plan && semaine ? realisationEntre(plan, indice, indice, p.reglages.mesure) : null
  const propositions = semaine && p.reglages.proposerRattachement ? proposerRattachements(semaine, p.sorties).filter((x) => !ecartees.includes(x.sortie.id)) : []
  const aller = (i: number) => plan && navigate(`/plans/semaine/${plan.semaines[i].debut}`)
  return (
    <div className="plans">
      <h1 className="titre-ecran">Semaine du plan</h1>
      {p.erreur && <p role="alert">{p.erreur}</p>}
      {p.erreurAction && <p role="alert">{p.erreurAction}</p>}
      {p.pret && !semaine && !p.erreur && (
        <p>
          {plan ? 'Cette semaine ne fait pas partie du plan.' : 'Aucune séance de course ou de vélo n’est planifiée.'} <Link to="/plans">Retour aux plans</Link>
        </p>
      )}
      {plan && semaine && r && (
        <>
          <nav className="plans__semaines" aria-label="Changer de semaine">
            <button type="button" className="bouton" disabled={indice === 0} onClick={() => aller(indice - 1)} aria-label="Semaine précédente">←</button>
            <span className="plans__semaine-titre">
              <strong>Semaine {semaine.rang} sur {plan.semaines.length}</strong>
              <span className="plans__phase-detail">{libelleSemaine(semaine.debut)} · {LIBELLE_PHASE[semaine.phase]}</span>
            </span>
            <button type="button" className="bouton" disabled={indice === plan.semaines.length - 1} onClick={() => aller(indice + 1)} aria-label="Semaine suivante">→</button>
          </nav>

          <section className="plans__carte" aria-labelledby="sp-bilan">
            <h2 id="sp-bilan" className="plans__titre">Prévu et réalisé</h2>
            <div className="outils__chiffres">
              <div className="outils__chiffre">
                <span className="outils__chiffre-libelle">Prévu</span>
                <strong>{formaterMinutes(semaine.prevuMin)}</strong>
              </div>
              <div className="outils__chiffre">
                <span className="outils__chiffre-libelle">Réalisé</span>
                <strong>{formaterMinutes(semaine.realiseMin)}</strong>
              </div>
              <div className="outils__chiffre">
                <span className="outils__chiffre-libelle">Réalisation</span>
                <strong>{r.tauxPct === null ? '—' : `${r.tauxPct} %`}</strong>
                <span className="outils__chiffre-detail">{r.prevues > 0 ? `${nombre(r.faites)} sur ${r.prevues} échue${r.prevues > 1 ? 's' : ''}` : 'aucune séance échue'}</span>
              </div>
            </div>
          </section>

          {propositions.length > 0 && (
            <section className="plans__carte" aria-labelledby="sp-rattach">
              <h2 id="sp-rattach" className="plans__titre">Sorties à rattacher</h2>
              {propositions.map(({ sortie, seance }) => (
                <div key={sortie.id} className="plans__proposition">
                  <p>
                    La sortie « {sortie.titre} » du {jourCourt(sortie.date)}{sortie.dureeS ? ` (${formaterMinutes(Math.round(sortie.dureeS / 60))})` : ''} ressemble à <strong>{seance.titre}</strong> ({jourCourt(seance.date)}). La rattacher ?
                  </p>
                  <div className="plans__actions">
                    <button type="button" className="bouton bouton--principal" onClick={() => void p.rattacher(sortie.id, seance.id, seance.genre)}>
                      Rattacher
                    </button>
                    <button type="button" className="bouton" onClick={() => setEcartees((l) => [...l, sortie.id])}>
                      Non, hors plan
                    </button>
                  </div>
                </div>
              ))}
              <p className="aide">Une sortie n’est jamais rattachée sans votre confirmation. Rattacher valide la séance.</p>
            </section>
          )}

          <section className="plans__carte" aria-labelledby="sp-seances">
            <h2 id="sp-seances" className="plans__titre">Séances de la semaine</h2>
            {semaine.seances.length === 0 ? (
              <p>Aucune séance prévue cette semaine.</p>
            ) : (
              <ul className="plans__seances">
                {semaine.seances.map((s) => (
                  <li key={s.id}>
                    <strong className="plans__jour">{jourCourt(s.date)}</strong>
                    <span className="plans__phase-texte">
                      <span>{s.genre === 'course' ? 'Course' : 'Vélo'} · {s.titre}{s.jalon ? ' (jalon)' : ''}</span>
                      <span className="plans__phase-detail">
                        {formaterMinutes(s.prevuMin)} prévues{s.etat === 'faite' || s.etat === 'autrement' ? ` · ${formaterMinutes(s.realiseMin)} faites` : ''}
                      </span>
                    </span>
                    <span className="plans__etat" data-niveau={ETAT[s.etat].niveau}>{ETAT[s.etat].libelle}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="plans__carte" aria-labelledby="sp-lecture">
            <h2 id="sp-lecture" className="plans__titre">Comment lire les états</h2>
            <ul className="plans__regles">
              <li><strong>Faite</strong> : durée d’au moins {p.reglages.dureeMinPct} % du prévu, ou séance validée sans sortie.</li>
              <li><strong>Faite autrement</strong> : sortie plus courte que ce seuil ; compte pour {p.reglages.autrementPct} %.</li>
              <li><strong>Manquée</strong> : jour passé sans séance validée.</li>
              <li><strong>Facultative</strong> : ne compte jamais comme manquée.</li>
            </ul>
            <Link className="plans__lien" to="/plans/reglages">Réglages des plans</Link>
          </section>
        </>
      )}
    </div>
  )
}
