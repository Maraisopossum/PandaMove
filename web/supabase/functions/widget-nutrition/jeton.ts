// Jeton du widget Android : lecture de l'en-tête et empreinte. Aucune dépendance à Deno ni à Supabase (testé sous Vitest).

/** « pmw_ » + 64 caractères hexadécimaux, tel que créé par la fonction SQL creer_jeton_widget. */
const FORME_JETON = /^pmw_[0-9a-f]{64}$/

/** Jeton de l'en-tête `Authorization: Bearer pmw_…`, ou null s'il est absent ou mal formé (rien n'est alors lu en base). */
export function lireJeton(entete: string | null): string | null {
  const m = /^Bearer\s+(\S+)$/i.exec(entete ?? '')
  return m && FORME_JETON.test(m[1]) ? m[1] : null
}

/** Empreinte SHA-256 en hexadécimal : la même que celle calculée par la base à la création du jeton. */
export async function empreinte(jeton: string): Promise<string> {
  const octets = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(jeton))
  return [...new Uint8Array(octets)].map((b) => b.toString(16).padStart(2, '0')).join('')
}
