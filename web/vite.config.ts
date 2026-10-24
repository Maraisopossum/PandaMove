/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  test: {
    // Les tests e2e Playwright vivent dans e2e/ et ne doivent pas être collectés par Vitest
    include: ['src/**/*.test.{ts,tsx}', 'supabase/tests/**/*.test.ts'],
  },
})
