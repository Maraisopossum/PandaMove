// Types du manifeste d'images (le manifeste lui-même est généré par scripts/build-images.mjs).

export type TailleImage = 'sm' | 'lg'

/** Variante du panda d'une image ; `commun` = image identique pour les deux variantes. */
export type VarianteImage = 'male' | 'female' | 'commun'

export interface FichierImage {
  /** Chemin servi, ex. /panda/joy-male-sm.webp */
  src: string
  width: number
  height: number
}

export interface EntreeManifeste {
  /** Texte alternatif français par défaut (les images décoratives utilisent alt="") */
  alt: string
  variantes: Partial<Record<VarianteImage, Record<TailleImage, FichierImage>>>
}
