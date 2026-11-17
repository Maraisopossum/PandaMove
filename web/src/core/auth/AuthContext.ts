import { createContext } from 'react'
import type { AuthContextValue } from './AuthProvider'

// Contexte d'authentification, dans son propre fichier pour que `useSessionOptionnelle` fonctionne même quand un test remplace AuthProvider.
export const AuthContext = createContext<AuthContextValue | null>(null)
