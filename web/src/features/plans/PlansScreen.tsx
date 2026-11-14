import { Link } from 'react-router'
import { formaterMinutes } from '../calendar/chargeCalendrier'
import { COULEUR_PHASE } from './couleursPhases'
import { LIBELLE_PHASE, regrouperPhases } from './phases'
import type { Plan } from './plan'
import { definitionMesure } from './reglagesPlans'
import { usePlans } from './usePlans'

const jour = (iso: string) => new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' }).format(new Date(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8), 12))
const heures = (min: number) => formaterMinutes(Math.round(min))

function Frise({ plan, courante }: { plan: Plan; courante: number }) {
  const pas = 10
  const hauteur = 150
  const base = hauteur - 20
  const maxi = Math.max(60, ...plan.semaines.map((s) => s.prevuMin))
  const echelle = (base - 24) / maxi
  const largeur = Math.max(320, plan.semaines.length * pas + 8)
  return (
    <svg className="plans__frise" viewBox={`0 0 ${largeur} ${hauteur}`} role="img" aria-label={`Volume prévu des ${plan.semaines.length} semaines du plan, ${plan.jalons.length} jalon${plan.jalons.length > 1 ? 's' : ''}`}>
      {plan.semaines.map((s, i) => {
        const x = 4 + i * pas
        const h = s.prevuMin * echelle
        const hr = Math.min(s.realiseMin, s.prevuMin) * echelle
        return (
          <g key={s.debut}>
            <rect x={x} y={base - h} width={7} height={h} rx={2} fill={COULEUR_PHASE[s.phase]} opacity={i >= courante ? 1 : 0.45} stroke={i === courante ? '#26262b' : undefined} strokeWidth={i === courante ? 2 : undefined} />
            {hr > 0 && <rect x={x + 2} y={base - hr} width={3} height={hr} fill="#fff" />}
            {s.jalon && (
              <g>
                <path d={`M${x + 3.5} ${base - h - 4}V8`} stroke="#26262b" strokeWidth={1.5} />
                <path d={`M${x + 3.5} 8h14l-3 4 3 4h-14z`} fill="#FFD60A" stroke="#26262b" strokeWidth={1} />
              </g>
            )}
          </g>
        )
      })}
      {plan.semaines
        .map((s, i) => ({ s, i }))
        .filter(({ s }) => +s.debut.slice(8) <= 7)
        .map(({ s, i }) => (
          <text key={s.debut} x={4 + i * pas} y={hauteur - 4} fontSize={9} fill="#5c5c66">
            {new Intl.DateTimeFormat('fr-FR', { month: 'short' }).format(new Date(+s.debut.slice(0, 4), +s.debut.slice(5, 7) - 1, 15))}
          </text>
        ))}
    </svg>
  )
}

// Plan d'endurance : frise du programme (volume prévu, phases déduites, jalons), où j'en suis, phases et règles de déduction.
// Toute la logique vit dans usePlans, plan.ts et phases.ts.
export default function PlansScreen() {
  const p = usePlans()
  const { plan, reglages } = p
  const phasesPresentes = plan ? [...new Set(plan.semaines.map((s) => s.phase))] : []
  const blocs = plan ? regrouperPhases(plan.semaines.map((s) => s.phase)) : []
  const r = p.realisation
  return (
    <div className="plans">
      <h1 className="titre-ecran">Plans</h1>
      {p.erreur && <p role="alert">{p.erreur}</p>}
      {p.pret && !plan && !p.erreur && (
        <p>
          Aucune séance de course ou de vélo n’est planifiée. Importez le programme depuis le <Link to="/calendar">Calendrier</Link> pour voir sa frise ici.
        </p>
      )}
      {plan && (
        <>
          <section className="plans__carte" aria-labelledby="plans-frise">
            <h2 id="plans-frise" className="plans__titre">
              Programme d’endurance <span className="plans__sous">{plan.semaines.length} semaines</span>
            </h2>
            <Frise plan={plan} courante={p.courante} />
            <ul className="plans__legende" aria-label="Légende des phases">
              {phasesPresentes.map((ph) => (
                <li key={ph}>
                  <span className="plans__pastille" style={{ background: COULEUR_PHASE[ph] }} aria-hidden="true" /> {LIBELLE_PHASE[ph]}
                </li>
              ))}
            </ul>
            <p className="aide">Barres : volume prévu par semaine. Trait blanc : déjà réalisé. Drapeau : jalon.</p>
          </section>

          <section className="plans__carte" aria-labelledby="plans-etat">
            <h2 id="plans-etat" className="plans__titre">Où j’en suis</h2>
            <div className="outils__chiffres">
              <div className="outils__chiffre">
                <span className="outils__chiffre-libelle">Semaine</span>
                <strong>{p.courante < 0 ? 'avant le plan' : p.courante >= plan.semaines.length ? 'plan terminé' : `${p.courante + 1} sur ${plan.semaines.length}`}</strong>
                {p.courante >= 0 && p.courante < plan.semaines.length && <span className="outils__chiffre-detail">{LIBELLE_PHASE[plan.semaines[p.courante].phase]}</span>}
              </div>
              <div className="outils__chiffre">
                <span className="outils__chiffre-libelle">Réalisation</span>
                <strong>{r && r.tauxPct !== null ? `${r.tauxPct} %` : '—'}</strong>
                <span className="outils__chiffre-detail">{definitionMesure(reglages.mesure)}</span>
              </div>
              <div className="outils__chiffre">
                <span className="outils__chiffre-libelle">Prochain jalon</span>
                <strong>{p.prochainJalon ? `J-${p.prochainJalon.jours}` : '—'}</strong>
                <span className="outils__chiffre-detail">{p.prochainJalon ? `${p.prochainJalon.nom}, ${jour(p.prochainJalon.date)}` : 'aucun à venir'}</span>
              </div>
            </div>
            {r && r.prevues > 0 && (
              <p className="aide">
                {r.faites} séance{r.faites > 1 ? 's' : ''} faite{r.faites > 1 ? 's' : ''} sur {r.prevues} prévue{r.prevues > 1 ? 's' : ''} jusqu’ici ({heures(r.realiseMin)} réalisées sur {heures(r.prevuMin)} prévues). Les séances facultatives ne comptent pas.
              </p>
            )}
            {p.reglages.seuilBonPct > 0 && r && r.tauxPct !== null && (
              <p className="plans__niveau" data-niveau={r.tauxPct >= reglages.seuilBonPct ? 'bon' : r.tauxPct >= reglages.seuilSurveillerPct ? 'moyen' : 'bas'}>
                {r.tauxPct >= reglages.seuilBonPct ? 'Réalisation bonne' : r.tauxPct >= reglages.seuilSurveillerPct ? 'Réalisation correcte' : 'Réalisation à surveiller'}
              </p>
            )}
          </section>

          <section className="plans__carte" aria-labelledby="plans-phases">
            <h2 id="plans-phases" className="plans__titre">
              Phases déduites <span className="plans__sous">{blocs.length}</span>
            </h2>
            <ul className="plans__phases">
              {blocs.map((b) => {
                const debut = plan.semaines[b.de]
                const fin = plan.semaines[b.a]
                const moyenne = plan.semaines.slice(b.de, b.a + 1).reduce((t, s) => t + s.prevuMin, 0) / (b.a - b.de + 1)
                return (
                  <li key={`${b.phase}-${b.de}`}>
                    <span className="plans__bande" style={{ background: COULEUR_PHASE[b.phase] }} aria-hidden="true" />
                    <span className="plans__phase-texte">
                      <strong>{LIBELLE_PHASE[b.phase]}</strong>
                      <span className="plans__phase-detail">
                        {b.de === b.a ? `semaine ${b.de + 1}` : `semaines ${b.de + 1} à ${b.a + 1}`} · {jour(debut.debut)}
                        {b.de === b.a ? '' : ` au ${jour(fin.debut)}`} · {heures(moyenne)} par semaine
                      </span>
                    </span>
                  </li>
                )
              })}
            </ul>
          </section>

          <section className="plans__carte" aria-labelledby="plans-jalons">
            <h2 id="plans-jalons" className="plans__titre">Jalons</h2>
            <ul className="plans__phases">
              {plan.jalons.map((j) => (
                <li key={j.seanceId}>
                  <span className="plans__phase-texte">
                    <strong>{j.nom}</strong>
                    <span className="plans__phase-detail">
                      {jour(j.date)} · semaine {j.semaine + 1} · {j.genre === 'course' ? 'course' : 'vélo'}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      <section className="plans__carte" aria-labelledby="plans-regles">
        <h2 id="plans-regles" className="plans__titre">Comment les phases sont déduites</h2>
        <ol className="plans__regles">
          <li><strong>Affûtage</strong> : la semaine d’un jalon et, au plus, les deux précédentes dont le volume est réduit d’au moins {reglages.reductionAffutagePct} % par rapport au maximum des quatre semaines d’avant.</li>
          <li><strong>Reprise</strong> : jusqu’à trois semaines après un jalon, tant que le volume reste sous 85 % de celui d’avant l’affûtage.</li>
          <li><strong>Base</strong> : les semaines de départ nettement sous le volume médian du plan.</li>
          <li><strong>Allégée</strong> : une semaine sous {reglages.allegeePct} % de la moyenne des trois précédentes.</li>
          <li><strong>Pic</strong> : les semaines les plus chargées avant le dernier jalon.</li>
          <li><strong>Spécifique</strong> : les semaines restantes entre l’avant-dernier et le dernier jalon.</li>
          <li><strong>Développement</strong> : tout le reste.</li>
        </ol>
        <p className="aide">Les phases se recalculent quand les séances changent. Les seuils se règlent dans les réglages.</p>
        <Link className="plans__lien" to="/plans/reglages">
          Réglages des plans
        </Link>
      </section>
    </div>
  )
}
