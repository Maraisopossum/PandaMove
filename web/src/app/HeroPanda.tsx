import type { ReactNode } from 'react'
import { PandaIllustration } from '../core/images/PandaIllustration'
import type { PandaImageName } from '../core/images/pandaImage'
import { usePandaImages } from '../core/images/usePandaImages'

export type TeinteModule = 'nutrition' | 'stats' | 'outils' | 'hyrox' | 'calendrier'

/**
 * Bloc d'accueil d'un écran de module : un titre, une phrase et le panda du sujet (dessin fait avec Gemini, décoratif), sur le fond teinté du module.
 * Les maquettes (Claude Design, 2026-11-17) en donnent la forme ; la teinte suit la couleur du module (--hero-* dans app.css).
 */
export function HeroPanda({ module, image, titre, texte, etiquette, children, taille = 'lg' }: {
  module: TeinteModule
  image: PandaImageName
  titre: string
  texte?: string
  etiquette?: string
  children?: ReactNode
  taille?: 'sm' | 'lg'
}) {
  const images = usePandaImages()
  return (
    <section className={`hero-module hero-module--${module}`} aria-label={etiquette ?? titre}>
      <div className="hero-module__texte">
        <p className="hero-module__titre">{titre}</p>
        {texte && <p className="hero-module__phrase">{texte}</p>}
        {children}
      </div>
      <PandaIllustration image={images(image, taille)} sizes="132px" decoratif className="hero-module__panda" />
    </section>
  )
}
