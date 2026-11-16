import { Link } from 'react-router'
import { formaterDate } from '../endurance/presentation'
import { PERIODES } from '../stats/periode'
import { formaterChrono, LIBELLE_FORME } from './simulation'
import { useStatsHyrox } from './useStatsHyrox'

const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`

// Statistiques Hyrox dans l'écran Statistiques : simulations terminées de la période, temps passé, meilleur temps de la simulation
// complète et liste. Calculs dans calculsStatsHyrox.ts, lecture dans useStatsHyrox. Même présentation que les statistiques de course et de vélo.
export function StatsHyrox() {
  const h = useStatsHyrox()
  const st = h.stats
  return (
    <div className="stats-endurance stats-endurance--hyrox">
      <div role="group" aria-label="Période" className="stats-endurance__periodes">
        {PERIODES.map((p) => (
          <button key={p.id} type="button" className="stats-endurance__periode" aria-pressed={h.periode === p.id} onClick={() => h.choisirPeriode(p.id)}>
            {p.libelle}
          </button>
        ))}
      </div>

      {h.erreur && <p role="alert">{h.erreur}</p>}
      {!h.pret && <p role="status">Chargement…</p>}
      {st && st.nombre === 0 && (
        <p className="stats__vide">
          Aucune simulation Hyrox terminée sur cette période. <Link to="/hyrox">Ouvrir Hyrox</Link>
        </p>
      )}

      {st && st.nombre > 0 && (
        <>
          <section aria-labelledby="sh-resume" className="stats-endurance__carte">
            <h2 id="sh-resume">Résumé de la période</h2>
            <p className="stats-endurance__grand">
              <span className="stats-endurance__valeur">{st.nombre}</span>
              <span className="stats-endurance__legende">{st.nombre > 1 ? 'simulations terminées' : 'simulation terminée'}</span>
            </p>
            <dl className="stats-endurance__grille">
              <div>
                <dd>{formaterChrono(st.dureeS)}</dd>
                <dt>temps passé</dt>
              </div>
              <div>
                <dd>{st.moyenneS === null ? '—' : formaterChrono(st.moyenneS)}</dd>
                <dt>temps moyen</dt>
              </div>
              <div>
                <dd>{st.meilleureCompleteS === null ? '—' : formaterChrono(st.meilleureCompleteS)}</dd>
                <dt>meilleure simulation complète</dt>
              </div>
              <div>
                <dd>{[st.parForme.complete && `${st.parForme.complete} complète${st.parForme.complete > 1 ? 's' : ''}`, st.parForme.partielle && pluriel(st.parForme.partielle, 'partielle'), st.parForme.station && pluriel(st.parForme.station, 'station')].filter(Boolean).join(' · ')}</dd>
                <dt>formes</dt>
              </div>
            </dl>
          </section>

          <section aria-labelledby="sh-liste" className="stats-endurance__carte">
            <h2 id="sh-liste">Simulations</h2>
            <ul className="stats-endurance__liste">
              {st.liste.map((s) => (
                <li key={s.id}>
                  <Link to={`/hyrox/bilan/${s.id}`}>
                    <strong>{formaterChrono(s.totalS ?? 0)}</strong> · {LIBELLE_FORME[s.forme].split(' · ')[0]} · {formaterDate(s.debutAt.slice(0, 10))}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  )
}
