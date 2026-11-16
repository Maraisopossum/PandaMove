// Réception d'une photo partagée vers PandaMove depuis la galerie ou l'appareil photo (manifeste `share_target` : POST multipart sur
// /nutrition/photo, champ `image`). Chargé par le service worker principal (workbox.importScripts, voir pwa.config.ts).
// La photo est gardée un instant dans un cache dédié, puis l'écran « Photo de l'assiette » la lit, la supprime et lance l'analyse
// (core/nutrition/partage.ts). Seules les images de taille raisonnable sont acceptées ; tout le reste retombe sur l'écran photo vide.
const CACHE_PARTAGE = 'pandamove-partage'
const CLE_PARTAGE = '/partage/image'
const TAILLE_MAX_OCTETS = 15 * 1024 * 1024

self.addEventListener('fetch', (event) => {
  const requete = event.request
  if (requete.method !== 'POST') return
  const url = new URL(requete.url)
  if (url.origin !== self.location.origin || url.pathname !== '/nutrition/photo') return
  event.respondWith(recevoirPartage(requete))
})

async function recevoirPartage(requete) {
  const ailleurs = (chemin) => Response.redirect(new URL(chemin, self.location.origin).href, 303)
  try {
    const formulaire = await requete.formData()
    const image = formulaire.get('image')
    if (image instanceof Blob && image.type.startsWith('image/') && image.size > 0 && image.size <= TAILLE_MAX_OCTETS) {
      const cache = await caches.open(CACHE_PARTAGE)
      await cache.put(CLE_PARTAGE, new Response(image, { headers: { 'Content-Type': image.type } }))
      return ailleurs('/nutrition/photo?partage=1')
    }
  } catch {
    // Formulaire illisible ou cache indisponible : repli sur l'écran photo sans image
  }
  return ailleurs('/nutrition/photo')
}
