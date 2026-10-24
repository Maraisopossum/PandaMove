/* eslint-disable react-refresh/only-export-components -- le contexte et son hook vivent ensemble */
import type { Session } from '@supabase/supabase-js'
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { getSupabase } from '../db/client'

export interface AuthContextValue {
  session: Session | null
  signIn(email: string, password: string): Promise<void>
  signUp(email: string, password: string): Promise<void>
  signInWithMagicLink(email: string): Promise<void>
  signOut(): Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)

  useEffect(() => {
    const supabase = getSupabase()
    // Session persistée (rechargement de page), puis suivi des connexions / déconnexions
    void supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_event, nouvelle) => setSession(nouvelle))
    return () => data.subscription.unsubscribe()
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      async signIn(email, password) {
        const { error } = await getSupabase().auth.signInWithPassword({ email, password })
        if (error) throw error
      },
      async signUp(email, password) {
        const { error } = await getSupabase().auth.signUp({ email, password })
        if (error) throw error
      },
      async signInWithMagicLink(email) {
        const { error } = await getSupabase().auth.signInWithOtp({
          email,
          options: { emailRedirectTo: window.location.origin },
        })
        if (error) throw error
      },
      async signOut() {
        const { error } = await getSupabase().auth.signOut()
        if (error) throw error
      },
    }),
    [session],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const contexte = useContext(AuthContext)
  if (!contexte) throw new Error('useAuth doit être utilisé dans un <AuthProvider>.')
  return contexte
}
