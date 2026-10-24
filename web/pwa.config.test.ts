import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { pwaOptions } from './pwa.config.ts'

describe('configuration PWA', () => {
  const manifest = pwaOptions.manifest as {
    name: string
    short_name: string
    display: string
    icons: { src: string; sizes: string; purpose?: string }[]
  }

  it('déclare une application installable nommée PandaMove', () => {
    expect(manifest.name).toBe('PandaMove')
    expect(manifest.short_name).toBe('PandaMove')
    expect(manifest.display).toBe('standalone')
  })

  it('référence des icônes 192, 512 et maskable qui existent dans public/', () => {
    const tailles = manifest.icons.map((i) => i.sizes)
    expect(tailles).toContain('192x192')
    expect(tailles).toContain('512x512')
    expect(manifest.icons.some((i) => i.purpose === 'maskable')).toBe(true)
    for (const icone of manifest.icons) {
      expect(existsSync(join(__dirname, 'public', icone.src))).toBe(true)
    }
  })

  it("ne précache que le shell de l'application (images : icônes et splash seulement)", () => {
    const motifs = pwaOptions.workbox?.globPatterns ?? []
    const motifsImages = motifs.filter((m) => /png|jpg|jpeg|webp|svg/.test(m))
    expect(motifsImages.sort()).toEqual(['icons/*.png', 'panda/splash-*.webp'])
    // Le motif du splash désigne bien des fichiers produits par scripts/build-images.mjs
    expect(readdirSync(join(__dirname, 'public', 'panda')).filter((f) => /^splash-.*\.webp$/.test(f)).length).toBeGreaterThan(0)
    expect(motifs.join(',')).toMatch(/js/)
    expect(motifs.join(',')).toMatch(/html/)
  })
})
