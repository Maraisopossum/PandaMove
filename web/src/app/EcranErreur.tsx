import { detailsErreur, messageErreur } from './erreurs'
import { useCopieErreur } from './useCopieErreur'

// Écran d'erreur commun (frontière racine et erreurs de route) : message en français, détail technique
// affiché en développement, bouton « Copier » pour transmettre l'erreur en production.
export function EcranErreur({ erreur, dev = import.meta.env.DEV }: { erreur: unknown; dev?: boolean }) {
  const { confirmation, copier } = useCopieErreur(erreur)
  return (
    <main className="erreur-racine">
      <h1>Oups</h1>
      <p role="alert">{messageErreur(erreur)}</p>
      {dev && (
        <pre className="erreur-racine__detail" aria-label="Détail technique de l'erreur" tabIndex={0}>
          {detailsErreur(erreur)}
        </pre>
      )}
      <button type="button" className="bouton" onClick={() => void copier()}>
        Copier les détails de l'erreur
      </button>
      <p role="status">{confirmation}</p>
    </main>
  )
}
