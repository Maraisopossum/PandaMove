import { Link } from 'react-router'
import { PandaIllustration } from '../../core/images/PandaIllustration'
import { CarteDemarrage } from '../demarrage/CarteDemarrage'
import { useEcranAccueil } from './useEcranAccueil'

// Pictogrammes décoratifs des cartes (aucun sens porté : le titre de la carte suffit)
const trait = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const

function IconeHaltere() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...trait}>
      <path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11" />
    </svg>
  )
}

function IconeCalendrier() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...trait}>
      <rect x="4" y="5.5" width="16" height="14.5" rx="3" />
      <path d="M8 3.5v4M16 3.5v4M4 10.5h16" />
    </svg>
  )
}

function IconeStats() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...trait}>
      <path d="M5 20V11M12 20V5M19 20v-6" />
    </svg>
  )
}

function Chevron() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...trait}>
      <path d="m9.5 6 6 6-6 6" />
    </svg>
  )
}

// Accueil (maquette Stitch) : panda sur halo, accroche, accès directs aux écrans principaux. Le titre de page « Accueil »
// reste dans l'arbre d'accessibilité (la barre du haut l'affiche déjà). La maquette montre aussi un widget « Dernière
// activité locale » : aucune donnée de dernière séance n'est exposée à l'accueil, il n'est donc pas affiché
// (la reprise d'une séance en cours se fait par le bandeau « Séance en cours » de la coque).
export default function HomeScreen() {
  const { panda } = useEcranAccueil()
  return (
    <div className="accueil">
      <h1 className="visuellement-cache">Accueil</h1>
      <header className="accueil__hero">
        <div className="accueil__halo">
          <PandaIllustration image={panda} sizes="118px" className="accueil__panda" />
        </div>
        <p className="accueil__titre">Prêt pour votre séance ?</p>
        <p className="accueil__texte">Vos données sont enregistrées en direct sur l’appareil. Tout reste accessible même sans réseau.</p>
        <span className="accueil__chip">Stockage local sécurisé</span>
      </header>
      <CarteDemarrage />
      <div className="accueil__section">
        <h2 className="accueil__libelle">Actions rapides</h2>
        <span className="accueil__version">PandaMove v2</span>
      </div>
      <nav aria-label="Accès rapides" className="accueil__liens">
        <Link to="/strength" className="accueil__vedette" aria-label="Renforcement">
          <span className="accueil__vedette-icone">
            <IconeHaltere />
          </span>
          <span className="accueil__vedette-texte">
            <span className="accueil__vedette-titre">
              Renforcement <span className="accueil__go">Go</span>
            </span>
            <span className="accueil__vedette-aide">Programmes, séries &amp; séances</span>
          </span>
          <span className="accueil__vedette-fleche">
            <Chevron />
          </span>
        </Link>
        <div className="accueil__duo">
          <Link to="/calendar" className="accueil__carte accueil__carte--calendrier" aria-label="Calendrier">
            <span className="accueil__carte-icone">
              <IconeCalendrier />
            </span>
            <span className="accueil__carte-titre">Calendrier</span>
            <span className="accueil__carte-aide">Planifier &amp; suivre vos jours</span>
          </Link>
          <Link to="/stats" className="accueil__carte accueil__carte--stats" aria-label="Statistiques">
            <span className="accueil__carte-icone">
              <IconeStats />
            </span>
            <span className="accueil__carte-titre">Statistiques</span>
            <span className="accueil__carte-aide">Volume &amp; progression</span>
          </Link>
        </div>
      </nav>
    </div>
  )
}
