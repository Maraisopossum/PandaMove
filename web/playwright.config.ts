import { defineConfig } from '@playwright/test'

// L'e2e est servi par le build de production (`vite preview`, port fixe) : le service worker et le
// rechargement hors ligne n'existent qu'en build (le serveur de dev n'a pas de service worker).
const URL_PREVIEW = 'http://localhost:4173'

export default defineConfig({
  testDir: './e2e',
  // Seuls les *.spec.ts sont des tests Playwright ; les *.test.ts de e2e/ sont des tests Vitest
  testMatch: '**/*.spec.ts',
  // Parcours avec synchro réelle (attentes jusqu'à 60 s, second appareil) : 30 s par défaut ne suffisent pas
  timeout: 120_000,
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    // Build de test : embarque l'écran /debug/write (voir src/app/routes.tsx), jamais présent dans le build déployé
    env: { VITE_E2E: '1' },
    url: URL_PREVIEW,
    reuseExistingServer: true,
    // Build complet (tsc + vite + PWA) avant le premier test
    timeout: 300_000,
  },
  // Capture d'écran à l'échec seulement ; jamais de trace (elle contiendrait les mots de passe saisis)
  use: { baseURL: URL_PREVIEW, screenshot: 'only-on-failure', trace: 'off' },
})
