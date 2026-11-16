import type { ClientSupabase } from '../db/clientSupabase'

// Codes de secours de la double authentification : 8 codes à usage unique, générés et consommés par la fonction `codes-secours`.
// Un code remplace le téléphone perdu : il retire le second facteur du compte, qu'il faut ensuite réinscrire dans le profil.

async function appeler(supabase: ClientSupabase, corps: unknown): Promise<{ message?: string; codes?: string[] }> {
  let reponse: Response
  try {
    reponse = await supabase.appelerFonction('codes-secours', corps)
  } catch {
    throw new Error('Le serveur est injoignable pour le moment.')
  }
  const json = (await reponse.json().catch(() => ({}))) as { message?: string; erreur?: string; codes?: string[] }
  if (!reponse.ok) {
    if (reponse.status === 404) throw new Error('La fonction des codes de secours n’est pas déployée (voir supabase/functions/codes-secours/README.md).')
    throw new Error(json.erreur ?? 'L’action a échoué.')
  }
  return json
}

/** Génère 8 nouveaux codes (les anciens cessent de fonctionner). Ils ne sont affichés qu'une fois. */
export async function genererCodesSecours(supabase: ClientSupabase): Promise<string[]> {
  const r = await appeler(supabase, { action: 'generer' })
  return r.codes ?? []
}

/** Retire le second facteur avec un code de secours, puis rafraîchit la session (le serveur ne demande plus de code à 6 chiffres). */
export async function utiliserCodeSecours(supabase: ClientSupabase, code: string): Promise<string> {
  const r = await appeler(supabase, { action: 'utiliser', code })
  await supabase.auth.refreshSession()
  return r.message ?? 'Code accepté.'
}

/** Nombre de codes encore utilisables (null si illisible : fonction SQL absente, hors ligne). */
export async function compterCodesRestants(supabase: ClientSupabase): Promise<number | null> {
  const { data, error } = await supabase.rpc('mfa_codes_secours_restants')
  if (error || typeof data !== 'number') return null
  return data
}

/** Texte à copier ou à télécharger : un code par ligne avec une consigne. */
export function texteDesCodes(codes: string[]): string {
  return ['Codes de secours PandaMove (usage unique)', '', ...codes, '', 'Chaque code retire la double authentification une seule fois. Gardez-les hors de votre téléphone.'].join('\n')
}
