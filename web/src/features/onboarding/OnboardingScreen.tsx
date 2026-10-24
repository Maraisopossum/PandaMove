import { PandaIllustration } from '../../core/images/PandaIllustration'
import type { useOnboarding } from './useOnboarding'
import { useFocusEtape } from './useFocusEtape'

interface Props {
  onboarding: ReturnType<typeof useOnboarding>
}

// Onboarding du premier lancement (5 étapes, ignorable). Aucune logique ici : état et actions
// viennent de useOnboarding ; le focus suit le titre de l'étape courante.
export function OnboardingScreen({ onboarding: o }: Props) {
  const refTitre = useFocusEtape<HTMLHeadingElement>(o.index)

  return (
    <main
      className="onboarding"
      aria-labelledby="onboarding-titre"
      onKeyDown={(e) => {
        if (o.surTouche(e.key)) e.preventDefault()
      }}
    >
      <div className="onboarding__haut">
        <p className="onboarding__progression">{o.libelleProgression}</p>
        <button type="button" className="bouton" onClick={o.passer}>
          Passer
        </button>
      </div>

      <PandaIllustration
        key={o.image.src}
        image={o.image}
        sizes="(min-width: 480px) 280px, 60vw"
        /* Première étape visible dès l'ouverture : chargée sans attendre (LCP) */
        prioritaire={o.estPremiere}
        className="onboarding__image"
      />

      <h1 id="onboarding-titre" ref={refTitre} tabIndex={-1} className="onboarding__titre">
        {o.etape.titre}
      </h1>
      <p className="onboarding__texte">{o.etape.texte}</p>

      <ol className="onboarding__points" aria-hidden="true">
        {Array.from({ length: o.total }, (_, i) => (
          <li key={i} className={i === o.index ? 'onboarding__point onboarding__point--actif' : 'onboarding__point'} />
        ))}
      </ol>

      <div className="onboarding__actions">
        <button type="button" className="bouton" onClick={o.precedent} disabled={o.estPremiere}>
          Précédent
        </button>
        {o.estDerniere ? (
          <button type="button" className="bouton bouton--principal" onClick={o.terminer}>
            Commencer
          </button>
        ) : (
          <button type="button" className="bouton bouton--principal" onClick={o.suivant}>
            Suivant
          </button>
        )}
      </div>
    </main>
  )
}
