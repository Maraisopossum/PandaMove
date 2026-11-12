import { formaterDate, formaterValeur } from '../stats/presentation'
import { PERIODES_PROGRESSION } from './progression'
import { useProgression } from './useProgression'

// Progression par exercice : courbe de la charge (ou des reps / secondes), record et évolution sur la période.
// Toute la logique vit dans useProgression et progression.ts.
export default function ProgressionScreen() {
  const p = useProgression()
  const g = p.resume.graphique
  return (
    <div className="outils">
      <h1 className="titre-ecran">Progression</h1>
      {p.erreur && <p role="alert">{p.erreur}</p>}
      {p.pret && p.exercices.length === 0 && !p.erreur && <p>Aucun exercice dans une séance terminée pour l'instant.</p>}
      {p.exercices.length > 0 && (
        <>
          <label className="formulaire__champ">
            Exercice
            <select value={p.exerciceId ?? ''} onChange={(e) => p.choisirExercice(e.target.value)}>
              {p.exercices.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nom}
                </option>
              ))}
            </select>
          </label>
          <div role="group" aria-label="Période" className="outils__periodes">
            {PERIODES_PROGRESSION.map((o) => (
              <button key={o.id} type="button" className="outils__periode" aria-pressed={p.periode === o.id} onClick={() => p.setPeriode(o.id)}>
                {o.libelle}
              </button>
            ))}
          </div>

          {g.points.length === 0 ? (
            <p>Aucune séance de cet exercice sur cette période.</p>
          ) : (
            <>
              <svg className="stats__graphique" viewBox={`0 0 ${g.largeur} ${g.hauteur}`} role="img" aria-label={`Évolution de ${formaterValeur(g.min, g.unite)} à ${formaterValeur(g.max, g.unite)} sur ${g.points.length} séance${g.points.length > 1 ? 's' : ''}`}>
                {g.points.length > 1 && <polygon className="stats__aire" points={`${g.points[0].x},${g.hauteur - 20} ${g.polyligne} ${g.points[g.points.length - 1].x},${g.hauteur - 20}`} />}
                <polyline points={g.polyligne} fill="none" className="stats__courbe" />
                {g.points.map((pt, i) => (
                  <circle key={pt.dateIso} cx={pt.x} cy={pt.y} r={i === g.points.length - 1 ? 6 : 4} className={i === g.points.length - 1 ? 'stats__point stats__point--dernier' : 'stats__point'} />
                ))}
              </svg>
              <div className="outils__chiffres">
                <div className="outils__chiffre">
                  <span className="outils__chiffre-libelle">Record</span>
                  <strong>{p.resume.record ? formaterValeur(p.resume.record.valeur, g.unite) : '—'}</strong>
                  {p.resume.record && <span className="outils__chiffre-detail">{formaterDate(p.resume.record.dateIso)}</span>}
                </div>
                <div className="outils__chiffre">
                  <span className="outils__chiffre-libelle">Sur la période</span>
                  <strong className={p.resume.evolution !== null && p.resume.evolution > 0 ? 'outils__hausse' : undefined}>
                    {p.resume.evolution === null ? '—' : `${p.resume.evolution > 0 ? '+' : ''}${formaterValeur(p.resume.evolution, g.unite)}`}
                  </strong>
                  <span className="outils__chiffre-detail">
                    {p.resume.seances} séance{p.resume.seances > 1 ? 's' : ''}
                  </span>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
