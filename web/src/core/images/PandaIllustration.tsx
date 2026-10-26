import type { ImagePanda } from './pandaImage'

interface Props {
  /** Image à afficher ; null tant que la variante du panda n'est pas connue (place réservée). */
  image: ImagePanda | null
  /** Largeur d'affichage pour le choix dans srcSet, ex. "160px" */
  sizes: string
  /** Image purement décorative : alt="" (le texte voisin porte le sens) */
  decoratif?: boolean
  /** Image visible dès le chargement (splash) : pas de chargement différé */
  prioritaire?: boolean
  className?: string
}

// Illustration du panda : srcSet des deux tailles, dimensions intrinsèques (pas de décalage de mise
// en page), chargement différé sauf pour le splash. Aucune logique : l'image vient de pandaImage.
export function PandaIllustration({ image, sizes, decoratif = false, prioritaire = false, className = '' }: Props) {
  const classes = `panda-illustration ${className}`.trim()
  if (!image) return <span className={`${classes} panda-illustration--attente`} aria-hidden="true" />
  return (
    <img
      className={classes}
      src={image.src}
      srcSet={image.srcSet}
      sizes={sizes}
      width={image.width}
      height={image.height}
      alt={decoratif ? '' : image.alt}
      loading={prioritaire ? 'eager' : 'lazy'}
      fetchPriority={prioritaire ? 'high' : undefined}
      decoding="async"
    />
  )
}
