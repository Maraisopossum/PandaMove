// Notifications push de PandaMove (rappels de séance envoyés par la fonction Supabase `envoyer-rappels`).
// Chargé par le service worker principal (workbox.importScripts, voir pwa.config.ts) : il s'exécute même quand
// l'application est fermée. Le corps du message est du JSON { titre, corps, cle } produit par notre serveur ; toute autre forme
// est ignorée (jamais de HTML ni d'adresse à ouvrir venue du message).

self.addEventListener('push', (evenement) => {
  let message = null
  try {
    message = evenement.data ? evenement.data.json() : null
  } catch {
    message = null
  }
  if (!message || typeof message.titre !== 'string') return
  const options = {
    body: typeof message.corps === 'string' ? message.corps : '',
    // Même identifiant que la notification locale : un rappel déjà affiché est remplacé, pas doublé
    tag: typeof message.cle === 'string' ? message.cle : undefined,
    icon: '/icons/icon-192.png',
  }
  evenement.waitUntil(self.registration.showNotification(message.titre, options))
})

// Toucher la notification ouvre PandaMove (ou ramène la fenêtre déjà ouverte au premier plan)
self.addEventListener('notificationclick', (evenement) => {
  evenement.notification.close()
  evenement.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((fenetres) => {
      const ouverte = fenetres.find((f) => 'focus' in f)
      return ouverte ? ouverte.focus() : self.clients.openWindow('/')
    }),
  )
})
