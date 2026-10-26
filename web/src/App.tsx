import { useState } from 'react'
import { createBrowserRouter, RouterProvider } from 'react-router'
import { AppShell } from './app/AppShell'
import { ErrorBoundary } from './app/ErrorBoundary'
import { construireRoutes } from './app/routes'
import { AuthProvider, useAuth } from './core/auth/AuthProvider'
import LoginScreen from './features/auth/LoginScreen'
import { OnboardingScreen } from './features/onboarding/OnboardingScreen'
import { useOnboarding } from './features/onboarding/useOnboarding'

// Routeur créé une seule fois par session de connexion ; la coque monte la synchro pour toute route.
function Connecte() {
  const [routeur] = useState(() => createBrowserRouter(construireRoutes(<AppShell />)))
  return <RouterProvider router={routeur} />
}

function Contenu() {
  const { session } = useAuth()
  return session ? <Connecte /> : <LoginScreen />
}

// Premier lancement : l'onboarding s'affiche avant tout (connexion comprise), jusqu'à « Passer » ou « Commencer ».
export default function App() {
  const onboarding = useOnboarding()
  if (onboarding.afficher) {
    return (
      <ErrorBoundary>
        <OnboardingScreen onboarding={onboarding} />
      </ErrorBoundary>
    )
  }
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Contenu />
      </AuthProvider>
    </ErrorBoundary>
  )
}
