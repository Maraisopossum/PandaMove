import { useState } from 'react'
import { formaterDate, formaterValeur, MESURES, type Graphique, type MesureHistorique } from './presentation'
import type { PointHistorique } from './statsQueries'

const LIBELLE_MESURE: Record<MesureHistorique, string> = { charge: 'Charge max', rm: '1RM estimé', volume: 'Volume' }

// Détail d'une séance pour la bulle : « 110 kg × 5 », « 8 reps », « 60 s ».
function detailSeance(p: PointHistorique): string {
  if (p.enSecondes) return formaterValeur(p.reps, 's')
  return p.maxChargeKg > 0 ? `${formaterValeur(p.maxChargeKg, 'kg')} × ${p.reps}` : `${p.reps} reps`
}

// Courbe d'un exercice : mesure au choix (charge max, 1RM estimé, volume), axes gradués, record marqué et bulle d'information
// sur le point touché (ou ciblé au clavier). Le point actif est repéré par sa date, pour ne pas changer d'exercice en route.
export function GraphiqueExercice({ g, mesure, onMesure }: { g: Graphique; mesure: MesureHistorique; onMesure: (m: MesureHistorique) => void }) {
  const [actifDate, setActifDate] = useState<string | null>(null)
  const dernier = g.points.length - 1
  const actif = g.points.find((p) => p.dateIso === actifDate) ?? g.points[dernier]
  const rang = g.points.indexOf(actif)
  const estRecord = rang === g.indexRecord && g.points.length > 1
  const { zone } = g
  const unite = g.unite
  return (
    <>
      {g.mesuresDisponibles.length > 1 && (
        <div role="group" aria-label="Mesure affichée" className="stats__mesures">
          {MESURES.filter((m) => g.mesuresDisponibles.includes(m.id)).map((m) => (
            <button key={m.id} type="button" className="stats__mesure" aria-pressed={mesure === m.id} onClick={() => onMesure(m.id)}>
              {m.libelle}
            </button>
          ))}
        </div>
      )}
      <div className="stats__courbe-bloc">
        <svg
          className="stats__graphique"
          viewBox={`0 0 ${g.largeur} ${g.hauteur}`}
          role="group"
          aria-label={`${LIBELLE_MESURE[g.mesure]} : de ${formaterValeur(g.points[0].valeur, unite)} à ${formaterValeur(g.points[dernier].valeur, unite)} sur ${g.points.length} séance${g.points.length > 1 ? 's' : ''}`}
        >
          <g className="stats__grille" aria-hidden="true">
            {g.graduationsY.map((t) => (
              <g key={t.y}>
                <line x1={zone.gauche} x2={g.largeur - zone.droite + 8} y1={t.y} y2={t.y} className="stats__trait-grille" />
                <text x={zone.gauche - 6} y={t.y + 4} textAnchor="end" className="stats__etiquette">
                  {t.libelle}
                </text>
              </g>
            ))}
            {g.graduationsX.map((t) => (
              <text key={t.x} x={t.x} y={g.hauteur - 6} textAnchor="middle" className="stats__etiquette">
                {t.libelle}
              </text>
            ))}
          </g>
          {g.points.length > 1 && (
            <polygon className="stats__aire" points={`${g.points[0].x},${zone.bas} ${g.polyligne} ${g.points[dernier].x},${zone.bas}`} />
          )}
          <polyline points={g.polyligne} fill="none" className="stats__courbe" />
          {g.points.map((p, i) => (
            <g
              key={p.dateIso}
              role="button"
              tabIndex={0}
              aria-pressed={p === actif}
              aria-label={`${formaterDate(p.dateIso)} : ${detailSeance(p.source)}${i === g.indexRecord && g.points.length > 1 ? ', record' : ''}`}
              className="stats__point-zone"
              onClick={() => setActifDate(p.dateIso)}
              onFocus={() => setActifDate(p.dateIso)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  setActifDate(p.dateIso)
                }
              }}
            >
              <circle cx={p.x} cy={p.y} r="16" className="stats__point-cible" />
              <circle
                cx={p.x}
                cy={p.y}
                r={i === g.indexRecord && g.points.length > 1 ? 7 : 4.5}
                className={i === g.indexRecord && g.points.length > 1 ? 'stats__point stats__point--dernier' : 'stats__point'}
              />
              {p === actif && <circle cx={p.x} cy={p.y} r="11" className="stats__point-actif" />}
            </g>
          ))}
        </svg>
      </div>
      <p role="status" className="stats__bulle">
        <strong>{formaterDate(actif.dateIso)}</strong>
        <span>
          {detailSeance(actif.source)}
          {g.mesure !== 'charge' ? ` · ${LIBELLE_MESURE[g.mesure]} ${formaterValeur(actif.valeur, unite)}` : ''}
          {estRecord ? ' · record' : ''}
        </span>
      </p>
      <p className="stats__aide">Touchez un point pour voir la séance.</p>
    </>
  )
}
