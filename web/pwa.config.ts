import type { VitePWAOptions } from 'vite-plugin-pwa'

// Fond neutre de l'application (--fond du thème clair) : écran de lancement et barre système sans flash blanc
const COULEUR = '#f6f6f8'

export const pwaOptions: Partial<VitePWAOptions> = {
  registerType: 'autoUpdate',
  manifest: {
    name: 'PandaMove',
    short_name: 'PandaMove',
    description: 'Renforcement, course, vélo, mobilité et respiration : séances, calendrier et statistiques, utilisable hors ligne.',
    lang: 'fr',
    display: 'standalone',
    start_url: '/',
    scope: '/',
    theme_color: COULEUR,
    background_color: COULEUR,
    // Appui long sur l'icône de l'application installée : quatre actions de Nutrition (Android en affiche quatre au plus). Les adresses sont
    // celles des écrans ; `?action=eau` ajoute 250 ml au jour courant puis propose d'annuler (NutritionScreen).
    shortcuts: [
      { name: 'Photographier l’assiette', short_name: 'Photo', url: '/nutrition/photo' },
      { name: 'Ajouter 250 ml d’eau', short_name: '+ 250 ml', url: '/nutrition?action=eau' },
      { name: 'Ajouter un aliment', short_name: 'Aliment', url: '/nutrition/ajouter' },
      { name: 'Journal du jour', short_name: 'Journal', url: '/nutrition' },
    ],
    // Partager une photo vers PandaMove (galerie, appareil photo) : reçue par public/partage-sw.js, analysée par l'écran Photo de l'assiette.
    // Disponible pour l'application installée seulement.
    share_target: {
      action: '/nutrition/photo',
      method: 'POST',
      enctype: 'multipart/form-data',
      params: { files: [{ name: 'image', accept: ['image/*'] }] },
    },
    icons: [
      { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      // Silhouette blanche : icônes thématiques d'Android et petite icône des notifications de l'application installée
      { src: 'icons/icon-monochrome-512.png', sizes: '512x512', type: 'image/png', purpose: 'monochrome' },
    ],
  },
  workbox: {
    // Shell uniquement : JS / CSS / HTML, les icônes, le splash et le wasm SQLite (indispensable pour
    // démarrer hors ligne, la base locale étant ouverte dès le chargement). Seule la variante asynchrone
    // non chiffrée de wa-sqlite est chargée (VFS IndexedDB par défaut de PowerSync, sans clé de chiffrement) :
    // les trois autres variantes (sync, mc-*) pèsent ~4,9 Mo et ne sont jamais demandées, donc pas précachées. Les autres images du panda
    // (public/panda/) sont chargées à la demande et ne sont jamais précachées (spec §8). Les pastilles du menu
    // (icons/menu/, 13 petites images) font partie du shell de navigation : précachées.
    // Polices hébergées (Plus Jakarta Sans, Inter, sous-ensemble latin) : affichage identique hors ligne.
    globPatterns: ['**/*.{js,css,html,woff2}', 'assets/wa-sqlite-async-*.wasm', 'icons/*.png', 'icons/menu/*.webp', 'panda/splash-*.webp'],
    // Le wasm de wa-sqlite dépasse la limite par défaut (2 Mio)
    maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
    // Notifications push (rappels application fermée) : gestionnaires `push` et `notificationclick` de public/push-sw.js,
    // exécutés dans le service worker principal ; `partage-sw.js` reçoit les photos partagées vers l'application (share_target)
    importScripts: ['push-sw.js', 'partage-sw.js'],
    // Repli SPA : toute navigation hors ligne sert index.html
    navigateFallback: '/index.html',
    // Images du panda et illustrations de mobilité : mises en cache à la première vue (non précachées),
    // pour qu'une séance déjà ouverte s'affiche avec ses images hors ligne.
    runtimeCaching: [
      {
        urlPattern: ({ url, sameOrigin }) => sameOrigin && /^\/(panda|mobilite)\/.*\.webp$/.test(url.pathname),
        handler: 'CacheFirst',
        options: {
          cacheName: 'images-panda',
          expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 180 },
        },
      },
    ],
    cleanupOutdatedCaches: true,
  },
}
