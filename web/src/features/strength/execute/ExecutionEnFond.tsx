import { lazy, Suspense, useEffect, useState } from 'react'
import { matchPath, useLocation } from 'react-router'
import { estSeanceEnCours } from './seanceEnCours'

const ExecuteScreen = lazy(() => import('./ExecuteScreen'))

// Écran d'exécution gardé en vie : monté à l'ouverture d'une séance (/strength/instance/:id), il reste monté mais
// masqué quand on navigue ailleurs tant que la séance est en cours, pour que le circuit, le repos, les bips et le
// chrono continuent. Il est démonté dès que la séance n'est plus en cours (terminée, supprimée, remise à zéro).
export function ExecutionEnFond() {
  const { pathname } = useLocation()
  const ici = matchPath('/strength/instance/:id', pathname)?.params.id ?? null
  const [garde, setGarde] = useState<string | null>(null)

  // Ouverture d'une séance : elle devient celle à garder (ajustement d'état pendant le rendu)
  if (ici !== null && ici !== garde) setGarde(ici)

  useEffect(() => {
    if (garde === null || ici === garde) return
    let annule = false
    const verifier = async () => {
      try {
        if (!(await estSeanceEnCours(garde)) && !annule) setGarde(null)
      } catch {
        if (!annule) setGarde(null)
      }
    }
    void verifier()
    const minuteur = setInterval(() => void verifier(), 10_000)
    return () => {
      annule = true
      clearInterval(minuteur)
    }
  }, [garde, ici, pathname])

  const id = ici ?? garde
  if (id === null) return null
  const visible = ici === id
  return (
    <div style={visible ? undefined : { display: 'none' }}>
      <Suspense fallback={<p>Chargement…</p>}>
        <ExecuteScreen key={id} instanceId={id} enFond={!visible} />
      </Suspense>
    </div>
  )
}
