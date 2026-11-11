import { Link } from 'react-router'
import { urlIcone } from '../../app/modules'

const OUTILS = [
  { vers: '/outils/donnees', titre: 'Mes données', texte: 'Sauvegarde, export et import de vos données.', icone: 'import' },
  { vers: '/outils/rappels', titre: 'Rappels', texte: 'Une notification la veille et le jour de vos séances.', icone: 'calendrier' },
  { vers: '/outils/progression', titre: 'Progression', texte: 'La courbe de charge, le record et l’évolution par exercice.', icone: 'stats' },
] as const

// Menu Outils : trois entrées vers des écrans séparés des modules sportifs.
export default function OutilsScreen() {
  return (
    <div className="outils">
      <h1 className="titre-ecran">Outils</h1>
      <ul className="outils__cartes">
        {OUTILS.map((o) => (
          <li key={o.vers}>
            <Link to={o.vers} className="outils__carte">
              <img src={urlIcone(o.icone)} alt="" width={44} height={44} decoding="async" />
              <span>
                <strong>{o.titre}</strong>
                <span className="outils__carte-texte">{o.texte}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
