import { useEffect } from 'react'

// Fermeture ou rechargement de l'onglet avec des modifications non enregistrées : le navigateur demande confirmation.
export function useAvertissementFermeture(modifie: boolean) {
  useEffect(() => {
    if (!modifie) return
    const surFermeture = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', surFermeture)
    return () => window.removeEventListener('beforeunload', surFermeture)
  }, [modifie])
}
