import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

// Gestionnaires du service worker (public/push-sw.js) exécutés avec un faux `self` : le fichier est du JavaScript classique,
// chargé tel quel par le service worker principal.
type Ecouteur = (evenement: unknown) => void

function charger() {
  const ecouteurs = new Map<string, Ecouteur>()
  const showNotification = vi.fn().mockResolvedValue(undefined)
  const focus = vi.fn().mockResolvedValue(undefined)
  const openWindow = vi.fn().mockResolvedValue(undefined)
  const fenetres: { focus: typeof focus }[] = []
  const faux = {
    addEventListener: (nom: string, f: Ecouteur) => void ecouteurs.set(nom, f),
    registration: { showNotification },
    clients: { matchAll: vi.fn(async () => fenetres), openWindow },
  }
  const code = readFileSync(join(import.meta.dirname, '../../../public/push-sw.js'), 'utf8')
  new Function('self', code)(faux)
  return { ecouteurs, showNotification, focus, openWindow, fenetres }
}

const evenementPush = (donnees: unknown) => {
  const attentes: Promise<unknown>[] = []
  return {
    evenement: { data: donnees === undefined ? null : { json: () => (typeof donnees === 'function' ? (donnees as () => never)() : donnees) }, waitUntil: (p: Promise<unknown>) => attentes.push(p) },
    attentes,
  }
}

describe('push-sw.js', () => {
  it('affiche la notification : titre, corps, icône et tag (le même que la notification locale, donc remplacé et non doublé)', async () => {
    const { ecouteurs, showNotification } = charger()
    const { evenement, attentes } = evenementPush({ titre: 'Séance demain', corps: 'Pull', cle: 's1|2026-11-13|veille' })
    ecouteurs.get('push')!(evenement)
    await Promise.all(attentes)
    expect(showNotification).toHaveBeenCalledWith('Séance demain', {
      body: 'Pull', tag: 's1|2026-11-13|veille', icon: '/icons/icon-192.png', badge: '/icons/badge-96.png',
    })
  })

  it('ignore un message sans titre, un JSON illisible ou sans données (aucune notification vide)', () => {
    const { ecouteurs, showNotification } = charger()
    for (const donnees of [{ corps: 'sans titre' }, { titre: 42 }, () => { throw new Error('JSON invalide') }, undefined]) {
      const { evenement, attentes } = evenementPush(donnees)
      ecouteurs.get('push')!(evenement)
      expect(attentes).toHaveLength(0)
    }
    expect(showNotification).not.toHaveBeenCalled()
  })

  it('un corps ou une clé de type inattendu est neutralisé', async () => {
    const { ecouteurs, showNotification } = charger()
    const { evenement, attentes } = evenementPush({ titre: 'Titre', corps: { html: '<img src=x onerror=alert(1)>' }, cle: 7 })
    ecouteurs.get('push')!(evenement)
    await Promise.all(attentes)
    expect(showNotification).toHaveBeenCalledWith('Titre', { body: '', tag: undefined, icon: '/icons/icon-192.png', badge: '/icons/badge-96.png' })
  })

  it('toucher la notification la ferme et ramène la fenêtre ouverte au premier plan', async () => {
    const { ecouteurs, focus, fenetres, openWindow } = charger()
    fenetres.push({ focus })
    const fermer = vi.fn()
    const attentes: Promise<unknown>[] = []
    ecouteurs.get('notificationclick')!({ notification: { close: fermer }, waitUntil: (p: Promise<unknown>) => attentes.push(p) })
    await Promise.all(attentes)
    expect(fermer).toHaveBeenCalled()
    expect(focus).toHaveBeenCalled()
    expect(openWindow).not.toHaveBeenCalled()
  })

  it('sans fenêtre ouverte, ouvre l’application à la racine (jamais une adresse venue du message)', async () => {
    const { ecouteurs, openWindow } = charger()
    const attentes: Promise<unknown>[] = []
    ecouteurs.get('notificationclick')!({ notification: { close: vi.fn(), data: { url: 'https://pirate.exemple' } }, waitUntil: (p: Promise<unknown>) => attentes.push(p) })
    await Promise.all(attentes)
    expect(openWindow).toHaveBeenCalledWith('/')
  })
})
