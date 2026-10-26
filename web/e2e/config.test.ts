import { describe, expect, it } from 'vitest'
import config from '../playwright.config.ts'

// Le hors-ligne (rechargement réseau coupé) n'existe qu'avec le service worker, donc en build :
// l'e2e doit être servi par `vite preview` sur un port fixe, jamais par le serveur de dev.
describe('playwright.config', () => {
  const serveur = Array.isArray(config.webServer) ? config.webServer[0] : config.webServer

  it('sert le build de production (build puis preview) sur un port fixe', () => {
    expect(serveur?.command).toMatch(/npm run build && npm run preview -- --port 4173 --strictPort/)
    expect(serveur?.command).not.toMatch(/npm run dev/)
    expect(serveur?.url).toBe('http://localhost:4173')
  })

  it("l'URL de base pointe sur le serveur de preview", () => {
    expect(config.use?.baseURL).toBe('http://localhost:4173')
  })
})
