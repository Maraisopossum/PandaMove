import type { Page } from '@playwright/test'

// tsconfig.node n'inclut pas la lib DOM : forme minimale de navigator.serviceWorker (exécuté dans la page)
type NavigateurSw = { serviceWorker?: { ready: Promise<unknown>; controller: unknown } }

/** Délai d'activation du service worker (précache du shell et du wasm, ~9 Mio). */
export const DELAI_SERVICE_WORKER_MS = 60_000

const MESSAGE_ABSENT =
  "Service worker non enregistré ou jamais activé : l'e2e doit tourner sur le build de production " +
  '(npm run build puis npm run preview), avec web/.env.local présent pour que l’application démarre.'

const controlee = (page: Page, timeout: number) =>
  page.waitForFunction(() => (navigator as unknown as NavigateurSw).serviceWorker?.controller != null, undefined, {
    timeout,
  })

// Avant de couper le réseau : le service worker doit être actif (précache terminé, donc shell, chunks
// et wasm disponibles hors ligne) ET contrôler la page, sinon un rechargement hors ligne échoue.
export async function attendreServiceWorker(page: Page, delaiMs = DELAI_SERVICE_WORKER_MS): Promise<void> {
  const actif = await page.evaluate(async (delai) => {
    const sw = (navigator as unknown as NavigateurSw).serviceWorker
    if (!sw) return false
    // Délai explicite : sans worker enregistré, `ready` ne se résout jamais
    return Promise.race([sw.ready.then(() => true), new Promise<boolean>((r) => setTimeout(() => r(false), delai))])
  }, delaiMs)
  if (!actif) throw new Error(MESSAGE_ABSENT)
  try {
    // registerType 'autoUpdate' : clientsClaim, la page passe sous contrôle peu après l'activation
    await controlee(page, 10_000)
  } catch {
    // Repli : un rechargement en ligne place la page sous le contrôle du worker actif
    await page.reload()
    try {
      await controlee(page, 30_000)
    } catch {
      throw new Error(`Service worker actif mais ne contrôlant pas la page après rechargement. ${MESSAGE_ABSENT}`)
    }
  }
}
