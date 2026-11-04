import { useEffect } from 'react'

interface VerrouEcran {
  release(): Promise<void>
}

// Garde l'écran allumé tant que `actif` (séance de respiration en cours). L'API Screen Wake Lock n'existe pas partout :
// sans elle, rien ne se passe. Le navigateur libère le verrou quand l'onglet passe en arrière-plan : il est redemandé au retour.
export function useVeilleEcran(actif: boolean): void {
  useEffect(() => {
    const wakeLock = typeof navigator === 'undefined' ? undefined : (navigator as { wakeLock?: { request(type: 'screen'): Promise<VerrouEcran> } }).wakeLock
    if (!actif || !wakeLock) return
    let verrou: VerrouEcran | null = null
    let annule = false

    const demander = () => {
      wakeLock
        .request('screen')
        .then((v) => {
          if (annule) void v.release().catch(() => undefined)
          else verrou = v
        })
        .catch(() => undefined) // refus (économie d'énergie...) : la séance continue sans
    }
    const auRetour = () => {
      if (document.visibilityState === 'visible') demander()
    }

    demander()
    document.addEventListener('visibilitychange', auRetour)
    return () => {
      annule = true
      document.removeEventListener('visibilitychange', auRetour)
      void verrou?.release().catch(() => undefined)
    }
  }, [actif])
}
