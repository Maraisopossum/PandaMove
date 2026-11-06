import type { CSSProperties } from 'react'
import { Link } from 'react-router'
import { MODULES, urlIcone } from '../../app/modules'
import { PandaIllustration } from '../../core/images/PandaIllustration'
import { CarteDemarrage } from '../demarrage/CarteDemarrage'
import { useEcranAccueil } from './useEcranAccueil'

// Modules proposés en accès rapide, dans l'ordre d'affichage (libellé, chemin, couleur et pastille viennent de MODULES).
const TUILES = ['strength', 'running', 'cycling', 'calendar', 'stats', 'breathing'] as const

// Accueil : panda sur halo, accroche, accès directs aux six modules (pastilles illustrées). Le titre de page « Accueil »
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
      <nav aria-label="Accès rapides" className="accueil__tuiles">
        {TUILES.map((id) => {
          const { path, label, color, icone } = MODULES[id]
          return (
            <Link key={id} to={path} className="accueil__tuile" aria-label={label} style={{ '--couleur-module': color } as CSSProperties}>
              <img className="accueil__puce" src={urlIcone(icone)} alt="" width={50} height={50} decoding="async" />
              <span className="accueil__tuile-titre">{label}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
