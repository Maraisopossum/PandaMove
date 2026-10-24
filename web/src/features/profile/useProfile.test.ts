// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Db } from '../../core/db/Db'
import { getSettings, saveSettings } from '../../core/db/repos/settings'
import { CLE_THEME } from '../../app/theme'
import { createTestDb } from '../../test/sqliteDb'
import { useProfile } from './useProfile'

const USER = 'u1'

beforeEach(() => {
  localStorage.clear()
  document.documentElement.removeAttribute('data-theme')
  vi.stubGlobal('matchMedia', () => ({ matches: false }))
})
afterEach(() => vi.unstubAllGlobals())

async function monter(db: Db) {
  const rendu = renderHook(() => useProfile({ db, userId: USER }))
  await waitFor(() => expect(rendu.result.current.charge).toBe(true))
  return rendu
}

describe('useProfile', () => {
  it('valeurs par défaut sans réglages enregistrés', async () => {
    const { result } = await monter(createTestDb())
    expect(result.current.pandaVariant).toBe('male')
    expect(result.current.dark).toBe(false)
  })

  it('la variante du panda persiste dans user_settings et survit à un remontage', async () => {
    const db = createTestDb()
    const premier = await monter(db)
    await act(() => premier.result.current.setPandaVariant('female'))
    expect(premier.result.current.pandaVariant).toBe('female')
    expect((await getSettings(db, USER)).pandaVariant).toBe('female')
    premier.unmount()
    const second = await monter(db)
    expect(second.result.current.pandaVariant).toBe('female')
  })

  it('le mode sombre persiste dans user_settings.dark_mode, avec cache localStorage', async () => {
    const db = createTestDb()
    const premier = await monter(db)
    await act(() => premier.result.current.setDark(true))
    expect(premier.result.current.dark).toBe(true)
    expect((await getSettings(db, USER)).darkMode).toBe(true)
    expect(localStorage.getItem(CLE_THEME)).toBe('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
    premier.unmount()
    const second = await monter(db)
    expect(second.result.current.dark).toBe(true)
  })

  it('la valeur de la base l’emporte sur le cache local une fois chargée', async () => {
    const db = createTestDb()
    await saveSettings(db, USER, { darkMode: true })
    localStorage.setItem(CLE_THEME, 'light')
    const { result } = renderHook(() => useProfile({ db, userId: USER }))
    // premier rendu : le cache local (pas de flash)
    expect(result.current.dark).toBe(false)
    await waitFor(() => expect(result.current.dark).toBe(true))
    expect(localStorage.getItem(CLE_THEME)).toBe('dark')
  })

  it('changer la variante ne touche pas au mode sombre ni au matériel', async () => {
    const db = createTestDb()
    await saveSettings(db, USER, { darkMode: true, equipmentJson: '{"a":1}' })
    const { result } = await monter(db)
    await act(() => result.current.setPandaVariant('female'))
    const s = await getSettings(db, USER)
    expect(s).toEqual({ pandaVariant: 'female', darkMode: true, equipmentJson: '{"a":1}' })
    const n = await db.get<{ n: number }>('SELECT COUNT(*) AS n FROM user_settings')
    expect(n.n).toBe(1)
  })
})
