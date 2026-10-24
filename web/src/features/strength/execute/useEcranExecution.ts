import { useCallback } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '../../../core/auth/AuthProvider'
import { useImagePanda } from '../../../core/images/usePandaVariante'
import { useExecute } from './useExecute'
import { useWakeLock } from './useWakeLock'
import { formaterDuree, libelleDureeAccessible } from './vue'

// Orchestration de l'écran d'exécution : données et actions (useExecute), écran gardé allumé pendant
// la séance, confirmation de fin puis ouverture du bilan, textes du chrono et du repos.
export function useEcranExecution(instanceId: string) {
  const { session } = useAuth()
  const ex = useExecute(instanceId, { userId: session?.user.id })
  const navigate = useNavigate()
  const { terminer } = ex
  useWakeLock(ex.demarre && !ex.terminee)
  const pandaMotivation = useImagePanda('motivation', { userId: session?.user.id, taille: 'sm' })

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
    // Panda de motivation, affiché avant le démarrage de la séance
    pandaMotivation: ex.trouvee && !ex.demarre && !ex.terminee ? pandaMotivation : undefined,
    terminerAvecConfirmation,
  }
}
