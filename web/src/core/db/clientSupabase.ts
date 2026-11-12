import { AuthClient, type GoTrueClient, type SupportedStorage } from '@supabase/auth-js'
import { PostgrestClient } from '@supabase/postgrest-js'

// Client Supabase réduit à ce que l'application utilise : l'authentification (auth-js) et les tables (postgrest-js).
// `createClient` de supabase-js embarque en plus le temps réel, le stockage de fichiers et les fonctions, jamais utilisés
// ici (~25 Ko gzip au démarrage). L'assemblage reproduit celui de supabase-js 2.118 (SupabaseClient) :
//  - même clé de session `sb-<projet>-auth-token` dans localStorage : les sessions déjà ouvertes restent valides ;
//  - mêmes options d'authentification par défaut (rafraîchissement auto, session persistée, lien magique lu dans l'URL,
//    flux implicite) ;
//  - chaque requête PostgREST porte `apikey` et le jeton de la session (sinon la clé publique), comme fetchWithAuth.

export interface ClientSupabase {
  // AuthClient est un alias de GoTrueClient (valeur) : le type est celui de GoTrueClient
  auth: GoTrueClient
  from: (table: string) => ReturnType<PostgrestClient['from']>
}

/** Clé localStorage de la session, identique à supabase-js (`sb-<premier segment de l'hôte>-auth-token`). */
export function cleSession(url: string): string {
  return `sb-${baseSupabase(url).hostname.split('.')[0]}-auth-token`
}

function baseSupabase(url: string): URL {
  const nettoyee = url.trim()
  if (!/^https?:\/\//i.test(nettoyee)) throw new Error('URL Supabase invalide : elle doit commencer par http:// ou https://.')
  return new URL(nettoyee.endsWith('/') ? nettoyee : `${nettoyee}/`)
}

export interface OptionsClient {
  /** fetch à utiliser (tests) ; défaut : fetch du navigateur. */
  fetch?: typeof fetch
  /** Stockage de la session (tests) ; défaut : localStorage, comme supabase-js. */
  storage?: SupportedStorage
}

export function creerClientSupabase(url: string, clePublique: string, options: OptionsClient = {}): ClientSupabase {
  if (!clePublique) throw new Error('Clé publique Supabase manquante.')
  const base = baseSupabase(url)
  const fetchDeBase: typeof fetch = options.fetch ?? ((...args) => fetch(...args))

  const auth = new AuthClient({
    url: new URL('auth/v1', base).href,
    headers: { Authorization: `Bearer ${clePublique}`, apikey: clePublique },
    storageKey: cleSession(url),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'implicit',
    fetch: fetchDeBase,
    ...(options.storage ? { storage: options.storage } : {}),
  })

  // Requêtes vers les tables : jeton de la session courante (RLS sur auth.uid()), sinon la clé publique
  const fetchAvecSession: typeof fetch = async (entree, init) => {
    const { data } = await auth.getSession()
    const entetes = new Headers(init?.headers)
    if (!entetes.has('apikey')) entetes.set('apikey', clePublique)
    if (!entetes.has('Authorization')) entetes.set('Authorization', `Bearer ${data.session?.access_token ?? clePublique}`)
    return fetchDeBase(entree, { ...init, headers: entetes })
  }

  const rest = new PostgrestClient(new URL('rest/v1', base).href, { schema: 'public', fetch: fetchAvecSession })
  return { auth, from: (table: string) => rest.from(table) }
}
