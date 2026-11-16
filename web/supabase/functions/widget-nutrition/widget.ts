// Logique de la fonction `widget-nutrition` : totaux du jour pour le widget Android (GET) et ajout d'eau depuis le widget (POST).
// Aucune dépendance à Deno ni à Supabase : les accès passent par des « ports » injectés (index.ts les branche sur la clé de service), ce qui
// permet de tester toutes les règles sous Vitest (src/core/nutrition/fonctionWidget.test.ts).
//
// Le jeton ne donne accès qu'à des NOMBRES : jamais un nom d'aliment, une photo ou un autre jour que celui d'hier, d'aujourd'hui ou de demain.

import { empreinte, lireJeton } from './jeton.ts'

export const VERSION_CONTRAT = 1
/** Une lecture toutes les 20 secondes au plus par jeton (le widget se rafraîchit toutes les 30 minutes). */
export const DELAI_LECTURE_MS = 20_000
export const EAU_PAR_JOUR_MAX_ML = 5000
export const EAU_MIN_ML = 50
export const EAU_MAX_ML = 1500
const REPAS = ['petit_dejeuner', 'dejeuner', 'collation', 'diner'] as const

export class ErreurWidget extends Error {
  readonly statut: number
  readonly code: string
  readonly reessayerDansS: number | null
  constructor(statut: number, code: string, message: string, reessayerDansS: number | null = null) {
    super(message)
    this.name = 'ErreurWidget'
    this.statut = statut
    this.code = code
    this.reessayerDansS = reessayerDansS
  }
}

export interface LigneJournal {
  /** Identifiant de la ligne (sert à reconnaître un appel d'eau déjà traité ; jamais renvoyé au widget). */
  id?: string
  repas: string
  kcal: number
  proteines: number
  glucides: number
  lipides: number
  quantite_g: number
}

export interface ObjectifsLus {
  kcal: number
  proteines_g: number
  glucides_g: number
  lipides_g: number
  eau_ml: number
}

export type VerdictJeton = { statut: 'ok'; userId: string; ecritureEau: boolean } | { statut: 'inconnu' } | { statut: 'revoque' } | { statut: 'trop_vite' }

export interface PortsWidget {
  maintenant(): Date
  /** Cherche le jeton par son empreinte ; `marquerLecture` enregistre la lecture et refuse (trop_vite) si la précédente date de moins de 20 s. */
  verifierJeton(empreinte: string, marquerLecture: boolean): Promise<VerdictJeton>
  lireJour(userId: string, date: string): Promise<LigneJournal[]>
  lireObjectifs(userId: string): Promise<ObjectifsLus | null>
  /** Insère la ligne d'eau ; false si une ligne de même identifiant existe déjà (double appui). */
  insererEau(ligne: { id: string; userId: string; date: string; ml: number; creeLe: string }): Promise<boolean>
}

const arrondi = (v: number, d: number) => Math.round(v * 10 ** d) / 10 ** d
const somme = (lignes: readonly LigneJournal[], cle: 'kcal' | 'proteines' | 'glucides' | 'lipides' | 'quantite_g') => lignes.reduce((t, l) => t + Number(l[cle] ?? 0), 0)

const jourIso = (d: Date) => d.toISOString().slice(0, 10)
const decaler = (iso: string, n: number) => jourIso(new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10) + n)))

/** Date valide et comprise entre la veille et le lendemain du jour du serveur (UTC) : couvre tous les fuseaux, sans permettre de fouiller le passé. */
export function dateAutorisee(date: unknown, maintenant: Date): date is string {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false
  const d = new Date(`${date}T00:00:00Z`)
  if (Number.isNaN(d.getTime()) || jourIso(d) !== date) return false
  const aujourdhui = jourIso(maintenant)
  return date >= decaler(aujourdhui, -1) && date <= decaler(aujourdhui, 1)
}

export interface ResumeNutrition {
  v: number
  date: string
  genereLe: string
  objectifs: { kcal: number; proteinesG: number; glucidesG: number; lipidesG: number; eauMl: number } | null
  consomme: { kcal: number; proteines: number; glucides: number; lipides: number; eauMl: number }
  repas: Record<(typeof REPAS)[number], number>
}

/** Contrat v1 : uniquement des totaux (aucun nom d'aliment). L'eau n'entre ni dans l'énergie ni dans les repas. */
export function construireResume(date: string, lignes: readonly LigneJournal[], objectifs: ObjectifsLus | null, maintenant: Date): ResumeNutrition {
  const nourriture = lignes.filter((l) => l.repas !== 'eau')
  const parRepas = Object.fromEntries(REPAS.map((r) => [r, Math.round(somme(nourriture.filter((l) => l.repas === r), 'kcal'))])) as ResumeNutrition['repas']
  return {
    v: VERSION_CONTRAT,
    date,
    genereLe: maintenant.toISOString(),
    objectifs: objectifs ? { kcal: objectifs.kcal, proteinesG: objectifs.proteines_g, glucidesG: objectifs.glucides_g, lipidesG: objectifs.lipides_g, eauMl: objectifs.eau_ml } : null,
    consomme: {
      kcal: Math.round(somme(nourriture, 'kcal')),
      proteines: arrondi(somme(nourriture, 'proteines'), 1),
      glucides: arrondi(somme(nourriture, 'glucides'), 1),
      lipides: arrondi(somme(nourriture, 'lipides'), 1),
      eauMl: Math.round(somme(lignes.filter((l) => l.repas === 'eau'), 'quantite_g')),
    },
    repas: parRepas,
  }
}

async function authentifier(entete: string | null, marquerLecture: boolean, p: PortsWidget): Promise<{ userId: string; ecritureEau: boolean }> {
  const jeton = lireJeton(entete)
  if (!jeton) throw new ErreurWidget(401, 'jeton_invalide', 'Jeton absent ou invalide.')
  const verdict = await p.verifierJeton(await empreinte(jeton), marquerLecture)
  if (verdict.statut === 'inconnu') throw new ErreurWidget(401, 'jeton_invalide', 'Jeton inconnu.')
  if (verdict.statut === 'revoque') throw new ErreurWidget(401, 'jeton_revoque', 'Ce jeton a été révoqué : reliez de nouveau le widget depuis le Profil.')
  if (verdict.statut === 'trop_vite') throw new ErreurWidget(429, 'trop_vite', 'Trop de lectures : réessayez dans quelques secondes.', Math.ceil(DELAI_LECTURE_MS / 1000))
  return { userId: verdict.userId, ecritureEau: verdict.ecritureEau }
}

/** GET ?date=YYYY-MM-DD : totaux du jour. */
export async function traiterResume(entete: string | null, date: string | null, p: PortsWidget): Promise<ResumeNutrition> {
  const maintenant = p.maintenant()
  if (!dateAutorisee(date, maintenant)) throw new ErreurWidget(400, 'date_invalide', 'Date invalide : hier, aujourd’hui ou demain seulement.')
  const { userId } = await authentifier(entete, true, p)
  const [lignes, objectifs] = await Promise.all([p.lireJour(userId, date), p.lireObjectifs(userId)])
  return construireResume(date, lignes, objectifs, maintenant)
}

export interface DemandeEau {
  date: string
  ml: number
  cle: string
}

export function lireDemandeEau(brut: unknown, maintenant: Date): DemandeEau {
  if (typeof brut !== 'object' || brut === null) throw new ErreurWidget(400, 'demande_invalide', 'Demande invalide.')
  const o = brut as Record<string, unknown>
  if (!dateAutorisee(o.date, maintenant)) throw new ErreurWidget(400, 'date_invalide', 'Date invalide : hier, aujourd’hui ou demain seulement.')
  if (typeof o.ml !== 'number' || !Number.isInteger(o.ml) || o.ml < EAU_MIN_ML || o.ml > EAU_MAX_ML) {
    throw new ErreurWidget(400, 'quantite_invalide', `Quantité d’eau invalide (${EAU_MIN_ML} à ${EAU_MAX_ML} ml).`)
  }
  if (typeof o.cle !== 'string' || !/^[A-Za-z0-9_-]{8,64}$/.test(o.cle)) throw new ErreurWidget(400, 'cle_invalide', 'Clé d’appel invalide (8 à 64 caractères).')
  return { date: o.date, ml: o.ml, cle: o.cle }
}

/** Identifiant de ligne dérivé de la clé d'appel : un même appui répété (réseau instable, double appui) ne crée qu'une ligne. Format UUID v4. */
export async function idEauDepuisCle(userId: string, cle: string): Promise<string> {
  const octets = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`eau:${userId}:${cle}`)))
  octets[6] = (octets[6] & 0x0f) | 0x40
  octets[8] = (octets[8] & 0x3f) | 0x80
  const h = [...octets.slice(0, 16)].map((b) => b.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`
}

export interface ResultatEau {
  v: number
  ajoute: boolean
  eauMl: number
}

/** POST { date, ml, cle } : ajoute de l'eau (jeton avec l'option « eau » seulement), au plus 5 000 ml par jour. */
export async function traiterEau(entete: string | null, corps: unknown, p: PortsWidget): Promise<ResultatEau> {
  const maintenant = p.maintenant()
  const demande = lireDemandeEau(corps, maintenant)
  const { userId, ecritureEau } = await authentifier(entete, false, p)
  if (!ecritureEau) throw new ErreurWidget(403, 'ecriture_refusee', 'Ce widget n’a pas le droit d’ajouter de l’eau : activez l’option dans le Profil.')
  const lignes = await p.lireJour(userId, demande.date)
  const total = Math.round(somme(lignes.filter((l) => l.repas === 'eau'), 'quantite_g'))
  const id = await idEauDepuisCle(userId, demande.cle)
  // Même appel rejoué (réseau instable, double appui) : rien n'est ajouté, la réponse est la même
  if (lignes.some((l) => l.id === id)) return { v: VERSION_CONTRAT, ajoute: false, eauMl: total }
  if (total + demande.ml > EAU_PAR_JOUR_MAX_ML) throw new ErreurWidget(422, 'plafond_eau', `Plafond de ${EAU_PAR_JOUR_MAX_ML} ml d’eau par jour atteint.`)
  const ajoute = await p.insererEau({ id, userId, date: demande.date, ml: demande.ml, creeLe: maintenant.toISOString() })
  return { v: VERSION_CONTRAT, ajoute, eauMl: ajoute ? total + demande.ml : total }
}
