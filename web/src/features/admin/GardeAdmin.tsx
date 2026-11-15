import type { ReactNode } from 'react'
import { Link, Navigate } from 'react-router'
import { estAdmin } from '../../core/admin/admin'
import { useAuth } from '../../core/auth/AuthProvider'
import { niveauDuJeton } from '../../core/auth/mfa'

// Les écrans d'administration n'existent que pour le rôle administrateur du JWT : sinon redirection vers l'accueil, sans message
// (l'écran ne révèle pas son existence). Le serveur exige en plus le second facteur (aal2) : un administrateur qui ne l'a pas encore
// activé, ou dont la session n'a pas passé le code, voit comment l'activer. Le vrai contrôle est celui du serveur.
export function GardeAdmin({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  if (!estAdmin(session)) return <Navigate to="/" replace />
  if (niveauDuJeton(session) !== 'aal2') {
    return (
      <div className="plans admin">
        <h1 className="titre-ecran">Administration</h1>
        <p role="alert">L’administration exige la double authentification. Activez-la dans votre profil, puis reconnectez-vous et saisissez le code à 6 chiffres.</p>
        <Link className="plans__lien" to="/profile">Ouvrir mon profil</Link>
      </div>
    )
  }
  return <>{children}</>
}
