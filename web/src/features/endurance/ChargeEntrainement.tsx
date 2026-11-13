import { useState, type FormEvent } from 'react'
import { formaterDateCourte } from './presentation'
import { construireGraphiqueCharge } from './graphiqueCharge'
import { FENETRES, useChargeEntrainement } from './useChargeEntrainement'

const arrondi = (v: number) => Math.round(v)
const signe = (v: number) => (v > 0 ? `+${arrondi(v)}` : String(arrondi(v)))
const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`

// Charge d'entraînement dans l'écran Statistiques : forme, fatigue et fraîcheur des sorties de course et de vélo.
// Calculs dans calculCharge.ts, géométrie dans graphiqueCharge.ts, lecture et réglages dans useChargeEntrainement.
export function ChargeEntrainement() {
  const c = useChargeEntrainement()
  const g = construireGraphiqueCharge(c.serie)
  const d = c.dernier
  return (
    <div className="charge">
      <p className="charge__intro">
        Estimation de votre forme à partir de vos sorties de course et de vélo : la forme monte avec la charge des dernières semaines, la
        fatigue avec celle de la dernière semaine, et la fraîcheur est leur écart.
      </p>

      {c.erreur && <p role="alert">{c.erreur}</p>}
      {!c.pret && <p role="status">Chargement…</p>}
      {c.pret && !c.erreur && !d && <p className="stats__vide">Aucune sortie enregistrée : la charge se calcule à partir de vos sorties.</p>}

      {d && c.etat && (
        <>
          <section aria-labelledby="ch-etat" className="stats-endurance__carte charge__etat">
            <h2 id="ch-etat">Aujourd’hui</h2>
            <p className="charge__libelle">{c.etat.libelle}</p>
            <p className="charge__aide">{c.etat.aide}</p>
            <dl className="charge__valeurs">
              <div className="charge__valeur charge__valeur--forme">
                <dd>{arrondi(d.forme)}</dd>
                <dt>Forme</dt>
              </div>
              <div className="charge__valeur charge__valeur--fatigue">
                <dd>{arrondi(d.fatigue)}</dd>
                <dt>Fatigue</dt>
              </div>
              <div className="charge__valeur charge__valeur--fraicheur">
                <dd>{signe(d.forme - d.fatigue)}</dd>
                <dt>Fraîcheur</dt>
              </div>
            </dl>
          </section>

          <section aria-labelledby="ch-courbe" className="stats-endurance__carte">
            <h2 id="ch-courbe">Évolution</h2>
            <div role="group" aria-label="Fenêtre" className="stats-endurance__periodes">
              {FENETRES.map((f) => (
                <button key={f.id} type="button" className="stats-endurance__periode" aria-pressed={c.fenetre === f.id} onClick={() => c.choisirFenetre(f.id)}>
                  {f.libelle}
                </button>
              ))}
            </div>
            {g && (
              <svg
                className="charge__graphique"
                viewBox={`0 0 ${g.largeur} ${g.hauteur}`}
                role="img"
                aria-label={`Courbes de forme, fatigue et fraîcheur sur ${c.fenetre} jours. Aujourd’hui : forme ${arrondi(d.forme)}, fatigue ${arrondi(d.fatigue)}, fraîcheur ${signe(d.forme - d.fatigue)}.`}
              >
                {g.graduations.map((t) => (
                  <g key={t.valeur}>
                    <line x1={g.zone.x} x2={g.zone.x + g.zone.largeur} y1={t.y} y2={t.y} className="charge__grille" />
                    <text x={g.zone.x - 6} y={t.y + 4} textAnchor="end" className="charge__texte">
                      {t.valeur}
                    </text>
                  </g>
                ))}
                <line x1={g.zone.x} x2={g.zone.x + g.zone.largeur} y1={g.yZero} y2={g.yZero} className="charge__zero" />
                <polyline points={g.fraicheur} className="charge__courbe charge__courbe--fraicheur" />
                <polyline points={g.fatigue} className="charge__courbe charge__courbe--fatigue" />
                <polyline points={g.forme} className="charge__courbe charge__courbe--forme" />
                {g.dates.map((t, i) => (
                  // Première date alignée à gauche et dernière à droite : centrées, elles sortiraient du cadre
                  <text key={t.date} x={t.x} y={g.hauteur - 6} textAnchor={i === 0 ? 'start' : i === g.dates.length - 1 ? 'end' : 'middle'} className="charge__texte">
                    {formaterDateCourte(t.date)}
                  </text>
                ))}
              </svg>
            )}
            <ul className="charge__legende" aria-hidden="true">
              <li className="charge__legende--forme">Forme</li>
              <li className="charge__legende--fatigue">Fatigue</li>
              <li className="charge__legende--fraicheur">Fraîcheur</li>
            </ul>
          </section>

          <Reglages c={c} />
        </>
      )}
    </div>
  )
}

// Paramètres du calcul : valeurs utilisées (estimées ou réglées) et d'où viennent les chiffres.
function Reglages({ c }: { c: ReturnType<typeof useChargeEntrainement> }) {
  const [brouillon, setBrouillon] = useState({
    ftpW: c.reglages.ftpW?.toString() ?? '',
    fcMax: c.reglages.fcMax?.toString() ?? '',
    fcRepos: c.reglages.fcRepos?.toString() ?? '',
  })
  const p = c.parametres
  const m = c.methodes
  if (!p || !m) return null
  const nombre = (t: string) => (t.trim() === '' ? undefined : Number(t.replace(',', '.')))
  const enregistrer = (e: FormEvent) => {
    e.preventDefault()
    c.regler({ ftpW: nombre(brouillon.ftpW), fcMax: nombre(brouillon.fcMax), fcRepos: nombre(brouillon.fcRepos) })
  }
  const reinitialiser = () => {
    setBrouillon({ ftpW: '', fcMax: '', fcRepos: '' })
    c.regler({})
  }
  const champ = (cle: 'ftpW' | 'fcMax' | 'fcRepos', libelle: string, estime: number | null) => (
    <label className="charge__champ">
      <span>{libelle}</span>
      <input
        inputMode="numeric"
        value={brouillon[cle]}
        placeholder={estime === null ? 'non estimée' : `${estime} (estimée)`}
        onChange={(e) => setBrouillon({ ...brouillon, [cle]: e.target.value })}
      />
    </label>
  )
  return (
    <details className="stats-endurance__carte charge__reglages">
      <summary>Réglages du calcul</summary>
      <p className="charge__aide">
        Chaque sortie est évaluée avec la meilleure mesure dont elle dispose : puissance (avec votre FTP), sinon fréquence cardiaque (avec votre FC
        max), sinon effort ressenti, sinon durée seule. Les valeurs non renseignées sont estimées à partir de vos sorties.
      </p>
      <p className="charge__aide" role="status">
        Calcul actuel : {pluriel(m.puissance, 'sortie')} à la puissance, {pluriel(m.frequence, 'sortie')} à la fréquence cardiaque,{' '}
        {pluriel(m.effort, 'sortie')} à l’effort ressenti, {pluriel(m.duree, 'sortie')} à la durée seule.
      </p>
      <form onSubmit={enregistrer} className="charge__formulaire">
        {champ('ftpW', 'FTP (W)', p.ftpW)}
        {champ('fcMax', 'FC max (bpm)', p.fcMax)}
        {champ('fcRepos', 'FC repos (bpm)', p.fcRepos)}
        <div className="charge__actions">
          <button type="submit" className="bouton bouton--principal">
            Enregistrer
          </button>
          <button type="button" className="bouton" onClick={reinitialiser}>
            Revenir aux estimations
          </button>
        </div>
      </form>
      <p className="charge__aide">Ces réglages restent sur cet appareil.</p>
    </details>
  )
}
