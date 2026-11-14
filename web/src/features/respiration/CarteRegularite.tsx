import { useState } from 'react'
import { Link } from 'react-router'
import { ecart } from '../../core/common/ecart'
import { duree } from '../home/bilanSemaine'
import { OBJECTIF_QUOTIDIEN_MAX, OBJECTIF_QUOTIDIEN_MIN } from './reglages'
import type { BilanSemaineRespiration, EtatJourRespiration } from './statsRespiration'

const LIBELLE_ETAT: Record<EtatJourRespiration, string> = {
  atteint: 'objectif atteint',
  partiel: 'objectif non atteint',
  vide: 'aucune séance',
  aujourdhui: 'aujourd’hui, pas encore de séance',
  avenir: 'à venir',
}
const NOMS_JOURS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche']

// Carte « Cette semaine » de l'écran Respiration : jours de suite, minutes et séances avec leur écart au même point de la semaine
// passée, et les sept jours de la semaine par rapport à l'objectif quotidien (réglage d'appareil). Calculs dans statsRespiration.ts.
export function CarteRegularite({
  bilan, serie, objectif, onObjectif,
}: { bilan: BilanSemaineRespiration; serie: number; objectif: number; onObjectif: (minutes: number) => void }) {
  const [saisie, setSaisie] = useState<string | null>(null)
  const valeur = Number(saisie)
  const saisieValide = saisie !== null && /^\d+$/.test(saisie.trim()) && valeur >= OBJECTIF_QUOTIDIEN_MIN && valeur <= OBJECTIF_QUOTIDIEN_MAX
  const ecartMinutes = ecart(Math.round(bilan.secondes / 60), Math.round(bilan.secondesPrecedentes / 60), (m) => `${m} min`)
  const ecartSeances = ecart(bilan.seances, bilan.seancesPrecedentes, String)
  const symbole = (e: typeof ecartMinutes) => (e.sens === 'hausse' ? '↑ ' : e.sens === 'baisse' ? '↓ ' : '')

  return (
    <section className="respiration__regularite" aria-labelledby="resp-semaine">
      <div className="respiration__regularite-tete">
        <h2 id="resp-semaine">Cette semaine</h2>
        <Link to="/breathing/stats" className="respiration__lien">
          Statistiques
        </Link>
      </div>
      <dl className="respiration__trio">
        <div>
          <dd>{serie} j</dd>
          <dt>de suite</dt>
        </div>
        <div>
          <dd>{bilan.secondes > 0 ? duree(bilan.secondes) : '0 min'}</dd>
          <dt>cette semaine</dt>
          <dd className={`respiration__ecart respiration__ecart--${ecartMinutes.sens}`}>
            {symbole(ecartMinutes)}
            {ecartMinutes.texte}
            <span className="visuellement-cache"> par rapport à la semaine passée</span>
          </dd>
        </div>
        <div>
          <dd>{bilan.seances}</dd>
          <dt>{bilan.seances > 1 ? 'séances' : 'séance'}</dt>
          <dd className={`respiration__ecart respiration__ecart--${ecartSeances.sens}`}>
            {symbole(ecartSeances)}
            {ecartSeances.texte}
            <span className="visuellement-cache"> par rapport à la semaine passée</span>
          </dd>
        </div>
      </dl>

      <div className="respiration__objectif">
        <p>
          Objectif quotidien : {objectif} min
          <span className="aide"> · atteint {bilan.joursAtteints} jour{bilan.joursAtteints > 1 ? 's' : ''} cette semaine</span>
        </p>
        <button type="button" className="respiration__lien respiration__lien--bouton" onClick={() => setSaisie(String(objectif))}>
          Modifier
        </button>
      </div>
      {saisie !== null && (
        <form
          className="respiration__objectif-form"
          onSubmit={(e) => {
            e.preventDefault()
            if (!saisieValide) return
            onObjectif(valeur)
            setSaisie(null)
          }}
        >
          <label>
            Minutes par jour
            <input inputMode="numeric" value={saisie} autoFocus onChange={(e) => setSaisie(e.target.value)} />
          </label>
          {saisie.trim() !== '' && !saisieValide && (
            <p role="alert" className="formulaire__erreur">
              Entre {OBJECTIF_QUOTIDIEN_MIN} et {OBJECTIF_QUOTIDIEN_MAX} minutes.
            </p>
          )}
          <div className="formulaire__ligne">
            <button type="button" className="bouton" onClick={() => setSaisie(null)}>
              Annuler
            </button>
            <button type="submit" className="bouton bouton--principal" disabled={!saisieValide}>
              Enregistrer
            </button>
          </div>
        </form>
      )}

      <ol className="respiration__jours" aria-label="Jours de la semaine">
        {bilan.jours.map((j, i) => (
          <li key={j.dateIso} className="respiration__jour-colonne">
            <span aria-hidden="true" className="respiration__jour-lettre">
              {j.lettre}
            </span>
            <span aria-hidden="true" className={`respiration__jour respiration__jour--${j.etat}`}>
              {j.etat === 'atteint' ? '✓' : j.etat === 'partiel' ? j.minutes : j.etat === 'aujourdhui' ? Number(j.dateIso.slice(8)) : ''}
            </span>
            <span className="visuellement-cache">
              {NOMS_JOURS[i]} : {LIBELLE_ETAT[j.etat]}
              {j.etat === 'partiel' || j.etat === 'atteint' ? `, ${j.minutes} min` : ''}
            </span>
          </li>
        ))}
      </ol>
    </section>
  )
}
