import type { Session } from '@supabase/auth-js'
import { useContext } from 'react'
import { AuthContext } from './AuthContext'

/** Session courante, ou null sans AuthProvider (écrans testés seuls) : pour les usages facultatifs comme choisir la variante du panda. */
export function useSessionOptionnelle(): Session | null {
  return useContext(AuthContext)?.session ?? null
}
