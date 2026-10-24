import type { VitePWAOptions } from 'vite-plugin-pwa'

// Couleurs neutres pour l'instant : la direction visuelle arrive avec les écrans (tâches suivantes).
const COULEUR = '#ffffff'

export const pwaOptions: Partial<VitePWAOptions> = {
  registerType: 'autoUpdate',
  manifest: {
    name: 'PandaMove',
    short_name: 'PandaMove',
    description: 'Suivi de séances de renforcement, utilisable hors ligne.',
    lang: 'fr',
    display: 'standalone',
    start_url: '/',
    scope: '/',
    theme_color: COULEUR,
    background_color: COULEUR,
    icons: [
      { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  },
  workbox: {
    // Shell uniquement : JS / CSS / HTML, les icônes, et le wasm SQLite (indispensable pour démarrer
    // hors ligne, la base locale étant ouverte dès le chargement). Aucune autre image n'est précachée.
    globPatterns: ['**/*.{js,css,html,wasm}', 'icons/*.png'],
    // Le wasm de wa-sqlite dépasse la limite par défaut (2 Mio)
    maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
    // Repli SPA : toute navigation hors ligne sert index.html
    navigateFallback: '/index.html',
    cleanupOutdatedCaches: true,
  },
}
