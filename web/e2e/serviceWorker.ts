import type { Page } from '@playwright/test'

// tsconfig.node n'inclut pas la lib DOM : forme minimale de navigator.serviceWorker (exécuté dans la page)
type NavigateurSw = { serviceWorker: { ready: Promise<unknown>; controller: unknown } }

const controlee = (page: Page, timeout: number) =>
  page.waitForFunction(() => (navigator as unknown as NavigateurSw).serviceWorker.controller !== null, undefined, {
    timeout,
  })

// Avant de couper le réseau : le service worker doit être actif (précache terminé, donc shell, chunks
// et wasm disponibles hors ligne) ET contrôler la page, sinon un rechargement hors ligne échoue.
export async function attendreServiceWorker(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await (navigator as unknown as NavigateurSw).serviceWorker.ready
  })
  try {
    // registerType 'autoUpdate' : clientsClaim, la page passe sous contrôle peu après l'activation
    await controlee(page, 10_000)
  } catch {
    // Repli : un rechargement en ligne place la page sous le contrôle du worker actif
    await page.reload()
    await controlee(page, 30_000)
  }
}
