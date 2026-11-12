import { useState } from 'react'
import { useAuth } from '../../core/auth/AuthProvider'
import { StatsEndurance } from '../endurance/StatsEndurance'
import { degradeEchelle } from './heatmapZones'
import { MuscleHeatmap } from './MuscleHeatmap'
import { PERIODES } from './periode'
import { formaterDate, formaterNombre, formaterTonnage, formaterValeur, libelleSeries } from './presentation'
import { useStats } from './useStats'

const VUES = [
  { id: 'face', libelle: 'Face' },
  { id: 'dos', libelle: 'Dos' },
] as const

// Où voir le groupe sur la figure : une vue, les deux, ou aucune
const lieu = (traces: { face?: string; dos?: string }) =>
  traces.face && traces.dos ? 'face et dos' : traces.face ? 'face' : traces.dos ? 'dos' : 'hors figure'

const pluriel = (n: number, mot: string) => `${mot}${n > 1 ? 's' : ''}`

const VUES_STATS = [
  { id: 'renfo', libelle: 'Renforcement' },
  { id: 'course', libelle: 'Course' },
  { id: 'velo', libelle: 'Vélo' },
] as const

// Écran Statistiques : trois vues, renforcement (séances jouées), course et vélo (sorties). Chaque vue garde ses propres
// calculs : les sorties n'entrent jamais dans les statistiques de renforcement.
export default function StatsScreen() {
  const [vue, setVue] = useState<(typeof VUES_STATS)[number]['id']>('renfo')
  return (
    <>
      <h1 className="titre-ecran">Statistiques</h1>
      <div role="group" aria-label="Type de statistiques" className="stats__vues">
        {VUES_STATS.map((v) => (
          <button key={v.id} type="button" className="stats__vue" aria-pressed={vue === v.id} onClick={() => setVue(v.id)}>
            {v.libelle}
          </button>
        ))}
      </div>
      {vue === 'renfo' ? <StatsRenforcement /> : <StatsEndurance key={vue} sport={vue} />}
    </>
  )
}

// Statistiques renforcement : période, résumé, heatmap musculaire et historique d'un exercice.
// La logique vit dans useStats / presentation : ce composant ne fait qu'afficher.
function StatsRenforcement() {
  const { session } = useAuth()
  const s = useStats({ userId: session?.user.id })
  const g = s.graphique

  return (
    <>
      <div role="group" aria-label="Période" className="formulaire__ligne stats__periodes">
        {PERIODES.map((p) => (
          <button key={p.id} type="button" className="bouton" aria-pressed={s.periode === p.id} onClick={() => s.choisirPeriode(p.id)}>
            {p.libelle}
          </button>
        ))}
      </div>

      {s.erreur && (
        <p role="alert" className="import__erreur">
          {s.erreur}
        </p>
      )}

      {!s.pret ? (
        <p>Chargement…</p>
      ) : s.erreur ? null : s.vide ? (
        <p className="stats__vide">Aucune séance terminée sur cette période.</p>
      ) : (
        <div aria-busy={s.chargement}>
          <section aria-labelledby="stats-resume" className="stats__section">
            <h2 id="stats-resume">Résumé de la période</h2>
            <div className="stats__resume">
              <p className="stats__tonnage">
                <span className="stats__valeur stats__valeur--grande">{formaterTonnage(s.resume.tonnageKg)}</span>
                <span className="stats__libelle">Tonnage</span>
              </p>
              <div className="stats__trio">
                <div>
                  <p className="stats__valeur">{s.resume.seancesTerminees}</p>
                  <p className="stats__libelle">{pluriel(s.resume.seancesTerminees, 'séance')} {pluriel(s.resume.seancesTerminees, 'terminée')}</p>
                </div>
                <div>
                  <p className="stats__valeur">{s.resume.seriesTotal}</p>
                  <p className="stats__libelle">{pluriel(s.resume.seriesTotal, 'série')}</p>
                </div>
                <div>
                  <p className="stats__valeur">{formaterNombre(s.resume.repsTotal)}</p>
                  <p className="stats__libelle">{pluriel(s.resume.repsTotal, 'répétition')}</p>
                </div>
              </div>
            </div>
          </section>

          <section aria-labelledby="stats-muscles" className="stats__section stats__section--carte">
            <div className="stats__entete-carte">
              <h2 id="stats-muscles">Muscles travaillés</h2>
              <div role="group" aria-label="Vue de la figure" className="segmente">
                {VUES.map((v) => (
                  <button key={v.id} type="button" className="bouton" aria-pressed={s.vue === v.id} onClick={() => s.setVue(v.id)}>
                    {v.libelle}
                  </button>
                ))}
              </div>
            </div>
            <MuscleHeatmap image={s.image} vue={s.vue} zones={s.zonesVue} />
            <div
              className="heatmap__echelle"
              role="img"
              aria-label="Échelle d'intensité des muscles : de faible à intense, selon le nombre de séries sur la période"
            >
              <span className="heatmap__echelle-borne">Faible</span>
              <span className="heatmap__echelle-barre" style={{ background: degradeEchelle() }} aria-hidden="true" />
              <span className="heatmap__echelle-borne heatmap__echelle-borne--fin">Intense</span>
            </div>
            <ul className="stats__barres" aria-label="Séries par groupe musculaire">
              {s.groupes.map((m) => (
                <li key={m.groupe} className="stats__barre">
                  <span className="stats__barre-nom">
                    {m.libelle} <span className="stats__barre-lieu">({lieu(m.traces)})</span>
                  </span>
                  <span className="stats__barre-piste" aria-hidden="true">
                    <span className="stats__barre-remplie" style={{ width: `${Math.round(m.ratio * 100)}%`, background: m.couleur ?? 'transparent' }} />
                  </span>
                  <span className="stats__barre-valeur">{libelleSeries(m.series)}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}

      {s.pret && (
        <section aria-labelledby="stats-historique" className="stats__section stats__section--carte">
          <h2 id="stats-historique">Historique d'un exercice</h2>
          {s.erreurHistorique && (
            <p role="alert" className="import__erreur">
              {s.erreurHistorique}
            </p>
          )}
          {s.exercices.length === 0 ? (
            !s.erreurHistorique && <p>Aucun exercice dans une séance terminée pour l'instant.</p>
          ) : (
            <>
              <label className="formulaire__champ">
                Exercice
                <select value={s.exerciceId ?? ''} onChange={(e) => s.choisirExercice(e.target.value)}>
                  {s.exercices.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.nom}
                    </option>
                  ))}
                </select>
              </label>
              {g.points.length > 0 && (
                <div className="stats__courbe-bloc">
                  <p className="stats__extremes" aria-hidden="true">
                    <span>
                      Min <strong>{formaterValeur(g.min, g.unite)}</strong>
                    </span>
                    <span>
                      Max <strong>{formaterValeur(g.max, g.unite)}</strong>
                    </span>
                  </p>
                  <svg
                    className="stats__graphique"
                    viewBox={`0 0 ${g.largeur} ${g.hauteur}`}
                    role="img"
                    aria-label={`Évolution de ${formaterValeur(g.min, g.unite)} à ${formaterValeur(g.max, g.unite)} sur ${g.points.length} ${pluriel(g.points.length, 'séance')}`}
                  >
                    {g.points.length > 1 && (
                      <polygon
                        className="stats__aire"
                        points={`${g.points[0].x},${g.hauteur - 20} ${g.polyligne} ${g.points[g.points.length - 1].x},${g.hauteur - 20}`}
                      />
                    )}
                    <polyline points={g.polyligne} fill="none" className="stats__courbe" />
                    {g.points.map((p, i) => (
                      <circle key={p.dateIso} cx={p.x} cy={p.y} r={i === g.points.length - 1 ? 6 : 4} className={i === g.points.length - 1 ? 'stats__point stats__point--dernier' : 'stats__point'} />
                    ))}
                  </svg>
                  <p className="stats__dates" aria-hidden="true">
                    <span>{formaterDate(g.points[0].dateIso)}</span>
                    {g.points.length > 1 && <span>{formaterDate(g.points[g.points.length - 1].dateIso)}</span>}
                  </p>
                </div>
              )}
              <table className="stats__tableau">
                <caption>Charge maximale par séance</caption>
                <thead>
                  <tr>
                    <th scope="col">Date</th>
                    <th scope="col">Charge max</th>
                    <th scope="col">{g.unite === 's' ? 'Durée' : 'Reps'}</th>
                  </tr>
                </thead>
                <tbody>
                  {s.historique.map((p) => (
                    <tr key={p.dateIso}>
                      <td>{formaterDate(p.dateIso)}</td>
                      <td>{p.maxChargeKg > 0 ? formaterValeur(p.maxChargeKg, 'kg') : 'Poids du corps'}</td>
                      <td>{p.enSecondes ? formaterValeur(p.reps, 's') : p.reps}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </section>
      )}
    </>
  )
}
