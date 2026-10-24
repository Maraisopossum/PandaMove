import { describe, expect, it } from 'vitest'
import type { AuthContextValue } from './AuthProvider'

// Garde de compilation (tsc -b) : le contexte d'authentification n'expose PAS de signOut brut.
// Toute déconnexion passe par signOutSafely (useSyncConnection), qui refuse de déconnecter tant que
// des modifications locales ne sont pas envoyées ; un signOut direct contournerait cette protection.
type SansSignOut = 'signOut' extends keyof AuthContextValue ? false : true
const garde: SansSignOut = true

describe('AuthContextValue', () => {
  it("n'expose pas de signOut brut (seul signOutSafely déconnecte)", () => {
    expect(garde).toBe(true)
  })
})
