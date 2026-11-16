import type { ClientSupabase } from '../db/clientSupabase'
import { apportPourQuantite, type Apport } from './calculs'

// Photo de l'assiette : réduction de l'image sur l'appareil, envoi à la fonction `analyser-assiette`, puis conversion des estimations en
// lignes modifiables. Rien n'est écrit au journal avant la validation de l'utilisateur.

export type Confiance = 'haute' | 'moyenne' | 'faible'

/** Aliment estimé à partir de la photo : valeurs pour 100 g et quantité servie. */
export interface AlimentEstime {
  nom: string
  quantiteG: number
  kcal100: number
  proteines100: number
  glucides100: number
  lipides100: number
  fibres100: number | null
  confiance: Confiance
}

export interface AnalysePhoto {
  estUnRepas: boolean
  aliments: AlimentEstime[]
  remarque: string | null
}

export interface ImageReduite {
  base64: string
  mediaType: 'image/jpeg'
}

const COTE_MAX = 1280
const QUALITE = 0.8

/** Réduit la photo (côté le plus long 1 280 px, JPEG 80 %, ≈ 200 Ko) : l'envoi reste léger en 4G et le modèle voit autant de détails. */
export async function reduireImage(fichier: Blob): Promise<ImageReduite> {
  const bitmap = await createImageBitmap(fichier, { imageOrientation: 'from-image' })
  try {
    const echelle = Math.min(1, COTE_MAX / Math.max(bitmap.width, bitmap.height))
    const largeur = Math.max(1, Math.round(bitmap.width * echelle))
    const hauteur = Math.max(1, Math.round(bitmap.height * echelle))
    const canvas = document.createElement('canvas')
    canvas.width = largeur
    canvas.height = hauteur
    const contexte = canvas.getContext('2d')
    if (!contexte) throw new Error('Le navigateur ne peut pas préparer la photo.')
    contexte.drawImage(bitmap, 0, 0, largeur, hauteur)
    const blob = await new Promise<Blob | null>((resoudre) => canvas.toBlob(resoudre, 'image/jpeg', QUALITE))
    if (!blob) throw new Error('Le navigateur ne peut pas préparer la photo.')
    const url = await new Promise<string>((resoudre, rejeter) => {
      const lecteur = new FileReader()
      lecteur.onload = () => resoudre(String(lecteur.result))
      lecteur.onerror = () => rejeter(new Error('Lecture de la photo impossible.'))
      lecteur.readAsDataURL(blob)
    })
    return { base64: url.slice(url.indexOf(',') + 1), mediaType: 'image/jpeg' }
  } finally {
    bitmap.close()
  }
}

/** Service d'IA proposé par le serveur (un par clé configurée dans les secrets de la fonction). */
export interface FournisseurIa {
  id: string
  libelle: string
  modele: string
}

export interface FournisseursIa {
  defaut: string | null
  fournisseurs: FournisseurIa[]
}

/** Services d'IA disponibles pour l'analyse. Toute erreur (hors ligne, fonction absente, non configurée) donne une liste vide : le choix est alors masqué. */
export async function listerFournisseursIa(supabase: ClientSupabase): Promise<FournisseursIa> {
  try {
    const reponse = await supabase.appelerFonction('analyser-assiette', { action: 'fournisseurs' })
    if (!reponse.ok) return { defaut: null, fournisseurs: [] }
    const json = (await reponse.json().catch(() => ({}))) as { defaut?: unknown; fournisseurs?: unknown }
    const fournisseurs = (Array.isArray(json.fournisseurs) ? json.fournisseurs : []).filter(
      (f): f is FournisseurIa => typeof f === 'object' && f !== null && typeof (f as FournisseurIa).id === 'string' && typeof (f as FournisseurIa).libelle === 'string',
    )
    return { defaut: typeof json.defaut === 'string' ? json.defaut : null, fournisseurs }
  } catch {
    return { defaut: null, fournisseurs: [] }
  }
}

// Le service choisi est un réglage de l'appareil (localStorage, non synchronisé), comme les autres préférences `pandamove.*`.
const CLE_FOURNISSEUR = 'pandamove.nutrition.ia'
const local = () => (typeof localStorage === 'undefined' ? undefined : localStorage)

export function lireFournisseurChoisi(): string | null {
  try {
    return local()?.getItem(CLE_FOURNISSEUR) || null
  } catch {
    return null
  }
}

export function enregistrerFournisseurChoisi(id: string): void {
  try {
    local()?.setItem(CLE_FOURNISSEUR, id)
  } catch {
    /* stockage indisponible : le choix vaut pour cette analyse seulement */
  }
}

/** Service à présélectionner : le dernier choix s'il est encore proposé, sinon le défaut du serveur, sinon le premier. */
export function fournisseurInitial(liste: FournisseursIa, memorise: string | null): string | null {
  const ids = liste.fournisseurs.map((f) => f.id)
  if (memorise && ids.includes(memorise)) return memorise
  if (liste.defaut && ids.includes(liste.defaut)) return liste.defaut
  return ids[0] ?? null
}

/** Envoie la photo à la fonction et rend les estimations. Les erreurs du serveur (quota, non configuré…) sont rendues telles quelles. */
export async function analyserAssiette(supabase: ClientSupabase, image: ImageReduite, indication?: string, fournisseur?: string | null): Promise<AnalysePhoto> {
  let reponse: Response
  try {
    reponse = await supabase.appelerFonction('analyser-assiette', { image: image.base64, mediaType: image.mediaType, indication: indication?.trim() || undefined, fournisseur: fournisseur || undefined })
  } catch {
    throw new Error('Connexion impossible : l’analyse d’une photo demande du réseau.')
  }
  const json = (await reponse.json().catch(() => ({}))) as { erreur?: string; estUnRepas?: boolean; aliments?: AlimentEstime[]; remarque?: string | null }
  if (!reponse.ok) {
    if (reponse.status === 404) throw new Error('L’analyse par photo n’est pas déployée (voir supabase/functions/analyser-assiette/README.md).')
    throw new Error(json.erreur ?? 'L’analyse a échoué.')
  }
  return { estUnRepas: json.estUnRepas === true, aliments: Array.isArray(json.aliments) ? json.aliments : [], remarque: json.remarque ?? null }
}

/** Apport d'un aliment estimé pour sa quantité courante (celle que l'utilisateur a pu corriger). */
export const apportEstime = (a: AlimentEstime): Apport =>
  apportPourQuantite({ kcal: a.kcal100, proteines: a.proteines100, glucides: a.glucides100, lipides: a.lipides100, fibres: a.fibres100 }, a.quantiteG)
