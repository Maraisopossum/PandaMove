import { existsSync, readdirSync, statSync } from 'node:fs'
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

  it("ne précache que le shell de l'application (images : icônes, pastilles du menu et splash seulement)", () => {
    const motifs = pwaOptions.workbox?.globPatterns ?? []
    const motifsImages = motifs.filter((m) => /png|jpg|jpeg|webp|svg/.test(m))
    expect(motifsImages.sort()).toEqual(['icons/*.png', 'icons/menu/*.webp', 'panda/splash-*.webp'])
    // Le motif du splash désigne bien des fichiers produits par scripts/build-images.mjs
    expect(readdirSync(join(__dirname, 'public', 'panda')).filter((f) => /^splash-.*\.webp$/.test(f)).length).toBeGreaterThan(0)
    expect(motifs.join(',')).toMatch(/js/)
    expect(motifs.join(',')).toMatch(/html/)
  })

  it('pastilles du menu précachées : légères (chacune < 40 Ko, 250 Ko au total)', () => {
    const dossier = join(__dirname, 'public', 'icons', 'menu')
    const tailles = readdirSync(dossier).map((f) => statSync(join(dossier, f)).size)
    expect(tailles.length).toBeGreaterThan(0)
    for (const taille of tailles) expect(taille).toBeLessThan(40 * 1024)
    expect(tailles.reduce((a, b) => a + b, 0)).toBeLessThan(250 * 1024)
  })

  it('précache les polices woff2 (rendu identique hors ligne), sans autre format de police', () => {
    const motifs = (pwaOptions.workbox?.globPatterns ?? []).join(',')
    expect(motifs).toMatch(/woff2/)
    expect(motifs).not.toMatch(/woff[^2]|ttf|otf|eot/)
  })

  it('icônes légères (précachées à l’installation) : chacune < 150 Ko', () => {
    for (const icone of manifest.icons) {
      const taille = statSync(join(import.meta.dirname, 'public', icone.src)).size
      expect(taille, icone.src).toBeLessThan(150 * 1024)
    }
  })
})
