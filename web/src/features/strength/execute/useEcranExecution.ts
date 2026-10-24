import { useCallback } from 'react'
import { useNavigate } from 'react-router'
import { useExecute } from './useExecute'
import { useWakeLock } from './useWakeLock'
import { formaterDuree, libelleDureeAccessible } from './vue'

// Orchestration de l'écran d'exécution : données et actions (useExecute), écran gardé allumé pendant
// la séance, confirmation de fin puis ouverture du bilan, textes du chrono et du repos.
export function useEcranExecution(instanceId: string) {
  const ex = useExecute(instanceId)
  const navigate = useNavigate()
  const { terminer } = ex
  useWakeLock(ex.demarre && !ex.terminee)

  const terminerAvecConfirmation = useCallback(async () => {
    if (!window.confirm('Terminer la séance ? Les séries saisies sont enregistrées ; la séance ne sera plus modifiable.')) return
    if (await terminer()) navigate(`/strength/instance/${instanceId}/report`)
  }, [instanceId, navigate, terminer])

  return {
    ...ex,
    chrono: formaterDuree(ex.elapsedMs),
    libelleChrono: libelleDureeAccessible(ex.elapsedMs),
    texteRepos:
      ex.reposRestantMs === null ? null : ex.reposRestantMs === 0 ? 'Repos terminé' : `Repos : ${formaterDuree(ex.reposRestantMs)}`,
    lienBilan: `/strength/instance/${instanceId}/report`,
    terminerAvecConfirmation,
  }
}
