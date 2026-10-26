import type { BrowserContext } from '@playwright/test'

// Les parcours e2e commencent sur l'écran de connexion : l'onboarding du premier lancement est marqué
// « vu » (même clé que src/features/onboarding/onboarding.ts) avant tout chargement de page.
export const ignorerOnboarding = (contexte: BrowserContext) =>
  contexte.addInitScript(() => localStorage.setItem('pandamove.onboarding.vu', '1'))
