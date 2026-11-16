// Logique de la fonction `codes-secours` : codes de secours à usage unique de la double authentification (TOTP).
// Aucune dépendance à Deno ni à Supabase : les accès passent par des « ports » injectés (index.ts les branche sur la clé de service), ce qui
// permet de tester toutes les règles sous Vitest (src/core/auth/fonctionCodesSecours.test.ts).

export const NOMBRE_CODES = 8
/** Sans 0/O, 1/I/L : les codes se recopient à la main. 32 symboles × 10 caractères = 50 bits. */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const LONGUEUR = 10

export class ErreurCodes extends Error {
  readonly statut: number
  constructor(statut: number, message: string) {
    super(message)
    this.name = 'ErreurCodes'
    this.statut = statut
  }
}

export type DemandeCodes = { action: 'generer' } | { action: 'utiliser'; code: string }

export function lireDemande(brut: unknown): DemandeCodes {
  if (typeof brut !== 'object' || brut === null) throw new ErreurCodes(400, 'Demande invalide.')
  const o = brut as Record<string, unknown>
  if (o.action === 'generer') return { action: 'generer' }
  if (o.action === 'utiliser') {
    const code = typeof o.code === 'string' ? normaliserCode(o.code) : ''
    if (code.length !== LONGUEUR) throw new ErreurCodes(400, 'Code de secours invalide.')
    return { action: 'utiliser', code }
  }
  throw new ErreurCodes(400, 'Action inconnue.')
}

/** Majuscules, sans espace ni tiret : « abcde-fgh23 » et « ABCDEFGH23 » sont le même code. */
export const normaliserCode = (code: string): string => code.toUpperCase().replace(/[^A-Z0-9]/g, '')

/** Affichage par groupes de 5 : « ABCDE-FGH23 ». */
export const formaterCode = (code: string): string => `${code.slice(0, 5)}-${code.slice(5)}`

/** Tire des codes avec un générateur d'octets aléatoires sûr (rejet des valeurs qui biaiseraient le tirage). */
export function genererCodes(n: number, octets: (taille: number) => Uint8Array): string[] {
  const codes = new Set<string>()
  const limite = 256 - (256 % ALPHABET.length)
  while (codes.size < n) {
    let code = ''
    while (code.length < LONGUEUR) {
      for (const o of octets(LONGUEUR * 2)) {
        if (o < limite && code.length < LONGUEUR) code += ALPHABET[o % ALPHABET.length]
      }
    }
    codes.add(code)
  }
  return [...codes]
}

/** Empreinte SHA-256 du code liée au compte (deux comptes ne partagent jamais la même empreinte pour un même code). */
export async function hacherCode(userId: string, code: string): Promise<string> {
  const donnees = new TextEncoder().encode(`${userId}:${normaliserCode(code)}`)
  const empreinte = await crypto.subtle.digest('SHA-256', donnees)
  return [...new Uint8Array(empreinte)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export interface PortsCodes {
  userId: string
  /** Niveau de la session de l'appelant, lu dans son jeton. */
  niveau: 'aal1' | 'aal2' | null
  /** Le compte a un facteur TOTP vérifié. */
  aUnFacteur(): Promise<boolean>
  /** Remplace tous les codes du compte par ces empreintes. */
  remplacerCodes(empreintes: string[]): Promise<void>
  /** Marque le code comme utilisé s'il existe et n'a pas servi ; renvoie false sinon. */
  consommerCode(empreinte: string): Promise<boolean>
  /** Retire tous les facteurs du compte ; renvoie leur nombre. */
  retirerFacteurs(): Promise<number>
  octets(taille: number): Uint8Array
}

export async function executer(demande: DemandeCodes, p: PortsCodes): Promise<{ message: string; codes?: string[] }> {
  if (demande.action === 'generer') {
    if (!(await p.aUnFacteur())) throw new ErreurCodes(409, 'Activez d’abord la double authentification.')
    // Générer des codes remplace les anciens : seule une session qui a passé le code à 6 chiffres peut le faire
    if (p.niveau !== 'aal2') throw new ErreurCodes(403, 'Double authentification requise : reconnectez-vous avec votre code.')
    const codes = genererCodes(NOMBRE_CODES, p.octets)
    await p.remplacerCodes(await Promise.all(codes.map((c) => hacherCode(p.userId, c))))
    return { message: 'Codes de secours générés : les précédents ne fonctionnent plus.', codes: codes.map(formaterCode) }
  }

  const valide = await p.consommerCode(await hacherCode(p.userId, demande.code))
  if (!valide) throw new ErreurCodes(403, 'Code de secours incorrect ou déjà utilisé.')
  await p.retirerFacteurs()
  return { message: 'Code accepté : la double authentification est retirée. Réactivez-la dans votre profil.' }
}
