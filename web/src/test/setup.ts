import { configure } from '@testing-library/dom'
import { afterEach } from 'vitest'

// findBy* / waitFor attendent 1 s par défaut : trop court sur une machine chargée (CI), d'où des échecs aléatoires.
configure({ asyncUtilTimeout: 6000 })

// Vitest n'expose pas `afterEach` en global : Testing Library ne démonte donc pas les rendus tout seul.
// Un composant resté monté recevait des mises à jour après la fin du test (et la destruction de jsdom), d'où
// des erreurs aléatoires « window is not defined » en CI. Le démontage est ajouté ici pour tous les tests.
afterEach(async () => {
  if (typeof document === 'undefined') return
  const { cleanup } = await import('@testing-library/react')
  cleanup()
})
