// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CLE_PUSH_ACTIF, cleVersUint8Array, ligneDepuisAbonnement, pushDisponible } from './push'
import { usePushRappels, type ClientAbonnements } from './usePushRappels'
import { useRappelsActifs } from './useRappels'
import { createTestDb } from '../../test/sqliteDb'
import { inserer } from '../../test/fixtures'

const base = createTestDb()
vi.mock('../../core/db/client', () => ({ getDb: () => base, getSupabase: () => { throw new Error('client réel non attendu') } }))
vi.mock('../../core/auth/AuthProvider', () => ({ useAuth: () => ({ session: { user: { id: 'u1' } } }) }))

import RappelsScreen from './RappelsScreen'

const CLE = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U'

beforeEach(() => {
  window.localStorage.clear()
  // Navigateur capable de push
  Object.defineProperty(navigator, 'serviceWorker', { value: {}, configurable: true })
  vi.stubGlobal('PushManager', class {})
  vi.stubGlobal('Notification', Object.assign(vi.fn(), { permission: 'granted', requestPermission: vi.fn().mockResolvedValue('granted') }))
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const abonnementFactice = (endpoint = 'https://push.exemple/abonnement-0123456789') => ({
  endpoint,
  toJSON: () => ({ endpoint, keys: { p256dh: 'cle-p256dh', auth: 'cle-auth' } }),
  unsubscribe: vi.fn().mockResolvedValue(true),
})

// Faux service worker : un abonnement éventuel et la fonction subscribe
function fauxRegistration(initial: ReturnType<typeof abonnementFactice> | null = null) {
  let courant = initial
  const subscribe = vi.fn(async () => {
    courant = abonnementFactice()
    return courant
  })
  const reg = { pushManager: { getSubscription: async () => courant, subscribe } } as unknown as ServiceWorkerRegistration
  return { reg, subscribe, abonnement: () => courant }
}

function fauxClient(erreur: string | null = null) {
  const upserts: { table: string; ligne: unknown; options: unknown }[] = []
  const suppressions: { table: string; colonne: string; valeur: string }[] = []
  const client: ClientAbonnements = {
    from: (table) => ({
      upsert: async (ligne, options) => {
        upserts.push({ table, ligne, options })
        return { error: erreur ? { message: erreur } : null }
      },
      delete: () => ({
        eq: async (colonne, valeur) => {
          suppressions.push({ table, colonne, valeur })
          return { error: null }
        },
      }),
    }),
  }
  return { client, upserts, suppressions }
}

describe('aides push', () => {
  it('la clé VAPID base64 URL est convertie en octets', () => {
    const octets = cleVersUint8Array(CLE)
    expect(octets).toBeInstanceOf(Uint8Array)
    expect(octets.length).toBe(65)
    expect(octets[0]).toBe(0x04)
  })

  it('ligne d’abonnement : endpoint, clés et fuseau ; null si une clé manque', () => {
    expect(ligneDepuisAbonnement(abonnementFactice(), 'Europe/Paris')).toEqual({
      endpoint: 'https://push.exemple/abonnement-0123456789', cle_p256dh: 'cle-p256dh', cle_auth: 'cle-auth', fuseau: 'Europe/Paris',
    })
    expect(ligneDepuisAbonnement({ toJSON: () => ({ endpoint: 'https://x', keys: { p256dh: 'a' } }) }, 'UTC')).toBeNull()
    expect(ligneDepuisAbonnement({ toJSON: () => ({ keys: { p256dh: 'a', auth: 'b' } }) }, 'UTC')).toBeNull()
  })

  it('l’option n’est proposée que si le serveur est configuré et le navigateur capable', () => {
    expect(pushDisponible(CLE)).toBe(true)
    expect(pushDisponible(undefined)).toBe(false)
    vi.stubGlobal('Notification', undefined)
    delete (window as unknown as Record<string, unknown>).Notification
    expect(pushDisponible(CLE)).toBe(false)
  })
})

describe('usePushRappels', () => {
  it('sans clé VAPID : indisponible, rien n’est demandé', () => {
    const { result } = renderHook(() => usePushRappels({ cle: undefined }))
    expect(result.current.disponible).toBe(false)
  })

  it('activer : permission, abonnement du navigateur, ligne écrite vers Supabase avec le fuseau, drapeau posé', async () => {
    const { reg, subscribe } = fauxRegistration()
    const { client, upserts } = fauxClient()
    const { result } = renderHook(() => usePushRappels({ cle: CLE, client: () => client, registration: async () => reg, fuseau: () => 'Europe/Paris' }))
    await act(() => result.current.activer())
    expect(subscribe).toHaveBeenCalledWith({ userVisibleOnly: true, applicationServerKey: expect.any(Uint8Array) })
    expect(upserts).toEqual([
      {
        table: 'push_abonnements',
        ligne: { endpoint: 'https://push.exemple/abonnement-0123456789', cle_p256dh: 'cle-p256dh', cle_auth: 'cle-auth', fuseau: 'Europe/Paris' },
        options: { onConflict: 'endpoint' },
      },
    ])
    expect(result.current.actif).toBe(true)
    expect(window.localStorage.getItem(CLE_PUSH_ACTIF)).toBe('1')
    expect(result.current.message).toBe('')
  })

  it('permission refusée : aucun abonnement, message clair', async () => {
    vi.stubGlobal('Notification', Object.assign(vi.fn(), { permission: 'default', requestPermission: vi.fn().mockResolvedValue('denied') }))
    const { reg, subscribe } = fauxRegistration()
    const { client, upserts } = fauxClient()
    const { result } = renderHook(() =>
      usePushRappels({ cle: CLE, client: () => client, registration: async () => reg, demanderPermission: async () => 'denied' }),
    )
    await act(() => result.current.activer())
    expect(subscribe).not.toHaveBeenCalled()
    expect(upserts).toEqual([])
    expect(result.current.actif).toBe(false)
    expect(result.current.message).toContain('refusées')
  })

  it('écriture refusée par Supabase (migration absente) : l’abonnement du navigateur créé est annulé, option éteinte', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { reg, abonnement } = fauxRegistration()
    const { client } = fauxClient('relation "push_abonnements" does not exist')
    const { result } = renderHook(() => usePushRappels({ cle: CLE, client: () => client, registration: async () => reg }))
    await act(() => result.current.activer())
    expect(abonnement()!.unsubscribe).toHaveBeenCalledTimes(1)
    expect(result.current.actif).toBe(false)
    expect(window.localStorage.getItem(CLE_PUSH_ACTIF)).toBeNull()
    expect(result.current.message).toContain("n'ont pas pu être activés")
  })

  it('un abonnement déjà présent n’est pas recréé ni annulé en cas d’échec d’écriture', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const existant = abonnementFactice()
    const { reg, subscribe } = fauxRegistration(existant)
    const { client } = fauxClient('hors ligne')
    const { result } = renderHook(() => usePushRappels({ cle: CLE, client: () => client, registration: async () => reg }))
    await act(() => result.current.activer())
    expect(subscribe).not.toHaveBeenCalled()
    expect(existant.unsubscribe).not.toHaveBeenCalled()
  })

  it('désactiver : ligne supprimée par endpoint, abonnement annulé, drapeau retiré', async () => {
    const existant = abonnementFactice()
    const { reg } = fauxRegistration(existant)
    const { client, suppressions } = fauxClient()
    window.localStorage.setItem(CLE_PUSH_ACTIF, '1')
    const { result } = renderHook(() => usePushRappels({ cle: CLE, client: () => client, registration: async () => reg }))
    await waitFor(() => expect(result.current.actif).toBe(true))
    await act(() => result.current.desactiver())
    expect(suppressions).toEqual([{ table: 'push_abonnements', colonne: 'endpoint', valeur: 'https://push.exemple/abonnement-0123456789' }])
    expect(existant.unsubscribe).toHaveBeenCalledTimes(1)
    expect(result.current.actif).toBe(false)
    expect(window.localStorage.getItem(CLE_PUSH_ACTIF)).toBeNull()
  })

  it('à l’ouverture : un appareil déjà abonné est reconnu et son fuseau remis à jour', async () => {
    const { reg } = fauxRegistration(abonnementFactice())
    const { client, upserts } = fauxClient()
    const { result } = renderHook(() => usePushRappels({ cle: CLE, client: () => client, registration: async () => reg, fuseau: () => 'America/Montreal' }))
    await waitFor(() => expect(result.current.actif).toBe(true))
    await waitFor(() => expect(upserts).toHaveLength(1))
    expect(upserts[0].ligne).toMatchObject({ fuseau: 'America/Montreal' })
    expect(window.localStorage.getItem(CLE_PUSH_ACTIF)).toBe('1')
  })

  it('un appareil sans abonnement n’est pas marqué actif (drapeau périmé effacé)', async () => {
    window.localStorage.setItem(CLE_PUSH_ACTIF, '1')
    const { reg } = fauxRegistration(null)
    const { client } = fauxClient()
    const { result } = renderHook(() => usePushRappels({ cle: CLE, client: () => client, registration: async () => reg }))
    await waitFor(() => expect(window.localStorage.getItem(CLE_PUSH_ACTIF)).toBeNull())
    expect(result.current.actif).toBe(false)
  })
})

describe('écran Rappels', () => {
  it('sans clé VAPID configurée : pas d’option « application fermée »', () => {
    render(<RappelsScreen />)
    expect(screen.queryByRole('checkbox', { name: /application est fermée/ })).toBeNull()
  })

  it('avec une clé : l’option est proposée mais inactive tant que les rappels sont éteints', () => {
    vi.stubEnv('VITE_VAPID_PUBLIC_KEY', CLE)
    render(<RappelsScreen />)
    const option = screen.getByRole('checkbox', { name: /application est fermée/ }) as HTMLInputElement
    expect(option.disabled).toBe(true)
    fireEvent.click(screen.getByRole('checkbox', { name: 'Rappeler mes séances programmées' }))
    vi.unstubAllEnvs()
  })
})

describe('planificateur local et push', () => {
  const c = { user_id: 'u1', updated_at: 'u0', deleted_at: null }

  it('avec le push actif sur cet appareil, le planificateur local n’envoie rien (pas de doublon)', async () => {
    window.localStorage.setItem('pandamove.rappels', JSON.stringify({ actif: true, veille: true, veilleHeure: '19:00', jour: true, jourHeure: '07:30' }))
    await inserer(base, 'seances', { ...c, id: 'pu-s', nom: 'Pull', is_archived: 0, seance_category: 'STRENGTH', created_at: 'c' })
    await inserer(base, 'instances_seance', { ...c, id: 'pu-i', seance_id: 'pu-s', date: '2026-11-12', is_completed: 0 })
    const envoyer = vi.fn().mockResolvedValue(undefined)
    const maintenant = () => new Date(2026, 10, 11, 19, 30)

    window.localStorage.setItem(CLE_PUSH_ACTIF, '1')
    const avecPush = renderHook(() => useRappelsActifs({ db: base, maintenant, envoyer, intervalleMs: 20 }))
    await new Promise((r) => setTimeout(r, 120))
    expect(envoyer).not.toHaveBeenCalled()
    avecPush.unmount()

    window.localStorage.removeItem(CLE_PUSH_ACTIF)
    const sansPush = renderHook(() => useRappelsActifs({ db: base, maintenant, envoyer, intervalleMs: 20 }))
    await waitFor(() => expect(envoyer).toHaveBeenCalledTimes(1))
    sansPush.unmount()
  })
})
