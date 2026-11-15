import type { Session } from '@supabase/auth-js'
import type { ClientSupabase } from '../db/clientSupabase'

// Authentification à deux facteurs (application d'authentification, code à 6 chiffres) par Supabase Auth (TOTP). Facultative pour tout
// le monde ; exigée par le serveur pour les actions et les lectures d'administration (migration 0018 et fonction admin-comptes).

export interface FacteurTotp {
  id: string
  /** Nom donné à l'appareil. */
  nom: string | null
  verifie: boolean
}

export interface InscriptionTotp {
  facteurId: string
  /** Image SVG du QR code (URI de données), à scanner avec l'application d'authentification. */
  qrCode: string
  /** Clé à saisir à la main si le QR code ne peut pas être scanné. */
  secret: string
}

export interface NiveauAssurance {
  courant: 'aal1' | 'aal2' | null
  suivant: 'aal1' | 'aal2' | null
}

const message = (e: { message: string } | null, defaut: string) => (e ? e.message || defaut : defaut)

export async function listerFacteurs(supabase: ClientSupabase): Promise<FacteurTotp[]> {
  const { data, error } = await supabase.auth.mfa.listFactors()
  if (error) throw new Error(message(error, 'Impossible de lire les facteurs.'))
  return (data?.totp ?? []).map((f) => ({ id: f.id, nom: f.friendly_name ?? null, verifie: f.status === 'verified' }))
}

/** Commence l'inscription : renvoie le QR code. Le facteur n'est actif qu'après `verifierInscription`. */
export async function inscrireTotp(supabase: ClientSupabase, nom: string): Promise<InscriptionTotp> {
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: nom })
  if (error || !data) throw new Error(message(error, 'Inscription impossible.'))
  return { facteurId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret }
}

/** Valide un code à 6 chiffres : sert à activer un facteur et à passer la session au niveau aal2. */
export async function verifierCode(supabase: ClientSupabase, facteurId: string, code: string): Promise<void> {
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: facteurId, code: code.trim() })
  if (error) throw new Error(message(error, 'Code incorrect.'))
}

export async function desinscrire(supabase: ClientSupabase, facteurId: string): Promise<void> {
  const { error } = await supabase.auth.mfa.unenroll({ factorId: facteurId })
  if (error) throw new Error(message(error, 'Désactivation impossible.'))
}

/** Niveau de la session et niveau demandé par les facteurs inscrits (lu dans la session locale, sans réseau). */
export async function niveauAssurance(supabase: ClientSupabase): Promise<NiveauAssurance> {
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  if (error || !data) return { courant: null, suivant: null }
  const niveau = (v: string | null | undefined) => (v === 'aal1' || v === 'aal2' ? v : null)
  return { courant: niveau(data.currentLevel), suivant: niveau(data.nextLevel) }
}

/** La connexion doit encore passer par le code à 6 chiffres. */
export const doitVerifier = (n: NiveauAssurance) => n.courant === 'aal1' && n.suivant === 'aal2'

/** Niveau `aal` lu dans le jeton d'accès de la session (« aal2 » après un code valide), null s'il est illisible. */
export function niveauDuJeton(session: Session | null): 'aal1' | 'aal2' | null {
  try {
    const charge = session?.access_token.split('.')[1]
    if (!charge) return null
    const json = JSON.parse(atob(charge.replace(/-/g, '+').replace(/_/g, '/'))) as { aal?: unknown }
    return json.aal === 'aal2' ? 'aal2' : json.aal === 'aal1' ? 'aal1' : null
  } catch {
    return null
  }
}
