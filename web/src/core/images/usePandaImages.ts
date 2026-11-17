import { useSessionOptionnelle } from '../auth/useSessionOptionnelle'
import { pandaImage, type ImagePanda, type PandaImageName } from './pandaImage'
import type { TailleImage } from './types'
import { usePandaVariante } from './usePandaVariante'

/**
 * Illustrations du panda pour la variante du profil. Une seule lecture de la variante pour toutes les images de l'écran ;
 * null tant qu'elle n'est pas connue (place réservée, pas de saut). Sans session (tests, écran hors connexion) : variante par défaut (garçon).
 */
export function usePandaImages(): (nom: PandaImageName, taille?: TailleImage) => ImagePanda | null {
  const session = useSessionOptionnelle()
  const variante = usePandaVariante({ userId: session?.user.id })
  return (nom, taille) => (variante === null ? null : pandaImage(nom, variante, taille))
}
