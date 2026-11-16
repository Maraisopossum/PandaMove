import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { pwaOptions } from '../../../pwa.config'
import { CACHE_PARTAGE, CLE_PARTAGE, lirePartage } from './partage'

const code = readFileSync(join(import.meta.dirname, '..', '..', '..', 'public', 'partage-sw.js'), 'utf8')

// Caches factices (Map) : le service worker et le client y lisent et écrivent comme dans le navigateur
function fauxCaches() {
  const magasins = new Map<string, Map<string, Response>>()
  const cache = (nom: string) => {
    const m = magasins.get(nom) ?? new Map<string, Response>()
    magasins.set(nom, m)
    return { put: async (cle: string, r: Response) => void m.set(cle, r), match: async (cle: string) => m.get(cle), delete: async (cle: string) => m.delete(cle) }
  }
  return { open: async (nom: string) => cache(nom), magasins }
}

// Charge partage-sw.js dans un « self » factice et rend son gestionnaire `fetch`
function chargerServiceWorker(caches: ReturnType<typeof fauxCaches>) {
  let gestionnaire: (e: { request: Request; respondWith: (p: Promise<Response>) => void }) => void = () => {}
  const faux = { addEventListener: (type: string, f: typeof gestionnaire) => type === 'fetch' && (gestionnaire = f), location: { origin: 'https://app.test' } }
  new Function('self', 'caches', code)(faux, caches)
  return async (requete: Request): Promise<Response | null> => {
    let reponse: Promise<Response> | null = null
    gestionnaire({ request: requete, respondWith: (p) => (reponse = p) })
    return reponse
  }
}

const post = (corps: FormData, url = 'https://app.test/nutrition/photo') => new Request(url, { method: 'POST', body: corps })
const formulaire = (fichier: File | string) => {
  const f = new FormData()
  f.set('image', fichier)
  return f
}
const photo = (octets = 1000, type = 'image/jpeg') => new File([new Uint8Array(octets)], 'photo.jpg', { type })

afterEach(() => vi.unstubAllGlobals())

describe('service worker de partage de photo', () => {
  it('garde l’image dans le cache dédié et redirige vers l’écran photo avec ?partage=1', async () => {
    const caches = fauxCaches()
    const recevoir = chargerServiceWorker(caches)
    const reponse = await recevoir(post(formulaire(photo())))
    expect(reponse?.status).toBe(303)
    expect(reponse?.headers.get('Location')).toBe('https://app.test/nutrition/photo?partage=1')
    const gardee = await (await caches.open(CACHE_PARTAGE)).match(CLE_PARTAGE)
    expect(gardee?.headers.get('Content-Type')).toBe('image/jpeg')
    expect((await gardee!.blob()).size).toBe(1000)
  })

  it('refuse sans l’enregistrer : fichier qui n’est pas une image, image vide, trop lourde, champ texte', async () => {
    const caches = fauxCaches()
    const recevoir = chargerServiceWorker(caches)
    for (const corps of [formulaire(photo(10, 'application/pdf')), formulaire(photo(0)), formulaire(photo(15 * 1024 * 1024 + 1)), formulaire('pas un fichier')]) {
      const reponse = await recevoir(post(corps))
      expect(reponse?.headers.get('Location')).toBe('https://app.test/nutrition/photo')
    }
    expect(await (await caches.open(CACHE_PARTAGE)).match(CLE_PARTAGE)).toBeUndefined()
  })

  it('ne touche pas aux autres requêtes : GET, autre adresse, autre origine', async () => {
    const recevoir = chargerServiceWorker(fauxCaches())
    expect(await recevoir(new Request('https://app.test/nutrition/photo'))).toBeNull()
    expect(await recevoir(post(formulaire(photo()), 'https://app.test/nutrition'))).toBeNull()
    expect(await recevoir(post(formulaire(photo()), 'https://autre.test/nutrition/photo'))).toBeNull()
  })

  it('les noms du cache et de la clé sont identiques côté service worker et côté application', () => {
    expect(/CACHE_PARTAGE = '([^']+)'/.exec(code)?.[1]).toBe(CACHE_PARTAGE)
    expect(/CLE_PARTAGE = '([^']+)'/.exec(code)?.[1]).toBe(CLE_PARTAGE)
  })

  it('est chargé par le service worker principal', () => {
    expect(pwaOptions.workbox?.importScripts).toContain('partage-sw.js')
  })
})

describe('lecture de la photo partagée', () => {
  it('rend le fichier une seule fois : il est retiré du cache à la lecture', async () => {
    const caches = fauxCaches()
    vi.stubGlobal('caches', caches)
    await (await caches.open(CACHE_PARTAGE)).put(CLE_PARTAGE, new Response(photo(500), { headers: { 'Content-Type': 'image/png' } }))
    const fichier = await lirePartage()
    expect(fichier?.size).toBe(500)
    expect(fichier?.type).toBe('image/png')
    expect(await lirePartage()).toBeNull()
  })

  it('rend null sans partage, sans cache disponible ou si le cache échoue', async () => {
    vi.stubGlobal('caches', fauxCaches())
    expect(await lirePartage()).toBeNull()
    vi.stubGlobal('caches', undefined)
    expect(await lirePartage()).toBeNull()
    vi.stubGlobal('caches', { open: async () => { throw new Error('refusé') } })
    expect(await lirePartage()).toBeNull()
  })
})

describe('manifeste : raccourcis et partage', () => {
  const manifeste = pwaOptions.manifest as { shortcuts: { name: string; url: string }[]; share_target: { action: string; method: string; enctype: string; params: { files: { name: string; accept: string[] }[] } } }

  it('quatre raccourcis au plus (limite d’Android), vers des écrans de Nutrition', () => {
    expect(manifeste.shortcuts.length).toBeLessThanOrEqual(4)
    expect(manifeste.shortcuts.map((s) => s.url)).toEqual(['/nutrition/photo', '/nutrition?action=eau', '/nutrition/ajouter', '/nutrition'])
  })

  it('le partage envoie l’image en POST multipart vers l’écran photo, champ « image »', () => {
    expect(manifeste.share_target).toMatchObject({ action: '/nutrition/photo', method: 'POST', enctype: 'multipart/form-data' })
    expect(manifeste.share_target.params.files).toEqual([{ name: 'image', accept: ['image/*'] }])
  })
})
