// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, renderHook, screen, within } from '@testing-library/react'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Drawer } from './Drawer'
import { MODULES } from './modules'
import { useDeconnexion } from './useDeconnexion'

afterEach(cleanup)

function monter(chemin = '/stats', surcharge: Partial<Parameters<typeof Drawer>[0]> = {}) {
  const props = {
    ouvert: true,
    onNavigation: vi.fn(),
    deconnexion: { avertissement: null as string | null, enCours: false, deconnecter: vi.fn() },
    sombre: { dark: false, setDark: vi.fn() },
    ...surcharge,
  }
  render(
    <MemoryRouter initialEntries={[chemin]}>
      <Drawer {...props} />
    </MemoryRouter>,
  )
  return props
}

describe('Drawer', () => {
  it('est un repère de navigation avec un lien par module, sans sous-menus', () => {
    monter()
    const nav = screen.getByRole('navigation', { name: 'Navigation principale' })
    for (const { label } of Object.values(MODULES)) {
      expect(nav.textContent).toContain(label)
    }
    // Un lien par module + le lien d'évitement + logo non lié : pas un lien de plus (ni sous-menu, ni liste imbriquée)
    expect(screen.getAllByRole('link')).toHaveLength(Object.keys(MODULES).length)
    expect(screen.queryAllByRole('list')).toHaveLength(0)
    expect(screen.queryByRole('link', { name: 'Séances programmées' })).toBeNull()
    expect(screen.getByRole('link', { name: MODULES.strength.label }).getAttribute('href')).toBe('/strength')
  })

  it('suit l’ordre choisi par l’utilisateur, l’Accueil restant en premier', () => {
    localStorage.setItem('pandamove.modules.ordre', JSON.stringify({ ordre: ['nutrition', 'hyrox'], tuiles: [] }))
    try {
      monter()
      const libelles = screen.getAllByRole('link').map((l) => l.textContent)
      expect(libelles.slice(0, 4)).toEqual([MODULES.home.label, MODULES.nutrition.label, MODULES.hyrox.label, MODULES.strength.label])
      expect(libelles).toHaveLength(Object.keys(MODULES).length)
    } finally {
      localStorage.removeItem('pandamove.modules.ordre')
    }
  })

  it('marque uniquement le lien actif avec aria-current', () => {
    monter('/stats')
    const actifs = screen.getAllByRole('link').filter((l) => l.hasAttribute('aria-current'))
    expect(actifs.map((l) => l.textContent)).toEqual([MODULES.stats.label])
  })

  it.each(['/strength', '/strength/planned', '/strength/done', '/strength/new'])('%s : le module Renforcement est la page courante, lui seul', (chemin) => {
    monter(chemin)
    const pages = screen.getAllByRole('link').filter((l) => l.getAttribute('aria-current') === 'page')
    expect(pages.map((l) => l.textContent)).toEqual([MODULES.strength.label])
  })

  it("affiche l'avertissement de déconnexion renvoyé par la synchro", () => {
    monter('/', {
      deconnexion: {
        avertissement: '2 modification(s) non synchronisée(s) seraient perdues',
        enCours: false,
        deconnecter: vi.fn(),
      },
    })
    expect(screen.getByRole('alert').textContent).toContain('2 modification(s) non synchronisée(s)')
  })

  it("n'affiche aucune alerte sans avertissement", () => {
    monter()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it("le bouton de déconnexion appelle l'action", () => {
    const props = monter()
    fireEvent.click(screen.getByRole('button', { name: 'Se déconnecter' }))
    expect(props.deconnexion.deconnecter).toHaveBeenCalledOnce()
  })

  it("le commutateur de mode sombre expose son état et l'inverse au clic", () => {
    const props = monter()
    const bouton = screen.getByRole('button', { name: 'Mode sombre' })
    expect(bouton.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(bouton)
    expect(props.sombre.setDark).toHaveBeenCalledWith(true)
  })

  it('un clic sur un lien notifie la navigation (fermeture du drawer étroit)', () => {
    const props = monter()
    fireEvent.click(screen.getByRole('link', { name: MODULES.calendar.label }))
    expect(props.onNavigation).toHaveBeenCalled()
  })
})

describe('pastilles du menu', () => {
  it('chaque module a sa pastille illustrée, décorative (le nom du lien reste le libellé)', () => {
    monter()
    const nav = screen.getByRole('navigation', { name: 'Navigation principale' })
    for (const { label, icone } of Object.values(MODULES)) {
      const lien = within(nav).getByRole('link', { name: label })
      const img = lien.querySelector('img')
      expect(img?.getAttribute('src'), label).toBe(`/icons/menu/${icone}.webp`)
      expect(img?.getAttribute('alt')).toBe('')
    }
  })

  it('chaque fichier de pastille référencé existe dans public/icons/menu', () => {
    const dossier = join(import.meta.dirname, '..', '..', 'public', 'icons', 'menu')
    for (const { icone } of Object.values(MODULES)) expect(existsSync(join(dossier, `${icone}.webp`)), icone).toBe(true)
  })
})

describe('useDeconnexion', () => {
  it("expose le message d'avertissement renvoyé par signOutSafely", async () => {
    const signOutSafely = vi.fn(async () => ({ ok: false, message: 'non synchronisé' }))
    const { result } = renderHook(() => useDeconnexion(signOutSafely))
    await act(async () => {
      await result.current.deconnecter()
    })
    expect(result.current.avertissement).toBe('non synchronisé')
    expect(result.current.enCours).toBe(false)
  })

  it("efface l'avertissement quand la déconnexion réussit", async () => {
    const signOutSafely = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, message: 'non synchronisé' })
      .mockResolvedValueOnce({ ok: true })
    const { result } = renderHook(() => useDeconnexion(signOutSafely))
    await act(async () => {
      await result.current.deconnecter()
    })
    await act(async () => {
      await result.current.deconnecter()
    })
    expect(result.current.avertissement).toBeNull()
  })
})
