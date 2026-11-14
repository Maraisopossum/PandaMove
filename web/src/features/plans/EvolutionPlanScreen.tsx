import { useState } from 'react'
import { Link } from 'react-router'
import { formaterMinutes } from '../calendar/chargeCalendrier'
import { definitionMesure } from './reglagesPlans'
import { realisationEntre, semainesSousSeuil, tauxGlissant } from './plan'
import { usePlans } from './usePlans'

type Periode = 4 | 8 | 0

const PERIODES: { id: Periode; libelle: string }[] = [
  { id: 4, libelle: '4 semaines' },
  { id: 8, libelle: '8 semaines' },
  { id: 0, libelle: 'Tout le plan' },
]

// Évolution du plan dans le temps : taux de réalisation (mesure principale, 4 semaines glissantes), volume prévu et réalisé,
// sortie la plus longue contre le jalon final.
export default function EvolutionPlanScreen() {
  const p = usePlans()
  const [periode, setPeriode] = useState<Periode>(8)
  const { plan, reglages, courante } = p
  const fin = plan ? Math.min(courante, plan.semaines.length - 1) : -1
  const debut = periode === 0 ? 0 : Math.max(0, fin - periode + 1)
  const semaines = plan ? plan.semaines.slice(debut, fin + 1) : []
  const glissant = plan && fin >= 0 ? tauxGlissant(plan, fin, reglages.mesure).slice(debut) : []
  const dernier = glissant.length ? glissant[glissant.length - 1].tauxPct : null
  const maxVol = Math.max(60, ...semaines.map((s) => Math.max(s.prevuMin, s.realiseMin)))
  const sousSeuil = plan && fin >= 0 ? semainesSousSeuil(plan, fin, reglages.mesure, reglages.seuilSurveillerPct) : 0
  const total = plan && fin >= 0 ? realisationEntre(plan, debut, fin, reglages.mesure) : null
  const jalonFinal = plan && plan.jalons.length ? plan.jalons[plan.jalons.length - 1] : null
  const sortiesDuSport = jalonFinal ? p.sorties.filter((s) => s.sport === jalonFinal.genre && s.dureeS) : []
  const plusLongue = sortiesDuSport.reduce((m, s) => Math.max(m, Math.round((s.dureeS ?? 0) / 60)), 0)
  const prevuJalon = jalonFinal && plan ? plan.semaines[jalonFinal.semaine].seances.find((s) => s.id === jalonFinal.seanceId)?.prevuMin ?? null : null
  const xs = (i: number, n: number) => 20 + (n <= 1 ? 140 : (i * 280) / (n - 1))
  const y = (t: number) => 100 - (Math.min(Math.max(t, 50), 100) - 50) * 1.6
  const points = glissant.flatMap((g, i) => (g.tauxPct === null ? [] : [{ x: xs(i, glissant.length), y: y(g.tauxPct), t: g.tauxPct, rang: g.rang }]))
  return (
    <div className="plans">
      <h1 className="titre-ecran">Évolution du plan</h1>
      {p.erreur && <p role="alert">{p.erreur}</p>}
      {p.pret && !plan && !p.erreur && <p>Aucune séance de course ou de vélo n’est planifiée. <Link to="/plans">Retour aux plans</Link></p>}
      {plan && courante < 0 && <p>Le plan n’a pas encore commencé.</p>}
      {plan && courante >= 0 && (
        <>
          <div role="group" aria-label="Période" className="outils__periodes">
            {PERIODES.map((o) => (
              <button key={o.id} type="button" className="outils__periode" aria-pressed={periode === o.id} onClick={() => setPeriode(o.id)}>
                {o.libelle}
              </button>
            ))}
          </div>

          <section className="plans__carte" aria-labelledby="ev-taux">
            <h2 id="ev-taux" className="plans__titre">Taux de réalisation <span className="plans__sous">mesure principale</span></h2>
            <p className="plans__grand">{dernier === null ? '—' : `${dernier} %`} <span className="plans__sous">sur les 4 dernières semaines</span></p>
            {points.length > 0 ? (
              <svg className="plans__frise" viewBox="0 0 320 125" role="img" aria-label={`Taux de réalisation de ${points[0].t} % à ${points[points.length - 1].t} % sur ${points.length} semaine${points.length > 1 ? 's' : ''}`}>
                <line x1="14" x2="310" y1={y(reglages.seuilBonPct)} y2={y(reglages.seuilBonPct)} stroke="#7fb77f" strokeDasharray="4 4" />
                <line x1="14" x2="310" y1={y(reglages.seuilSurveillerPct)} y2={y(reglages.seuilSurveillerPct)} stroke="#d49a62" strokeDasharray="4 4" />
                <polyline points={points.map((q) => `${q.x},${q.y}`).join(' ')} fill="none" stroke="#2E7D32" strokeWidth={3} />
                {points.map((q) => <circle key={q.rang} cx={q.x} cy={q.y} r={4} fill="#2E7D32" />)}
                <text x="14" y="120" fontSize="10" fill="#5c5c66">S{points[0].rang}</text>
                <text x="306" y="120" textAnchor="end" fontSize="10" fill="#5c5c66">S{points[points.length - 1].rang}</text>
              </svg>
            ) : (
              <p className="aide">Pas encore de séance échue : la courbe apparaît après la première séance.</p>
            )}
            <p className="aide">Mesure retenue : <strong>{definitionMesure(reglages.mesure)}</strong>. Vert à partir de {reglages.seuilBonPct} %, à surveiller sous {reglages.seuilSurveillerPct} %. <Link to="/plans/reglages">Changer</Link></p>
            {reglages.prevenirTroisSemaines && sousSeuil >= 3 && (
              <p className="plans__niveau" data-niveau="bas" role="status">{sousSeuil} semaines de suite sous {reglages.seuilSurveillerPct} % : alléger ou décaler le plan peut aider.</p>
            )}
          </section>

          <section className="plans__carte" aria-labelledby="ev-vol">
            <h2 id="ev-vol" className="plans__titre">Volume prévu et réalisé</h2>
            <ul className="plans__barres" aria-label="Volume par semaine">
              {semaines.map((s) => (
                <li key={s.debut} aria-label={`Semaine ${s.rang} : ${formaterMinutes(s.prevuMin)} prévues, ${formaterMinutes(s.realiseMin)} réalisées`}>
                  <span className="plans__barre plans__barre--prevu" style={{ height: `${(s.prevuMin / maxVol) * 100}%` }} />
                  <span className="plans__barre plans__barre--realise" style={{ height: `${(s.realiseMin / maxVol) * 100}%` }} />
                  <span className="plans__barre-rang" aria-hidden="true">{s.rang}</span>
                </li>
              ))}
            </ul>
            <p className="plans__legende-ligne"><span className="plans__pastille" style={{ background: '#c9c9d1' }} aria-hidden="true" /> prévu <span className="plans__pastille" style={{ background: '#2E7D32' }} aria-hidden="true" /> réalisé</p>
            {total && (
              <div className="outils__chiffres">
                <div className="outils__chiffre"><span className="outils__chiffre-libelle">Prévu (échu)</span><strong>{formaterMinutes(total.prevuMin)}</strong></div>
                <div className="outils__chiffre"><span className="outils__chiffre-libelle">Réalisé</span><strong>{formaterMinutes(total.realiseMin)}</strong></div>
              </div>
            )}
          </section>

          {jalonFinal && (
            <section className="plans__carte" aria-labelledby="ev-long">
              <h2 id="ev-long" className="plans__titre">Sortie longue vers {jalonFinal.nom}</h2>
              <p>
                Plus longue sortie de {jalonFinal.genre === 'course' ? 'course' : 'vélo'} : <strong>{plusLongue > 0 ? formaterMinutes(plusLongue) : '—'}</strong>
                {prevuJalon ? <> sur les <strong>{formaterMinutes(prevuJalon)}</strong> du jalon.</> : '.'}
              </p>
              {prevuJalon && <progress className="plans__progression" max={prevuJalon} value={Math.min(plusLongue, prevuJalon)} aria-label="Plus longue sortie rapportée à la durée du jalon" />}
            </section>
          )}
        </>
      )}
    </div>
  )
}
