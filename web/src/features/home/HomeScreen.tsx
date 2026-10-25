import { Link } from 'react-router'
import { PandaIllustration } from '../../core/images/PandaIllustration'
import { CarteDemarrage } from '../demarrage/CarteDemarrage'
import { useEcranAccueil } from './useEcranAccueil'

// Accueil : panda de la variante choisie et accès directs aux écrans principaux.
export default function HomeScreen() {
  const { panda } = useEcranAccueil()
  return (
    <div className="accueil">
      <PandaIllustration image={panda} sizes="160px" className="accueil__panda" />
      <h1>Accueil</h1>
      <p className="accueil__texte">Prêt pour votre séance ? Tout est enregistré sur l’appareil, même sans réseau.</p>
      <CarteDemarrage />
      <nav aria-label="Accès rapides" className="accueil__liens">
        <Link to="/strength" className="bouton lien-bouton bouton--principal">
          Renforcement
        </Link>
        <Link to="/calendar" className="bouton lien-bouton">
          Calendrier
        </Link>
        <Link to="/stats" className="bouton lien-bouton">
          Statistiques
        </Link>
      </nav>
    </div>
  )
}
