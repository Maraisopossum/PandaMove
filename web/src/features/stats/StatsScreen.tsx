import { useAuth } from '../../core/auth/AuthProvider'
import { COULEURS_NIVEAU, LIBELLES_NIVEAU } from './heatmapZones'
import { MuscleHeatmap } from './MuscleHeatmap'
import { PERIODES } from './periode'
import { formaterDate, formaterNombre, formaterTonnage, formaterValeur, libelleSeries } from './presentation'
import { useStats } from './useStats'

const VUES = [
  { id: 'face', libelle: 'Face' },
  { id: 'dos', libelle: 'Dos' },
] as const

const LIEU = { face: 'face', dos: 'dos', liste: 'hors figure' } as const

const pluriel = (n: number, mot: string) => `${mot}${n > 1 ? 's' : ''}`

// Statistiques renforcement : période, résumé, heatmap musculaire et historique d'un exercice.
// La logique vit dans useStats / presentation : ce composant ne fait qu'afficher.
export default function StatsScreen() {
  const { session } = useAuth()
  const s = useStats({ userId: session?.user.id })
  const g = s.graphique

  return (
    <>
      <h1>Statistiques</h1>

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
            <div className="stats__cartes">
              <div className="stats__carte">
                <p className="stats__valeur">{formaterTonnage(s.resume.tonnageKg)}</p>
                <p className="stats__libelle">Tonnage</p>
              </div>
              <div className="stats__carte">
                <p className="stats__valeur">{s.resume.seancesTerminees}</p>
                <p className="stats__libelle">{pluriel(s.resume.seancesTerminees, 'séance')} {pluriel(s.resume.seancesTerminees, 'terminée')}</p>
              </div>
              <div className="stats__carte">
                <p className="stats__valeur">{s.resume.seriesTotal}</p>
                <p className="stats__libelle">{pluriel(s.resume.seriesTotal, 'série')}</p>
              </div>
              <div className="stats__carte">
                <p className="stats__valeur">{formaterNombre(s.resume.repsTotal)}</p>
                <p className="stats__libelle">{pluriel(s.resume.repsTotal, 'répétition')}</p>
              </div>
            </div>
          </section>

          <section aria-labelledby="stats-muscles" className="stats__section">
            <h2 id="stats-muscles">Muscles travaillés</h2>
            <div role="group" aria-label="Vue de la figure" className="formulaire__ligne">
              {VUES.map((v) => (
                <button key={v.id} type="button" className="bouton" aria-pressed={s.vue === v.id} onClick={() => s.setVue(v.id)}>
                  {v.libelle}
                </button>
              ))}
            </div>
            <MuscleHeatmap image={s.image} vue={s.vue} zones={s.zonesVue} />
            <ul className="heatmap__niveaux" aria-label="Légende des couleurs">
              {LIBELLES_NIVEAU.map((libelle, i) => (
                <li key={libelle}>
                  <span className="heatmap__pastille" style={{ background: COULEURS_NIVEAU[i] ?? 'transparent' }} aria-hidden="true" />
                  {libelle}
                </li>
              ))}
            </ul>
            <ul className="stats__barres" aria-label="Séries par groupe musculaire">
              {s.groupes.map((m) => (
                <li key={m.groupe} className="stats__barre">
                  <span className="stats__barre-nom">
                    {m.libelle} <span className="stats__barre-lieu">({LIEU[m.vue]})</span>
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
        <section aria-labelledby="stats-historique" className="stats__section">
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
                <svg
                  className="stats__graphique"
                  viewBox={`0 0 ${g.largeur} ${g.hauteur}`}
                  role="img"
                  aria-label={`Évolution de ${formaterValeur(g.min, g.unite)} à ${formaterValeur(g.max, g.unite)} sur ${g.points.length} ${pluriel(g.points.length, 'séance')}`}
                >
                  <polyline points={g.polyligne} fill="none" className="stats__courbe" />
                  {g.points.map((p) => (
                    <circle key={p.dateIso} cx={p.x} cy={p.y} r="4" className="stats__point" />
                  ))}
                </svg>
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
