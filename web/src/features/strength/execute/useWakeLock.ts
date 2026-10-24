import { useEffect } from 'react'

interface Sentinelle {
  release(): Promise<void>
}
interface ApiVerrou {
  request(type: 'screen'): Promise<Sentinelle>
}

// Garde l'écran allumé pendant la séance (Screen Wake Lock API) quand le navigateur le permet.
// Le navigateur libère le verrou quand la page est masquée : on le redemande au retour au premier plan.
// Ne lève JAMAIS d'exception : API absente => rien ; refus => simple avertissement.
export function useWakeLock(actif: boolean): void {
  useEffect(() => {
    if (!actif || typeof navigator === 'undefined' || !('wakeLock' in navigator)) return
    const api = (navigator as unknown as { wakeLock: ApiVerrou }).wakeLock
    let sentinelle: Sentinelle | null = null
    let termine = false

    const liberer = (s: Sentinelle | null) => {
      if (!s) return
      try {
        void s.release().catch(() => {})
      } catch {
        // verrou déjà libéré par le navigateur : rien à faire
      }
    }

    const acquerir = async () => {
      try {
        const nouvelle = await api.request('screen')
        if (termine) {
          liberer(nouvelle)
          return
        }
        liberer(sentinelle)
        sentinelle = nouvelle
      } catch (e) {
        console.warn("Impossible de garder l'écran allumé (verrou d'écran refusé)", e)
      }
    }

    const surVisibilite = () => {
      if (document.visibilityState === 'visible') void acquerir()
    }

    void acquerir()
    document.addEventListener('visibilitychange', surVisibilite)
    return () => {
      termine = true
      document.removeEventListener('visibilitychange', surVisibilite)
      liberer(sentinelle)
      sentinelle = null
    }
  }, [actif])
}
