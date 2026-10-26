import { useEffect, useRef, useState } from 'react'
import { creerSonneur, type Sonneur } from './circuit/audio'
import { bipRepos, finRepos } from './bipsRepos'

// Bips des 5 dernières secondes du repos (Android : bip simple discret à chaque seconde). Réglage « Son » commun avec le
// circuit. Les navigateurs refusent le son avant un geste : le sonneur est préparé au premier appui sur la page
// (« Démarrer », validation d'une série…). Le sonneur est injectable pour les tests.
export function useBipsRepos(restantMs: number | null, son: boolean, sonneurInjecte?: Sonneur) {
  const [sonneur] = useState<Sonneur>(() => sonneurInjecte ?? creerSonneur())
  const precedent = useRef<number | null>(null)

  useEffect(() => {
    if (son && bipRepos(precedent.current, restantMs)) sonneur.jouer('repos')
    if (son && finRepos(precedent.current, restantMs)) sonneur.jouer('finRepos')
    precedent.current = restantMs
  }, [restantMs, son, sonneur])

  useEffect(() => {
    if (!son) return
    const preparer = () => sonneur.preparer()
    window.addEventListener('pointerdown', preparer, { once: true })
    return () => window.removeEventListener('pointerdown', preparer)
  }, [son, sonneur])

  useEffect(() => () => sonneur.fermer(), [sonneur])
}
