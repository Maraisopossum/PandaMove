import { useEffect } from 'react'

interface Sentinelle {
  release(): Promise<void>
  readonly released?: boolean
  // WakeLockSentinel est un EventTarget : « release » est émis quand le verrou est libéré,
  // par l'appli ou par le navigateur (page masquée, économie d'énergie…).
  addEventListener?(type: 'release', ecouteur: () => void): void
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
    let demandeEnCours = false
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
      // Un verrou déjà tenu (et non libéré) ou une demande en vol : rien à redemander
      if (sentinelle?.released) sentinelle = null
      if (sentinelle || demandeEnCours) return
      demandeEnCours = true
      try {
        const nouvelle = await api.request('screen')
        if (termine) {
          liberer(nouvelle)
          return
        }
        sentinelle = nouvelle
        // Libération par le navigateur : on oublie la sentinelle (plus de release() sur un verrou mort) ;
        // le verrou sera redemandé au prochain retour au premier plan.
        nouvelle.addEventListener?.('release', () => {
          if (sentinelle === nouvelle) sentinelle = null
        })
      } catch (e) {
        console.warn("Impossible de garder l'écran allumé (verrou d'écran refusé)", e)
      } finally {
        demandeEnCours = false
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
      const derniere = sentinelle
      sentinelle = null
      liberer(derniere)
    }
  }, [actif])
}
