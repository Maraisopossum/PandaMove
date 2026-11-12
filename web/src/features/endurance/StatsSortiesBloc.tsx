import { useState } from 'react'
import type { Sortie, Sport } from '../../core/db/repos/sorties'
import { PERIODES, type PeriodeId } from '../stats/periode'
import { distanceKm, formaterDate, formaterDuree } from './presentation'
import { calculerStats } from './statsSorties'

const MAINTENANT = () => new Date()

// Statistiques des sorties du sport affiché : période au choix, totaux, distance par semaine. Calcul dans statsSorties.ts.
export function StatsSortiesBloc({ sorties, sport, maintenant = MAINTENANT }: { sorties: Sortie[]; sport: Sport; maintenant?: () => Date }) {
  const [periode, setPeriode] = useState<PeriodeId>('30j')
  if (sorties.length === 0) return null
  const st = calculerStats(sorties, periode, maintenant())
  const maxSemaine = Math.max(1, ...st.semaines.map((w) => w.distanceM))
  return (
    <section className="sorties__stats" aria-label="Statistiques des sorties">
      <div role="group" aria-label="Période" className="outils__periodes">
        {PERIODES.map((p) => (
          <button key={p.id} type="button" className="outils__periode" aria-pressed={periode === p.id} onClick={() => setPeriode(p.id)}>
            {p.libelle}
          </button>
        ))}
      </div>
      {st.nombre === 0 ? (
        <p>Aucune sortie sur cette période.</p>
      ) : (
        <>
          <dl className="sorties__stats-grille">
            <div>
              <dt>Sorties</dt>
              <dd>{st.nombre}</dd>
            </div>
            <div>
              <dt>Distance</dt>
              <dd>{distanceKm(st.distanceM)} km</dd>
            </div>
            <div>
              <dt>Durée</dt>
              <dd>{formaterDuree(st.dureeS)}</dd>
            </div>
            <div>
              <dt>Dénivelé +</dt>
              <dd>{Math.round(st.denivelePosM)} m</dd>
            </div>
            {st.fcMoy !== null && (
              <div>
                <dt>FC moyenne</dt>
                <dd>{st.fcMoy} bpm</dd>
              </div>
            )}
            {st.plusLongue && (
              <div>
                <dt>Plus longue</dt>
                <dd>{distanceKm(st.plusLongue.distanceM)} km</dd>
                <dd className="outils__chiffre-detail">{formaterDate(st.plusLongue.date)}</dd>
              </div>
            )}
          </dl>
          {st.semaines.length > 1 && (
            <figure className="sorties__semaines">
              <svg viewBox={`0 0 ${st.semaines.length * 14} 60`} role="img" aria-label={`Distance par semaine, ${sport === 'course' ? 'course' : 'vélo'}, jusqu'à ${distanceKm(maxSemaine)} km`}>
                {st.semaines.map((w, i) => (
                  <rect key={w.lundi} x={i * 14 + 2} width={10} rx={2} y={58 - (w.distanceM / maxSemaine) * 54} height={Math.max(2, (w.distanceM / maxSemaine) * 54)} className="sorties__barre">
                    <title>{`Semaine du ${formaterDate(w.lundi)} : ${distanceKm(w.distanceM)} km`}</title>
                  </rect>
                ))}
              </svg>
              <figcaption className="outils__chiffre-detail">Distance par semaine</figcaption>
            </figure>
          )}
        </>
      )}
    </section>
  )
}
