import { test } from '@playwright/test'

// Prérequis des e2e (comptes de test fournis par variables d'environnement, jamais écrits en dur).
// Sans les variables, le test est sauté VISIBLEMENT (raison affichée par Playwright) ; avec
// E2E_REQUIRED=1 (ex. vérification avant bascule), il échoue au lieu de sauter.

export type Verdict = { action: 'lancer' } | { action: 'sauter' | 'echouer'; message: string }

export function verdictPrerequis(env: Record<string, string | undefined>, noms: string[]): Verdict {
  const manquantes = noms.filter((n) => !env[n])
  if (manquantes.length === 0) return { action: 'lancer' }
  if (env.E2E_REQUIRED === '1') {
    return { action: 'echouer', message: `E2E_REQUIRED=1 : variables requises absentes : ${manquantes.join(', ')}` }
  }
  return {
    action: 'sauter',
    message: `Variables requises absentes : ${manquantes.join(', ')} (définir E2E_REQUIRED=1 pour faire échouer au lieu de sauter)`,
  }
}

/** À appeler en tête de test : saute ou échoue selon les variables présentes. */
export function exigerVariables(...noms: string[]): void {
  const verdict = verdictPrerequis(process.env, noms)
  if (verdict.action === 'echouer') throw new Error(verdict.message)
  test.skip(verdict.action === 'sauter', verdict.action === 'sauter' ? verdict.message : '')
}
