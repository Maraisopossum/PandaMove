import { defineConfig } from '@playwright/test'

// L'e2e est servi par le build de production (`vite preview`, port fixe) : le service worker et le
// rechargement hors ligne n'existent qu'en build (le serveur de dev n'a pas de service worker).
const URL_PREVIEW = 'http://localhost:4173'

export default defineConfig({
  testDir: './e2e',
  // Seuls les *.spec.ts sont des tests Playwright ; les *.test.ts de e2e/ sont des tests Vitest
  testMatch: '**/*.spec.ts',
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: URL_PREVIEW,
    reuseExistingServer: true,
    // Build complet (tsc + vite + PWA) avant le premier test
    timeout: 300_000,
  },
  use: { baseURL: URL_PREVIEW },
})
