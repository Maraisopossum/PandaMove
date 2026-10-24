import { useState } from 'react'
import { createBrowserRouter, RouterProvider } from 'react-router'
import { AppShell } from './app/AppShell'
import { ErrorBoundary } from './app/ErrorBoundary'
import { construireRoutes } from './app/routes'
import { AuthProvider, useAuth } from './core/auth/AuthProvider'
import LoginScreen from './features/auth/LoginScreen'

// Routeur créé une seule fois par session de connexion ; la coque monte la synchro pour toute route.
function Connecte() {
  const [routeur] = useState(() => createBrowserRouter(construireRoutes(<AppShell />)))
  return <RouterProvider router={routeur} />
}

function Contenu() {
  const { session } = useAuth()
  return session ? <Connecte /> : <LoginScreen />
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Contenu />
      </AuthProvider>
    </ErrorBoundary>
  )
}
