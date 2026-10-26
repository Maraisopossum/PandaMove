import { Link, useLocation } from 'react-router'
import { elapsedMs, estEnPause } from './sessionClock'
import { useSeanceActive } from './useSeanceActive'
import { useTicker } from './useTicker'
import { formaterDuree } from './vue'

// Bandeau « Séance en cours » affiché sur tous les écrans sauf celui de la séance elle-même (bandeau de séance active de
// l'Android, reprise en un clic). Présentation : la séance et le chrono viennent de useSeanceActive.
export function BandeauSeanceActive() {
  const seance = useSeanceActive()
  const { pathname } = useLocation()
  const { now } = useTicker(seance !== null, Date.now, 1000)
  if (!seance || pathname.startsWith(`/strength/instance/${seance.id}`)) return null
  const pause = estEnPause(seance.horloge)
  return (
    <section className="seance-active" aria-label="Séance en cours">
      <p className="seance-active__texte">
        <strong>{seance.nom}</strong>
        <span className="seance-active__chrono" role="timer" aria-live="off">
          {pause ? 'En pause' : formaterDuree(elapsedMs(seance.horloge, now))}
        </span>
      </p>
      <Link to={`/strength/instance/${seance.id}`} className="bouton bouton--principal lien-bouton">
        Reprendre
      </Link>
    </section>
  )
}
