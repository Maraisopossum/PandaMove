import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  // Seuls les *.spec.ts sont des tests Playwright ; les *.test.ts de e2e/ sont des tests Vitest
  testMatch: '**/*.spec.ts',
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
  },
  use: { baseURL: 'http://localhost:5173' },
})
