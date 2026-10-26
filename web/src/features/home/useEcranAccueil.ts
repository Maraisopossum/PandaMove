import { useAuth } from '../../core/auth/AuthProvider'
import { useImagePanda } from '../../core/images/usePandaVariante'

// Accueil : panda joyeux de la variante choisie dans le profil.
export function useEcranAccueil() {
  const { session } = useAuth()
  return { panda: useImagePanda('joy', { userId: session?.user.id, taille: 'sm' }) }
}
