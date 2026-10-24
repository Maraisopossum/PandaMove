import { AuthProvider, useAuth } from './core/auth/AuthProvider'
import DebugWriteScreen from './features/debug/DebugWriteScreen'
import { useSyncConnection } from './features/debug/useSyncConnection'
import LoginScreen from './features/auth/LoginScreen'

// Page de debug : uniquement en développement. Le futur routeur (tâche 5) l'absorbera.
const DEBUG_ACTIF = import.meta.env.DEV && window.location.pathname === '/debug/write'

function Contenu() {
  const { session, signOut } = useAuth()
  const { signOutSafely } = useSyncConnection({ userId: session?.user.id ?? null, signOut })

  if (DEBUG_ACTIF) {
    return session ? (
      <DebugWriteScreen userId={session.user.id} signOutSafely={signOutSafely} />
    ) : (
      <LoginScreen />
    )
  }
  return <h1>PandaMove</h1>
}

// Composant racine minimal : le routage et les écrans arrivent dans les tâches suivantes.
export default function App() {
  return (
    <AuthProvider>
      <Contenu />
    </AuthProvider>
  )
}
