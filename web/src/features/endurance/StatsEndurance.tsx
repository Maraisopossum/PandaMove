import type { Sport } from '../../core/db/repos/sorties'
import { PERIODES } from '../stats/periode'
import { HeatmapSorties } from './HeatmapSorties'
import { distanceKm, formaterDate, formaterDuree } from './presentation'
import { useStatsEndurance } from './useStatsEndurance'

const JOURS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']
const libelleMois = (cle: string) => MOIS[Number(cle.slice(5)) - 1]
const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`
const allure = (secParKm: number) => formaterDuree(secParKm) + ' /km'

// Statistiques d'un sport dans l'écran Statistiques : résumé, rythme, distance par mois, jours habituels, records et heatmap
// des lieux. Calculs dans statsEndurance.ts et carteSorties.ts, lecture dans useStatsEndurance.
export function StatsEndurance({ sport }: { sport: Sport }) {
  const e = useStatsEndurance(sport)
  const st = e.stats
  const nom = sport === 'course' ? 'course' : 'vélo'
  const maxMois = Math.max(1, ...(st?.mois.map((m) => m.distanceM) ?? [1]))
  const maxJour = Math.max(1, ...(st?.parJour ?? [1]))
  return (
    <div className={`stats-endurance stats-endurance--${sport}`}>
      <div role="group" aria-label="Période" className="stats-endurance__periodes">
        {PERIODES.map((p) => (
          <button key={p.id} type="button" className="stats-endurance__periode" aria-pressed={e.periode === p.id} onClick={() => e.choisirPeriode(p.id)}>
            {p.libelle}
          </button>
        ))}
      </div>

      {e.erreur && <p role="alert">{e.erreur}</p>}
      {!e.pret && <p role="status">Chargement…</p>}
      {st && st.nombre === 0 && <p className="stats__vide">Aucune sortie de {nom} sur cette période.</p>}

      {st && st.nombre > 0 && (
        <>
          <section aria-labelledby="se-resume" className="stats-endurance__carte">
            <h2 id="se-resume">Résumé de la période</h2>
            <p className="stats-endurance__grand">
              <span className="stats-endurance__valeur">{distanceKm(st.distanceM)}</span>
              <span className="stats-endurance__legende">km en {pluriel(st.nombre, 'sortie')}</span>
            </p>
            <dl className="stats-endurance__grille">
              <div>
                <dd>{formaterDuree(st.dureeS)}</dd>
                <dt>durée totale</dt>
              </div>
              <div>
                <dd>{Math.round(st.denivelePosM)} m</dd>
                <dt>dénivelé +</dt>
              </div>
              <div>
                <dd>{st.parSemaine.toString().replace('.', ',')}</dd>
                <dt>sorties par semaine</dt>
              </div>
              <div>
                <dd>{st.rythmeGlobal === null ? '—' : sport === 'course' ? allure(st.rythmeGlobal) : `${st.rythmeGlobal.toFixed(1).replace('.', ',')} km/h`}</dd>
                <dt>{sport === 'course' ? 'allure moyenne' : 'vitesse moyenne'}</dt>
              </div>
              {st.fcMoy !== null && (
                <div>
                  <dd>{st.fcMoy} bpm</dd>
                  <dt>FC moyenne</dt>
                </div>
              )}
              {st.puissanceMoyW !== null && (
                <div>
                  <dd>{st.puissanceMoyW} W</dd>
                  <dt>puissance moyenne</dt>
                </div>
              )}
            </dl>
          </section>

          <section aria-labelledby="se-mois" className="stats-endurance__carte">
            <h2 id="se-mois">Distance par mois</h2>
            <ul className="stats-endurance__barres" aria-label="Distance par mois">
              {st.mois.map((m) => (
                <li key={m.mois}>
                  <span className="stats-endurance__barre-valeur">{m.distanceM > 0 ? Math.round(m.distanceM / 1000) : ''}</span>
                  <span className="stats-endurance__barre" style={{ height: `${Math.max(4, (m.distanceM / maxMois) * 100)}%` }} title={`${libelleMois(m.mois)} : ${distanceKm(m.distanceM)} km, ${pluriel(m.sorties, 'sortie')}`} />
                  <span className="stats-endurance__barre-nom">{libelleMois(m.mois)}</span>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="se-jours" className="stats-endurance__carte">
            <h2 id="se-jours">Jours habituels</h2>
            <ul className="stats-endurance__barres stats-endurance__barres--jours" aria-label="Sorties par jour de la semaine">
              {st.parJour.map((n, i) => (
                <li key={JOURS[i]}>
                  <span className="stats-endurance__barre-valeur">{n > 0 ? n : ''}</span>
                  <span className="stats-endurance__barre" style={{ height: `${Math.max(4, (n / maxJour) * 100)}%` }} title={`${JOURS[i]} : ${pluriel(n, 'sortie')}`} />
                  <span className="stats-endurance__barre-nom">{JOURS[i]}</span>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="se-records" className="stats-endurance__carte">
            <h2 id="se-records">Records de la période</h2>
            <dl className="stats-endurance__records">
              {st.records.plusLongue && (
                <div>
                  <dt>Plus longue distance</dt>
                  <dd>
                    {distanceKm(st.records.plusLongue.distanceM)} km <span>{formaterDate(st.records.plusLongue.date)}</span>
                  </dd>
                </div>
              )}
              {st.records.plusLongueDuree && (
                <div>
                  <dt>Plus longue durée</dt>
                  <dd>
                    {formaterDuree(st.records.plusLongueDuree.dureeS)} <span>{formaterDate(st.records.plusLongueDuree.date)}</span>
                  </dd>
                </div>
              )}
              {st.records.meilleureAllure && (
                <div>
                  <dt>Meilleure allure (3 km et plus)</dt>
                  <dd>
                    {allure(st.records.meilleureAllure.secParKm)} <span>{formaterDate(st.records.meilleureAllure.date)}</span>
                  </dd>
                </div>
              )}
              {st.records.meilleureVitesse && (
                <div>
                  <dt>Meilleure vitesse (10 km et plus)</dt>
                  <dd>
                    {st.records.meilleureVitesse.kmh.toFixed(1).replace('.', ',')} km/h <span>{formaterDate(st.records.meilleureVitesse.date)}</span>
                  </dd>
                </div>
              )}
              {st.records.plusGrandDenivele && (
                <div>
                  <dt>Plus grand dénivelé</dt>
                  <dd>
                    {st.records.plusGrandDenivele.m} m <span>{formaterDate(st.records.plusGrandDenivele.date)}</span>
                  </dd>
                </div>
              )}
            </dl>
          </section>

          <HeatmapSorties carte={e.carte} lieux={e.lieux} sortiesGps={e.sortiesGps} sorties={st.nombre} sport={sport} />
        </>
      )}
    </div>
  )
}
