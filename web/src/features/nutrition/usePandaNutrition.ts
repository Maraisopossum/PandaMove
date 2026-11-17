import { useSessionOptionnelle } from '../../core/auth/AuthProvider'
import { pandaImage, type ImagePanda, type PandaImageName } from '../../core/images/pandaImage'
import { usePandaVariante } from '../../core/images/usePandaVariante'
import type { TailleImage } from '../../core/images/types'

/**
 * Illustrations du panda du module Nutrition pour la variante du profil. Une seule lecture de la variante pour toutes les images de l'écran ;
 * null tant qu'elle n'est pas connue (place réservée, pas de saut). Sans session (tests, écran hors connexion) : variante par défaut.
 */
export function usePandaNutrition(): (nom: PandaImageName, taille?: TailleImage) => ImagePanda | null {
  const session = useSessionOptionnelle()
  const variante = usePandaVariante({ userId: session?.user.id })
  return (nom, taille) => (variante === null ? null : pandaImage(nom, variante, taille))
}
