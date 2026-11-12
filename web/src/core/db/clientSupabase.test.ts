import { createClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import { cleSession, creerClientSupabase } from './clientSupabase'

const URL_PROJET = 'https://abcdefghijkl.supabase.co'
const CLE = 'cle-publique'

// Stockage en mémoire : session posée à la main, comme celle qu'aurait laissée supabase-js dans localStorage
function stockage(initial: Record<string, string> = {}) {
  const donnees = new Map(Object.entries(initial))
  return {
    getItem: (k: string) => donnees.get(k) ?? null,
    setItem: (k: string, v: string) => void donnees.set(k, v),
    removeItem: (k: string) => void donnees.delete(k),
    donnees,
  }
}

const sessionValide = (jeton: string) =>
  JSON.stringify({
    access_token: jeton,
    refresh_token: 'rafraichissement',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: 'u1', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' },
  })

function fauxFetch() {
  const appels: { url: string; entetes: Headers; methode: string }[] = []
  const f = vi.fn(async (entree: RequestInfo | URL, init?: RequestInit) => {
    appels.push({ url: String(entree), entetes: new Headers(init?.headers), methode: init?.method ?? 'GET' })
    return new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } })
  })
  return { f: f as unknown as typeof fetch, appels }
}

describe('client Supabase allégé', () => {
  it('garde la clé de session de supabase-js (les sessions ouvertes restent valides après la mise à jour)', () => {
    const reference = createClient(URL_PROJET, CLE, { auth: { persistSession: false } }) as unknown as { storageKey: string }
    expect(cleSession(URL_PROJET)).toBe(reference.storageKey)
    expect(cleSession(`${URL_PROJET}/`)).toBe('sb-abcdefghijkl-auth-token')
  })

  it('refuse une URL sans http(s) ou une clé vide', () => {
    expect(() => creerClientSupabase('abcdefghijkl.supabase.co', CLE)).toThrow(/URL Supabase invalide/)
    expect(() => creerClientSupabase(URL_PROJET, '')).toThrow(/Clé publique/)
  })

  it('requête de table : apikey et jeton de la session enregistrée, sur /rest/v1', async () => {
    const { f, appels } = fauxFetch()
    const s = stockage({ [cleSession(URL_PROJET)]: sessionValide('jeton-utilisateur') })
    const client = creerClientSupabase(URL_PROJET, CLE, { fetch: f, storage: s })
    const { error } = await client.from('seances').update({ nom: 'x' }).eq('id', 's1')
    expect(error).toBeNull()
    const appel = appels.find((a) => a.url.includes('/rest/v1/'))!
    expect(appel.url).toBe('https://abcdefghijkl.supabase.co/rest/v1/seances?id=eq.s1')
    expect(appel.methode).toBe('PATCH')
    expect(appel.entetes.get('apikey')).toBe(CLE)
    expect(appel.entetes.get('Authorization')).toBe('Bearer jeton-utilisateur')
  })

  it('sans session : la clé publique sert de jeton (comme supabase-js)', async () => {
    const { f, appels } = fauxFetch()
    const client = creerClientSupabase(URL_PROJET, CLE, { fetch: f, storage: stockage() })
    await client.from('seances').select('id')
    const appel = appels.find((a) => a.url.includes('/rest/v1/'))!
    expect(appel.entetes.get('Authorization')).toBe(`Bearer ${CLE}`)
  })

  it('authentification sur /auth/v1 avec la clé publique, session relue depuis le stockage', async () => {
    const { f, appels } = fauxFetch()
    const s = stockage({ [cleSession(URL_PROJET)]: sessionValide('jeton-utilisateur') })
    const client = creerClientSupabase(URL_PROJET, CLE, { fetch: f, storage: s })
    const { data } = await client.auth.getSession()
    expect(data.session?.access_token).toBe('jeton-utilisateur')
    await client.auth.signInWithPassword({ email: 'a@exemple.fr', password: 'secret' }).catch(() => undefined)
    const connexion = appels.find((a) => a.url.includes('/auth/v1/token'))!
    expect(connexion.url.startsWith('https://abcdefghijkl.supabase.co/auth/v1/token')).toBe(true)
    expect(connexion.entetes.get('apikey')).toBe(CLE)
  })
})
