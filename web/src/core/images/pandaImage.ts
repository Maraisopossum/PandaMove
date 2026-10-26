import type { PandaVariant } from '../db/types'
import { PANDA_MANIFEST, type PandaImageName } from './manifest.generated'
import type { EntreeManifeste, TailleImage } from './types'

export type { PandaImageName } from './manifest.generated'

export interface ImagePanda {
  src: string
  /** Les deux tailles avec descripteurs de largeur, à accompagner d'un attribut `sizes` */
  srcSet: string
  /** Dimensions intrinsèques de la taille demandée (width/height évitent le décalage de mise en page) */
  width: number
  height: number
  /** Texte alternatif français par défaut (passer alt="" quand l'image est décorative) */
  alt: string
}

const manifeste: Record<string, EntreeManifeste> = PANDA_MANIFEST

// Image du panda par nom logique. Variante absente pour ce nom : repli sur l'image commune, sinon
// sur l'autre variante (beaucoup de poses n'existent qu'en version femme). Nom inconnu : erreur
// (impossible à la compilation, PandaImageName étant l'union des noms du manifeste).
export function pandaImage(nom: PandaImageName, variant: PandaVariant, taille: TailleImage = 'lg'): ImagePanda {
  const entree = manifeste[nom]
  if (!entree) throw new Error(`Image du panda inconnue : ${nom}`)
  const autre: PandaVariant = variant === 'male' ? 'female' : 'male'
  const fichiers = entree.variantes[variant] ?? entree.variantes.commun ?? entree.variantes[autre]
  if (!fichiers) throw new Error(`Image du panda sans fichier : ${nom}`)
  const { sm, lg } = fichiers
  const srcSet = sm.src === lg.src ? `${lg.src} ${lg.width}w` : `${sm.src} ${sm.width}w, ${lg.src} ${lg.width}w`
  const choisi = fichiers[taille]
  return { src: choisi.src, srcSet, width: choisi.width, height: choisi.height, alt: entree.alt }
}
