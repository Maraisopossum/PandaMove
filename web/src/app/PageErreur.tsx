import { useRouteError } from 'react-router'
import { EcranErreur } from './EcranErreur'

// Erreur levée pendant le rendu d'une route (le routeur l'intercepte avant la frontière racine).
export function PageErreur() {
  return <EcranErreur erreur={useRouteError()} />
}
