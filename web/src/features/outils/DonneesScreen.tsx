import { Link } from 'react-router'
import { useDonnees } from './useDonnees'

// Mes données : ce que contient l'appareil, dernière sauvegarde, export JSON et lien vers l'import.
// Logique dans useDonnees ; l'export est celui du profil (useExport).
export default function DonneesScreen() {
  const d = useDonnees()
  const { sauvegarde } = d
  return (
    <div className="outils">
      <h1 className="titre-ecran">Mes données</h1>
      <p className={d.derniere ? 'outils__etat outils__etat--ok' : 'outils__etat'}>
        {d.derniere ? `Dernière sauvegarde : ${d.derniere}` : "Aucune sauvegarde faite depuis cet appareil."}
      </p>
      {d.erreur && <p role="alert">{d.erreur}</p>}
      {d.comptes && (
        <ul className="outils__liste">
          <li>
            <span>Séances types</span>
            <strong>{d.comptes.seances}</strong>
          </li>
          <li>
            <span>Séances terminées</span>
            <strong>{d.comptes.seancesJouees}</strong>
          </li>
          <li>
            <span>Sorties course et vélo</span>
            <strong>{d.comptes.sorties}</strong>
          </li>
          <li>
            <span>Méthodes de respiration</span>
            <strong>{d.comptes.methodes}</strong>
          </li>
        </ul>
      )}
      <p className="aide">L'export JSON contient le renforcement (séances, séries, exercices, objectifs, matériel). Les sorties et la respiration n'y sont pas encore.</p>
      <button type="button" className="bouton bouton--principal" aria-busy={sauvegarde.enCours} disabled={sauvegarde.enCours} onClick={() => void sauvegarde.exporter()}>
        Exporter en JSON
      </button>
      <Link to="/import" className="bouton outils__lien">
        Importer une sauvegarde
      </Link>
      <p role="status" className="profil__retour">
        {sauvegarde.message}
      </p>
      {sauvegarde.erreur && <p role="alert">{sauvegarde.erreur}</p>}
    </div>
  )
}
