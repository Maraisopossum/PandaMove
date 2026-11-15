import type { ReactNode } from 'react'
import { Navigate } from 'react-router'
import { estAdmin } from '../../core/admin/admin'
import { useAuth } from '../../core/auth/AuthProvider'

// Les écrans d'administration n'existent que pour le rôle administrateur du JWT : sinon redirection vers l'accueil, sans message
// (l'écran ne révèle pas son existence). Le vrai contrôle est celui du serveur ; ceci évite seulement d'afficher une page vide.
export function GardeAdmin({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  return estAdmin(session) ? <>{children}</> : <Navigate to="/" replace />
}
