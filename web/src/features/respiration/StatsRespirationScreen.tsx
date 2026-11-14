import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { dateIsoLocale } from '../../core/common/dates'
import { ecart } from '../../core/common/ecart'
import { getDb } from '../../core/db/client'
import type { DbLecture } from '../../core/db/Db'
import { lireSeancesDepuis, type SeanceRespirationDatee } from '../../core/db/repos/respiration'
import { duree } from '../home/bilanSemaine'
import { PERIODES, type PeriodeId } from '../stats/periode'
import { formaterJourMois } from '../stats/presentation'
import { lireObjectifQuotidien } from './reglages'
import { minutesParSemaine, statsPeriode, type Moment } from './statsRespiration'

const MAINTENANT = () => new Date()
const FORMAT_1 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 })
const NOMS_MOMENT: { id: Moment; nom: string }[] = [
  { id: 'matin', nom: 'Matin' }, { id: 'midi', nom: 'Midi' }, { id: 'soir', nom: 'Soir' }, { id: 'nuit', nom: 'Nuit' },
]

// Statistiques de la respiration (`/breathing/stats`) : résumé et tendance, minutes par semaine avec objectif, méthodes pratiquées
// et moments de la journée. Tout est calculé sur l'appareil (statsRespiration.ts) ; l'objectif hebdomadaire est l'objectif
// quotidien réglé à l'écran Respiration, sur sept jours.
export default function StatsRespirationScreen({ db, maintenant = MAINTENANT }: { db?: DbLecture; maintenant?: () => Date }) {
  const [seances, setSeances] = useState<SeanceRespirationDatee[] | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [periode, setPeriode] = useState<PeriodeId>('30j')

  useEffect(() => {
    let annule = false
    lireSeancesDepuis(db ?? getDb(), '0000-01-01')
      .then((l) => !annule && setSeances(l))
      .catch((e: unknown) => {
        console.error('Lecture des séances de respiration impossible', e)
        if (!annule) setErreur('Le chargement des statistiques a échoué.')
      })
    return () => {
      annule = true
    }
  }, [db])

  // « Maintenant » est lu une fois à l'ouverture de l'écran : les statistiques ne bougent pas pendant la consultation
  const [now] = useState(maintenant)
  const aujourdhui = dateIsoLocale(now)
  const st = useMemo(() => (seances ? statsPeriode(seances, periode, now) : null), [seances, periode, now])
  const semaines = useMemo(() => (seances ? minutesParSemaine(seances, aujourdhui, 4) : []), [seances, aujourdhui])
  const objectifHebdo = lireObjectifQuotidien() * 7

  const maxMinutes = Math.max(objectifHebdo, ...semaines.map((s) => s.secondes / 60), 10)
  const pas = maxMinutes <= 40 ? 10 : maxMinutes <= 100 ? 20 : 50
  const haut = Math.ceil(maxMinutes / pas) * pas
  const echelle = (v: number) => 124 - (v / haut) * 108
  const graduations = Array.from({ length: haut / pas + 1 }, (_, i) => i * pas)
  const maxMethode = Math.max(1, ...(st?.methodes.map((m) => m.secondes) ?? [1]))
  const maxMoment = st ? Math.max(1, ...Object.values(st.moments)) : 1
  const evolution = st && st.secondesPrecedentes !== null ? ecart(Math.round(st.secondes / 60), Math.round(st.secondesPrecedentes / 60), (m) => `${m} min`) : null

  return (
    <div className="respiration respiration-stats">
      <header>
        <p className="respiration__retour">
          <Link to="/breathing" className="respiration__lien">
            ← Respiration
          </Link>
        </p>
        <h1 className="respiration__titre-page">Statistiques</h1>
      </header>

      <div role="group" aria-label="Période" className="respiration-stats__periodes">
        {PERIODES.filter((p) => p.id !== '12m').map((p) => (
          <button key={p.id} type="button" className="respiration-stats__periode" aria-pressed={periode === p.id} onClick={() => setPeriode(p.id)}>
            {p.id === '30j' ? '1 mois' : p.libelle}
          </button>
        ))}
      </div>

      {erreur && (
        <p role="alert" className="formulaire__erreur">
          {erreur}
        </p>
      )}
      {!seances && !erreur && <p role="status">Chargement…</p>}

      {st && st.nombre === 0 && <p className="aide">Aucune séance de respiration sur cette période.</p>}

      {st && st.nombre > 0 && (
        <>
          <section className="respiration-stats__carte" aria-labelledby="rs-resume">
            <h2 id="rs-resume">Résumé</h2>
            <div className="respiration-stats__haut">
              <p className="respiration-stats__grand">
                <span className="respiration-stats__valeur">{duree(st.secondes)}</span>
                <span className="aide">
                  de respiration en {st.nombre} séance{st.nombre > 1 ? 's' : ''}
                </span>
              </p>
              {evolution && (
                <p className={`respiration__ecart respiration__ecart--${evolution.sens} respiration-stats__pilule`}>
                  {evolution.sens === 'hausse' ? '↑ ' : evolution.sens === 'baisse' ? '↓ ' : ''}
                  {evolution.texte}
                  <span className="visuellement-cache"> par rapport à la période précédente</span>
                </p>
              )}
            </div>
            <dl className="respiration__trio">
              <div>
                <dd>{FORMAT_1.format(st.moyenneSec / 60)} min</dd>
                <dt>durée moyenne</dt>
              </div>
              <div>
                <dd>{st.plusLongueSerie} j</dd>
                <dt>plus longue série</dt>
              </div>
              <div>
                <dd>{st.jours} j</dd>
                <dt>jours avec séance</dt>
              </div>
            </dl>
          </section>

          <section className="respiration-stats__carte" aria-labelledby="rs-semaines">
            <h2 id="rs-semaines">Minutes par semaine</h2>
            <svg
              viewBox="0 0 330 150"
              className="respiration-stats__graphique"
              role="img"
              aria-label={`Minutes de respiration par semaine : ${semaines.map((s) => `${Math.round(s.secondes / 60)}${s.courante ? ' en cours' : ''}`).join(', ')}, avec un objectif de ${objectifHebdo} minutes`}
            >
              {graduations.map((v) => (
                <g key={v} aria-hidden="true">
                  <line x1="36" x2="326" y1={echelle(v)} y2={echelle(v)} className="stats__trait-grille" />
                  <text x="30" y={echelle(v) + 4} textAnchor="end" className="stats__etiquette">
                    {v}
                  </text>
                </g>
              ))}
              {semaines.map((s, i) => {
                const x = 55 + i * 70
                const hauteur = (s.secondes / 60 / haut) * 108
                return (
                  <g key={s.debut}>
                    <rect x={x} y={124 - hauteur} width="40" height={Math.max(hauteur, 0)} rx="6" className={s.courante ? 'respiration-stats__barre respiration-stats__barre--courante' : 'respiration-stats__barre'} />
                    <text x={x + 20} y="144" textAnchor="middle" className="stats__etiquette" aria-hidden="true">
                      {s.courante ? 'Cette sem.' : formaterJourMois(s.debut)}
                    </text>
                  </g>
                )
              })}
              <line x1="36" x2="326" y1={echelle(objectifHebdo)} y2={echelle(objectifHebdo)} className="respiration-stats__objectif" aria-hidden="true" />
              <text x="326" y={echelle(objectifHebdo) - 5} textAnchor="end" className="respiration-stats__objectif-texte" aria-hidden="true">
                objectif {objectifHebdo}
              </text>
            </svg>
            <p className="aide">L’objectif de la semaine est votre objectif quotidien ({lireObjectifQuotidien()} min) sur sept jours. La dernière barre est la semaine en cours.</p>
          </section>

          <section className="respiration-stats__carte" aria-labelledby="rs-methodes">
            <h2 id="rs-methodes">Méthodes pratiquées</h2>
            <ul className="respiration-stats__methodes">
              {st.methodes.map((m) => (
                <li key={m.methodeId}>
                  <span className="respiration-stats__ligne">
                    <span>{m.nom}</span>
                    <span className="aide">
                      {m.nombre} séance{m.nombre > 1 ? 's' : ''} · {duree(m.secondes)}
                    </span>
                  </span>
                  <span className="respiration-stats__piste" aria-hidden="true">
                    <span style={{ width: `${Math.round((m.secondes / maxMethode) * 100)}%` }} />
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="respiration-stats__carte" aria-labelledby="rs-moments">
            <h2 id="rs-moments">Moments habituels</h2>
            <ul className="respiration-stats__moments">
              {NOMS_MOMENT.map((m) => (
                <li key={m.id} className={st.moments[m.id] === maxMoment && maxMoment > 0 ? 'respiration-stats__moment respiration-stats__moment--fort' : 'respiration-stats__moment'}>
                  <strong>{st.moments[m.id]}</strong>
                  <span>{m.nom}</span>
                </li>
              ))}
            </ul>
            <p className="aide">Matin de 5 h à 11 h, midi de 11 h à 14 h, soir de 14 h à 21 h, nuit de 21 h à 5 h. Heure de fin de séance, heure locale de l’appareil.</p>
          </section>
        </>
      )}
    </div>
  )
}
