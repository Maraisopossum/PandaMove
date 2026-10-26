/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { pwaOptions } from './pwa.config.ts'

export default defineConfig({
  plugins: [react(), VitePWA(pwaOptions)],
  // Playwright (webServer) attend exactement ce port
  server: { port: 5173, strictPort: true },
  // Config recommandée par PowerSync pour @powersync/web : ne pas pré-bundler le SDK ni wa-sqlite
  // (le worker et les .wasm sont résolus via new URL(..., import.meta.url)) et utiliser des workers ES.
  optimizeDeps: { exclude: ['@journeyapps/wa-sqlite', '@powersync/web'] },
  worker: { format: 'es' },
  // Le SDK PowerSync + Supabase pèse ~550 Kio : seuil relevé pour garder un build sans avertissement
  build: { chunkSizeWarningLimit: 800 },
  test: {
    // Machines lentes (CI) : les attentes asynchrones et les tests ont plus de temps avant d'échouer.
    setupFiles: ['src/test/setup.ts'],
    testTimeout: 20_000,
    hookTimeout: 20_000,
    // Les tests e2e Playwright vivent dans e2e/ et ne doivent pas être collectés par Vitest
    include: ['src/**/*.test.{ts,tsx}', 'supabase/tests/**/*.test.ts', 'pwa.config.test.ts', 'powersync/**/*.test.ts', 'e2e/**/*.test.ts'],
  },
})
