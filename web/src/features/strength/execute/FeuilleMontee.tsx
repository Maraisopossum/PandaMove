import { Feuille } from './Feuille'
import { LIBELLES_PROTOCOLE, paliersActifs, texteCharge, type Protocole } from './montee'
import { texteDuree } from './minuteurRepos'
import type { EtatMontee } from './useMontee'
import { formaterDuree } from './vue'

interface Props {
  nomExercice: string
  etat: EtatMontee
  /** Instant courant (ms), pour le chrono de repos entre paliers */
  maintenantMs: number
  onProtocole: (p: Protocole) => void
  onFait: (index: number) => void
  onFermer: () => void
}

const PROTOCOLES: Protocole[] = ['DEBUTANT', 'STANDARD', 'LOURD']

// Feuille « Montée en charge » (WarmupSetsSheet Android) : protocole, paliers (charge × reps, repos) à cocher dans
// l'ordre, chrono de repos entre paliers, « Je suis déjà chaud » pour fermer. Présentation seule.
export function FeuilleMontee({ nomExercice, etat, maintenantMs, onProtocole, onFait, onFermer }: Props) {
  const paliers = paliersActifs(etat.paliers)
  const restantMs = etat.finReposMs === null ? 0 : Math.max(0, etat.finReposMs - maintenantMs)
  return (
    <Feuille titre={`Montée en charge · ${nomExercice}`} onFermer={onFermer} libelleFermer="Je suis déjà chaud">
      <p className="aide">Paliers calculés depuis la charge cible, à cocher dans l’ordre.</p>
      <div role="group" aria-label="Protocole" className="montee__protocoles">
        {PROTOCOLES.map((p) => (
          <button key={p} type="button" className="bouton" aria-pressed={etat.protocole === p} onClick={() => onProtocole(p)}>
            {LIBELLES_PROTOCOLE[p]}
          </button>
        ))}
      </div>
      <ol className="montee__paliers">
        {paliers.map((p, i) => (
          <li key={i} className={p.fait ? 'montee__palier montee__palier--fait' : 'montee__palier'} aria-current={p.actif ? 'step' : undefined}>
            <div>
              <p className="montee__charge">
                {texteCharge(p.chargeKg)} × {p.reps} reps
              </p>
              <p className="aide">Repos : {texteDuree(p.reposSec)}</p>
            </div>
            {p.fait ? (
              <span className="montee__coche" role="img" aria-label="Fait">
                ✓
              </span>
            ) : (
              <button type="button" className="bouton" disabled={!p.actif} aria-label={`Palier ${i + 1} fait`} onClick={() => onFait(i)}>
                ✓ Fait
              </button>
            )}
          </li>
        ))}
      </ol>
      {restantMs > 0 && (
        <p className="montee__chrono" role="timer" aria-live="off">
          Repos : {formaterDuree(restantMs)}
        </p>
      )}
    </Feuille>
  )
}
