import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
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

  it('charge public/push-sw.js dans le service worker : gestionnaires push et clic sur la notification', () => {
    expect(pwaOptions.workbox?.importScripts).toEqual(['push-sw.js'])
    const code = readFileSync(join(__dirname, 'public', 'push-sw.js'), 'utf8')
    expect(code).toContain("addEventListener('push'")
    expect(code).toContain("addEventListener('notificationclick'")
    // Message JSON de notre serveur seulement : jamais de HTML ni d'adresse venue du message
    expect(code).not.toMatch(/innerHTML|eval\(|openWindow\(\s*message/)
  })

  it('chaque icône du manifeste a bien la taille déclarée ; la maskable et la monochrome existent', () => {
    // Largeur et hauteur lues dans l'en-tête PNG (octets 16 à 23 : IHDR)
    const dimensions = (fichier: string) => {
      const png = readFileSync(join(__dirname, 'public', fichier))
      return { largeur: png.readUInt32BE(16), hauteur: png.readUInt32BE(20) }
    }
    for (const icone of manifest.icons) {
      const [l, h] = icone.sizes.split('x').map(Number)
      expect(dimensions(icone.src), icone.src).toEqual({ largeur: l, hauteur: h })
    }
    expect(manifest.icons.some((i) => i.purpose === 'maskable')).toBe(true)
    expect(manifest.icons.some((i) => i.purpose === 'monochrome')).toBe(true)
  })

  it('petite icône des notifications : 96 × 96, RGBA (blanc + transparence), précachée avec les autres icônes', () => {
    const png = readFileSync(join(__dirname, 'public', 'icons', 'badge-96.png'))
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([96, 96])
    expect(png[25], 'type de couleur PNG 6 = RGBA').toBe(6)
    expect(pwaOptions.workbox?.globPatterns).toContain('icons/*.png')
    // Les gestionnaires du service worker et la notification locale l'utilisent
    expect(readFileSync(join(__dirname, 'public', 'push-sw.js'), 'utf8')).toContain('/icons/badge-96.png')
    expect(readFileSync(join(__dirname, 'src', 'features', 'outils', 'useRappels.ts'), 'utf8')).toContain('/icons/badge-96.png')
  })

  it('icône d’écran d’accueil iOS : 180 × 180, référencée par index.html', () => {
    const png = readFileSync(join(__dirname, 'public', 'icons', 'apple-touch-icon.png'))
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([180, 180])
    expect(readFileSync(join(__dirname, 'index.html'), 'utf8')).toContain('href="/icons/apple-touch-icon.png"')
  })

  it('icônes légères (précachées à l’installation) : chacune < 150 Ko', () => {
    for (const icone of manifest.icons) {
      const taille = statSync(join(import.meta.dirname, 'public', icone.src)).size
      expect(taille, icone.src).toBeLessThan(150 * 1024)
    }
  })
})
