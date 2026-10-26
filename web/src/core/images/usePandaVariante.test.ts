// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Db } from '../db/Db'
import { saveSettings } from '../db/repos/settings'
import { createTestDb } from '../../test/sqliteDb'
import { pandaImage } from './pandaImage'
import { useImagePanda, usePandaVariante } from './usePandaVariante'

const USER = 'u1'

afterEach(() => vi.restoreAllMocks())

describe('usePandaVariante', () => {
  it('null pendant la lecture, puis la variante enregistrée dans user_settings', async () => {
    const db = createTestDb()
    await saveSettings(db, USER, { pandaVariant: 'female' })
    const { result } = renderHook(() => usePandaVariante({ db, userId: USER }))
    expect(result.current).toBeNull()
    await waitFor(() => expect(result.current).toBe('female'))
  })

  it('sans réglages enregistrés : male (valeur par défaut du profil)', async () => {
    const { result } = renderHook(() => usePandaVariante({ db: createTestDb(), userId: USER }))
    await waitFor(() => expect(result.current).toBe('male'))
  })

  it('sans utilisateur : male, sans lecture', () => {
    const { result } = renderHook(() => usePandaVariante({ db: createTestDb() }))
    expect(result.current).toBe('male')
  })

  it('lecture en échec : male, erreur journalisée', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const casse = { getOptional: () => Promise.reject(new Error('base indisponible')) } as unknown as Db
    const { result } = renderHook(() => usePandaVariante({ db: casse, userId: USER }))
    await waitFor(() => expect(result.current).toBe('male'))
    expect(console.error).toHaveBeenCalled()
  })
})

describe('useImagePanda', () => {
  it('attend la variante (pas de panda de la mauvaise variante affiché un instant)', async () => {
    const db = createTestDb()
    await saveSettings(db, USER, { pandaVariant: 'female' })
    const { result } = renderHook(() => useImagePanda('victory', { db, userId: USER, taille: 'sm' }))
    expect(result.current).toBeNull()
    await waitFor(() => expect(result.current).toEqual(pandaImage('victory', 'female', 'sm')))
  })

  it('image commune : disponible tout de suite', () => {
    const { result, unmount } = renderHook(() => useImagePanda('onboarding_01', { db: createTestDb(), userId: USER }))
    expect(result.current?.src).toBe(pandaImage('onboarding_01', 'male').src)
    // La lecture de la variante est encore en cours : on démonte pour qu'elle n'aboutisse pas après la fin du test.
    unmount()
  })
})
