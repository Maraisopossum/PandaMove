import { useCallback, useEffect, useState } from 'react'

// Instant courant (ms) rafraîchi toutes les `intervalleMs` tant que `actif` est vrai.
// Ce n'est qu'un déclencheur de rendu : les durées sont toujours recalculées depuis des horodatages,
// donc un onglet masqué (minuteries ralenties) n'introduit aucune dérive.
// `nowFn` doit être une référence stable (injectée par les tests).
export function useTicker(actif: boolean, nowFn: () => number, intervalleMs = 1000) {
  const [now, setNow] = useState(nowFn)
  const rafraichir = useCallback(() => setNow(nowFn()), [nowFn])

  useEffect(() => {
    if (!actif) return
    const id = setInterval(rafraichir, intervalleMs)
    return () => clearInterval(id)
  }, [actif, rafraichir, intervalleMs])

  return { now, rafraichir }
}
