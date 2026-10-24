import { useRouteError } from 'react-router'
import { messageErreur } from './erreurs'

// Erreur levée pendant le rendu d'une route (le routeur l'intercepte avant la frontière racine).
export function PageErreur() {
  const erreur = useRouteError()
  return (
    <main className="erreur-racine">
      <h1>Oups</h1>
      <p role="alert">{messageErreur(erreur)}</p>
    </main>
  )
}
