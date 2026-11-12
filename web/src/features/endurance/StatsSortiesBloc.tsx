import { useState } from 'react'
import type { Sortie } from '../../core/db/repos/sorties'
import { PERIODES, type PeriodeId } from '../stats/periode'
import { distanceKm, formaterDateCourte, formaterDuree } from './presentation'
import { calculerStats } from './statsSorties'

const MAINTENANT = () => new Date()
const LIBELLE_COURT: Record<PeriodeId, string> = { '7j': '7 j', '30j': '1 mois', '3m': '3 mois', '12m': '12 mois', tout: 'Tout' }

// Bilan du sport affiché : période au choix, distance en grand, trois chiffres, distance par semaine (64 px de haut).
// Calcul dans statsSorties.ts.
export function StatsSortiesBloc({ sorties, maintenant = MAINTENANT }: { sorties: Sortie[]; maintenant?: () => Date }) {
  const [periode, setPeriode] = useState<PeriodeId>('30j')
  if (sorties.length === 0) return null
  const st = calculerStats(sorties, periode, maintenant())
  const maxSemaine = Math.max(1, ...st.semaines.map((w) => w.distanceM))
  const puissance = (() => {
    const avec = sorties.filter((s) => s.puissanceMoyW !== null)
    return avec.length ? Math.round(avec.reduce((t, s) => t + (s.puissanceMoyW as number), 0) / avec.length) : null
  })()
  const pas = 330 / Math.max(1, st.semaines.length)
  return (
    <section className="sorties__stats" aria-label="Bilan des sorties">
      <div role="group" aria-label="Période" className="sorties__periodes">
        {PERIODES.map((p) => (
          <button key={p.id} type="button" className="sorties__periode" aria-pressed={periode === p.id} onClick={() => setPeriode(p.id)}>
            {LIBELLE_COURT[p.id]}
          </button>
        ))}
      </div>
      {st.nombre === 0 ? (
        <p className="sorties__stats-carte">Aucune sortie sur cette période.</p>
      ) : (
        <div className="sorties__stats-carte">
          <p className="sorties__stats-grand">
            <span className="sorties__stats-valeur">{distanceKm(st.distanceM).replace(/,00$/, '')}</span>
            <span className="sorties__stats-legende">
              km en {st.nombre} sortie{st.nombre > 1 ? 's' : ''}
            </span>
          </p>
          <dl className="sorties__stats-trio">
            <div>
              <dt>durée</dt>
              <dd>{formaterDuree(st.dureeS)}</dd>
            </div>
            <div>
              <dt>dénivelé +</dt>
              <dd>{Math.round(st.denivelePosM)} m</dd>
            </div>
            {st.fcMoy !== null ? (
              <div>
                <dt>FC moy. (bpm)</dt>
                <dd>{st.fcMoy}</dd>
              </div>
            ) : puissance !== null ? (
              <div>
                <dt>puissance moy.</dt>
                <dd>{puissance} W</dd>
              </div>
            ) : null}
          </dl>
          {st.semaines.length > 1 && (
            <figure className="sorties__semaines">
              <svg viewBox="0 0 330 64" preserveAspectRatio="none" role="img" aria-label={`Distance par semaine, jusqu'à ${distanceKm(maxSemaine)} km`}>
                {st.semaines.map((w, i) => {
                  const h = Math.max(6, (w.distanceM / maxSemaine) * 58)
                  return (
                    <rect key={w.lundi} x={i * pas + pas * 0.15} width={pas * 0.7} rx={3} y={62 - h} height={h} className={w.distanceM === 0 ? 'sorties__barre sorties__barre--vide' : 'sorties__barre'}>
                      <title>{`Semaine du ${formaterDateCourte(w.lundi)} : ${distanceKm(w.distanceM)} km`}</title>
                    </rect>
                  )
                })}
              </svg>
              <figcaption className="sorties__semaines-dates" aria-hidden="true">
                <span>{formaterDateCourte(st.semaines[0].lundi)}</span>
                <span>{formaterDateCourte(st.semaines[st.semaines.length - 1].lundi)}</span>
              </figcaption>
            </figure>
          )}
        </div>
      )}
    </section>
  )
}
