import { useId, useRef } from 'react'
import { usePiegeFocus } from '../../usePiegeFocus'
import { formaterDuree } from '../vue'
import { annonce, dureeParlee } from './annonces'
import type { Affichage } from './machine'

interface Props {
  affichage: Affichage
  onArreter: () => void
}

const sansEffet = () => {}

function etiquette(a: Affichage): string {
  if (a.phase === 'decompte') return 'Prêt ?'
  if (a.phase === 'actif' && a.serie) return `Série ${a.serie.numero}${a.serie.cote} sur ${a.serie.total}`
  if (a.repos?.nature === 'fin-tour') return 'Fin du tour — repos'
  if (a.repos?.nature === 'cote') return 'Changez de côté'
  return 'Repos'
}

// Écran plein écran du décompte 3-2-1, de l'exercice chronométré et du repos (Android : CountdownOverlay et
// CircuitOverlay). Dialogue modal : le focus est sur « Arrêter », Échap ne l'actionne pas (geste involontaire),
// le temps restant est en très grand mais NON annoncé seconde par seconde : une région vivante polie
// ne reçoit qu'une phrase par changement de phase ou de série. Présentation seule.
export function OverlayCircuit({ affichage: a, onArreter }: Props) {
  const racine = useRef<HTMLDivElement>(null)
  const boutonArret = useRef<HTMLButtonElement>(null)
  const idNom = useId()
  usePiegeFocus(racine, sansEffet, boutonArret)
  const temps = a.phase === 'decompte' ? String(a.restantSec) : formaterDuree(a.restantSec * 1000)

  return (
    <div className="circuit-voile">
      <div ref={racine} className="circuit" role="dialog" aria-modal="true" aria-labelledby={idNom} tabIndex={-1} data-phase={a.phase}>
        <p className="circuit__etiquette">{etiquette(a)}</p>
        <h2 id={idNom} className="circuit__nom">
          {a.nomExercice}
        </h2>
        <p
          className="circuit__temps"
          role="timer"
          aria-live="off"
          aria-label={`Temps restant : ${dureeParlee(a.restantSec)}`}
          data-niveau={a.niveau}
          data-phase={a.phase}
        >
          {temps}
        </p>
        {a.phase === 'actif' && a.position && (
          <p className="circuit__detail">
            Exercice {a.position.rang} sur {a.position.total}
          </p>
        )}
        {a.phase === 'repos' && a.repos && <p className="circuit__detail">Prochain : {a.repos.prochain}</p>}
        <button ref={boutonArret} type="button" className="bouton circuit__arreter" onClick={onArreter}>
          <span aria-hidden="true">■ </span>
          {a.mode === 'seul' ? 'Arrêter le minuteur' : 'Arrêter le circuit'}
        </button>
        <p className="visuellement-cache" role="status" aria-live="polite">
          {annonce(a)}
        </p>
      </div>
    </div>
  )
}
