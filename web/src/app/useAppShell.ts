import { useCallback } from 'react'
import { useLocation } from 'react-router'
import { useAuth } from '../core/auth/AuthProvider'
import { useSyncConnection } from '../core/sync/useSyncConnection'
import { MODULES, moduleActif } from './modules'
import { useDarkMode } from './theme'
import { useDeconnexion } from './useDeconnexion'
import { useDrawer } from './useDrawer'

const CONFIRMATION_ABANDON =
  'Les modifications non synchronisées de l’autre compte seront définitivement perdues. Continuer ?'

// État de la coque : synchro (montée pour toutes les routes), module actif, drawer, thème, déconnexion.
export function useAppShell() {
  const { session, signOut } = useAuth()
  const { pathname } = useLocation()
  const { signOutSafely, abandonnerDonneesLocales, messageAutreCompte } = useSyncConnection({
    userId: session?.user.id ?? null,
    signOut,
  })
  const { refBascule, refDrawer, ...drawer } = useDrawer()
  const sombre = useDarkMode()
  const deconnexion = useDeconnexion(signOutSafely)

  const demanderAbandon = useCallback(() => {
    if (window.confirm(CONFIRMATION_ABANDON)) void abandonnerDonneesLocales()
  }, [abandonnerDonneesLocales])

  return { module: MODULES[moduleActif(pathname)], drawer, refBascule, refDrawer, sombre, deconnexion, messageAutreCompte, demanderAbandon }
}
