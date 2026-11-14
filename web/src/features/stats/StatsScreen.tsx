import { useState, type CSSProperties } from 'react'
import { useAuth } from '../../core/auth/AuthProvider'
import { ecart, type Ecart } from '../../core/common/ecart'
import { ChargeEntrainement } from '../endurance/ChargeEntrainement'
import { StatsEndurance } from '../endurance/StatsEndurance'
import { degradeEchelle } from './heatmapZones'
import { GraphiqueExercice } from './GraphiqueExercice'
import { MuscleHeatmap } from './MuscleHeatmap'
import { PERIODES } from './periode'
import { formaterDate, formaterJourMois, formaterNombre, formaterTonnage, formaterValeur, libelleSeries, syntheseExercice } from './presentation'
import { useStats } from './useStats'

const VUES = [
  { id: 'face', libelle: 'Face' },
  { id: 'dos', libelle: 'Dos' },
] as const

// Où voir le groupe sur la figure : une vue, les deux, ou aucune
const lieu = (traces: { face?: string; dos?: string }) =>
  traces.face && traces.dos ? 'face et dos' : traces.face ? 'face' : traces.dos ? 'dos' : 'hors figure'

const pluriel = (n: number, mot: string) => `${mot}${n > 1 ? 's' : ''}`

const CLASSE_ECART = { hausse: 'stats__ecart--hausse', baisse: 'stats__ecart--baisse', stable: 'stats__ecart--stable' } as const

// Tendance d'un chiffre par rapport à la période précédente : flèche, écart et mention lisible par un lecteur d'écran.
function Tendance({ e }: { e: Ecart }) {
  return (
    <span className={`stats__ecart ${CLASSE_ECART[e.sens]}`}>
      {e.sens === 'hausse' ? '↑ ' : e.sens === 'baisse' ? '↓ ' : ''}
      {e.texte}
      <span className="visuellement-cache"> par rapport à la période précédente</span>
    </span>
  )
}

// Tonnage des quatre dernières semaines en barres ; la semaine en cours (dernière) est pleine, les autres teintées.
function BarresSemaines({ semaines }: { semaines: { debut: string; tonnageKg: number }[] }) {
  const max = Math.max(1, ...semaines.map((s) => s.tonnageKg))
  return (
    <div className="stats__semaines">
      <p className="stats__libelle">Tonnage par semaine</p>
      <ol className="stats__semaines-barres" aria-label="Tonnage des quatre dernières semaines">
        {semaines.map((s, i) => (
          <li key={s.debut} className="stats__semaine">
            <span className="stats__semaine-valeur">{formaterNombre(Math.round((s.tonnageKg / 1000) * 10) / 10)} t</span>
            <span className="stats__semaine-piste" aria-hidden="true">
              <span
                className={`stats__semaine-barre${i === semaines.length - 1 ? ' stats__semaine-barre--courante' : ''}`}
                style={{ '--hauteur': `${Math.max(4, Math.round((s.tonnageKg / max) * 100))}%` } as CSSProperties}
              />
            </span>
            <span className="stats__semaine-date">{i === semaines.length - 1 ? 'Cette semaine' : `Sem. du ${formaterJourMois(s.debut)}`}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}

const VUES_STATS = [
  { id: 'renfo', libelle: 'Renforcement' },
  { id: 'course', libelle: 'Course' },
  { id: 'velo', libelle: 'Vélo' },
  { id: 'charge', libelle: 'Forme' },
] as const

// Écran Statistiques : quatre vues, renforcement (séances jouées), course et vélo (sorties) et forme (charge d'entraînement
// des sorties). Chaque vue garde ses propres calculs : les sorties n'entrent jamais dans les statistiques de renforcement.
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
      {vue === 'renfo' ? <StatsRenforcement /> : vue === 'charge' ? <ChargeEntrainement /> : <StatsEndurance key={vue} sport={vue} />}
    </>
  )
}

// Statistiques renforcement : période, résumé, heatmap musculaire et historique d'un exercice.
// La logique vit dans useStats / presentation : ce composant ne fait qu'afficher.
function StatsRenforcement() {
  const { session } = useAuth()
  const s = useStats({ userId: session?.user.id })
  const g = s.graphique
  const synthese = syntheseExercice(s.historique)

  return (
    <>
      <div role="group" aria-label="Période" className="formulaire__ligne stats__periodes">
        {PERIODES.map((p) => (
          <button key={p.id} type="button" className="bouton" aria-pressed={s.periode === p.id} onClick={() => s.choisirPeriode(p.id)}>
            {p.libelle}
          </button>
        ))}
      </div>

      <p className="stats__plage">
        {s.periode === 'tout' ? 'Depuis le début' : `Du ${formaterJourMois(s.from)} au ${formaterJourMois(s.to)}`}
        {s.precedente ? ` · comparé au ${formaterJourMois(s.precedente.from)} – ${formaterJourMois(s.precedente.to)}` : ''}
      </p>

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
              <div className="stats__tonnage-ligne">
                <p className="stats__tonnage">
                  <span className="stats__valeur stats__valeur--grande">{formaterTonnage(s.resume.tonnageKg)}</span>
                  <span className="stats__libelle">Tonnage</span>
                </p>
                {s.precedent && s.precedent.tonnageKg > 0 && (
                  <Tendance e={ecart(s.resume.tonnageKg, s.precedent.tonnageKg, (d) => `${Math.round((d / s.precedent!.tonnageKg) * 100)} %`)} />
                )}
              </div>
              <div className="stats__trio">
                <div>
                  <p className="stats__valeur">{s.resume.seancesTerminees}</p>
                  <p className="stats__libelle">{pluriel(s.resume.seancesTerminees, 'séance')} {pluriel(s.resume.seancesTerminees, 'terminée')}</p>
                  {s.precedent && <Tendance e={ecart(s.resume.seancesTerminees, s.precedent.seancesTerminees, String)} />}
                </div>
                <div>
                  <p className="stats__valeur">{s.resume.seriesTotal}</p>
                  <p className="stats__libelle">{pluriel(s.resume.seriesTotal, 'série')}</p>
                  {s.precedent && <Tendance e={ecart(s.resume.seriesTotal, s.precedent.seriesTotal, String)} />}
                </div>
                <div>
                  <p className="stats__valeur">{formaterNombre(s.resume.repsTotal)}</p>
                  <p className="stats__libelle">{pluriel(s.resume.repsTotal, 'répétition')}</p>
                  {s.precedent && <Tendance e={ecart(s.resume.repsTotal, s.precedent.repsTotal, formaterNombre)} />}
                </div>
              </div>
              {s.semaines.some((w) => w.tonnageKg > 0) && <BarresSemaines semaines={s.semaines} />}
            </div>
          </section>

          {s.records.length > 0 && (
            <section aria-labelledby="stats-records" className="stats__section stats__section--carte">
              <div className="stats__entete-carte">
                <h2 id="stats-records">Records personnels</h2>
                <span className="stats__aide">1RM estimé (Epley)</span>
              </div>
              <ul className="stats__records">
                {s.records.map((r) => (
                  <li key={r.exerciseId} className="stats__record">
                    <button type="button" className="stats__record-bouton" onClick={() => s.choisirExercice(r.exerciseId)}>
                      <span className="stats__record-texte">
                        <span className="stats__record-nom">{r.nom}</span>
                        <span className="stats__record-detail">
                          {formaterValeur(r.chargeKg, 'kg')} × {r.reps} · {formaterDate(r.dateIso)}
                        </span>
                      </span>
                      <span className="stats__record-droite">
                        <span className="stats__record-rm">{formaterValeur(r.rmEstimeKg, 'kg')}</span>
                        {r.recent && <span className="stats__record-badge">Nouveau record</span>}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

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
              <button
                type="button"
                className="stats__defaut"
                aria-pressed={s.exerciceDefaut === s.exerciceId}
                onClick={() => s.definirExerciceDefaut(s.exerciceDefaut === s.exerciceId ? null : s.exerciceId)}
              >
                {s.exerciceDefaut === s.exerciceId ? '★ Exercice affiché en premier' : '☆ Afficher cet exercice en premier'}
              </button>
              {synthese && (
                <div className="stats__synthese">
                  <div>
                    <p className="stats__libelle">Record</p>
                    <p className="stats__valeur">{formaterValeur(synthese.recordKg, 'kg')}</p>
                    <p className="stats__libelle">{formaterDate(synthese.recordDateIso)}</p>
                  </div>
                  <div>
                    <p className="stats__libelle">Progression</p>
                    <p className="stats__valeur">{synthese.progressionKg > 0 ? '+' : synthese.progressionKg < 0 ? '−' : ''}{formaterValeur(Math.abs(synthese.progressionKg), 'kg')}</p>
                    <p className="stats__libelle">depuis le {formaterDate(synthese.depuisIso)}</p>
                  </div>
                  <div>
                    <p className="stats__libelle">1RM estimé</p>
                    <p className="stats__valeur">{formaterValeur(synthese.rmKg, 'kg')}</p>
                    <p className="stats__libelle">formule d’Epley</p>
                  </div>
                </div>
              )}
              {g.points.length > 0 && <GraphiqueExercice key={s.exerciceId} g={g} mesure={s.mesure} onMesure={s.choisirMesure} />}
              <table className="stats__tableau">
                <caption>Charge maximale par séance</caption>
                <thead>
                  <tr>
                    <th scope="col">Date</th>
                    <th scope="col">Charge max</th>
                    <th scope="col">{g.unite === 's' ? 'Durée' : 'Reps'}</th>
                    {g.unite === 'kg' && <th scope="col">Volume</th>}
                  </tr>
                </thead>
                <tbody>
                  {s.historique.map((p) => (
                    <tr key={p.dateIso}>
                      <td>{formaterDate(p.dateIso)}</td>
                      <td>{p.maxChargeKg > 0 ? formaterValeur(p.maxChargeKg, 'kg') : 'Poids du corps'}</td>
                      <td>{p.enSecondes ? formaterValeur(p.reps, 's') : p.reps}</td>
                      {g.unite === 'kg' && <td>{p.volumeKg > 0 ? formaterTonnage(p.volumeKg) : '—'}</td>}
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
