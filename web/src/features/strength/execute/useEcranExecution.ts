import { useCallback } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '../../../core/auth/AuthProvider'
import { useImagePanda } from '../../../core/images/usePandaVariante'
import type { SerieHisto } from './lignesSeries'
import { useExecute } from './useExecute'
import { useHistoriqueExercice } from './useHistoriqueExercice'
import { useNavExercices } from './useNavExercices'
import { useNotesSeance } from './useNotesSeance'
import { useTableauSeries } from './useTableauSeries'
import { useWakeLock } from './useWakeLock'
import { formaterDuree, libelleDureeAccessible } from './vue'

const SANS_HISTORIQUE: SerieHisto[] = []

// Orchestration de l'écran d'exécution : données et actions (useExecute), écran gardé allumé pendant
// la séance, confirmation de fin puis ouverture du bilan, textes du chrono et du repos.
export function useEcranExecution(instanceId: string) {
  const { session } = useAuth()
  const ex = useExecute(instanceId, { userId: session?.user.id })
  const nav = useNavExercices(ex.blocs, ex.exercices)
  const actif = nav.exerciceActif
  const tableau = useTableauSeries(actif, (actif && ex.precedentes.get(actif.exerciseId)) || SANS_HISTORIQUE, {
    valider: ex.validerSerie,
    devalider: ex.devaliderSerie,
    ajouter: ex.ajouterSerie,
    supprimer: ex.supprimerSerie,
  })
  const historique = useHistoriqueExercice(actif?.exerciseId ?? null)
  const notes = useNotesSeance(ex.notes, ex.enregistrerNotes)
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
    nav,
    tableau,
    historique,
    notes,
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
