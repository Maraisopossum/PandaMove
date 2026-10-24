import { lazy } from 'react'

// Écrans chargés à la demande (chunks séparés). Fichier dédié : routes.tsx n'exporte ainsi
// que des fonctions, ce que demande la règle react-refresh.
export const ImportScreen = lazy(() => import('../features/import/ImportScreen'))
