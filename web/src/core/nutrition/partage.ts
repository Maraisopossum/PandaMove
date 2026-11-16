// Photo partagée vers PandaMove (manifeste `share_target`) : le service worker (public/partage-sw.js) la dépose dans ce cache, l'écran
// « Photo de l'assiette » la lit UNE fois puis la supprime. Les deux noms ci-dessous sont aussi écrits dans partage-sw.js (un service worker
// n'importe pas de module) : `partage.test.ts` vérifie qu'ils restent identiques.

export const CACHE_PARTAGE = 'pandamove-partage'
export const CLE_PARTAGE = '/partage/image'

/** Photo partagée en attente, ou null. Elle est retirée du cache : un rechargement de la page ne relance pas l'analyse. */
export async function lirePartage(): Promise<File | null> {
  if (typeof caches === 'undefined') return null
  try {
    const cache = await caches.open(CACHE_PARTAGE)
    const reponse = await cache.match(CLE_PARTAGE)
    if (!reponse) return null
    await cache.delete(CLE_PARTAGE)
    const blob = await reponse.blob()
    return blob.size > 0 ? new File([blob], 'partage', { type: blob.type || 'image/jpeg' }) : null
  } catch {
    return null
  }
}
