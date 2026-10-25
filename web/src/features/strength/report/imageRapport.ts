import { detailLigne, nomFichierRapport, type RapportExport } from './exportRapport'

// Export du rapport en image PNG (Android : capture hors écran du rapport). Dessiné à la main sur un canvas, sans
// bibliothèque : un plan de texte est calculé (fonction pure, testée avec une mesure injectée) puis peint.

export const LARGEUR_IMAGE = 1080
const MARGE = 48
const RETRAIT = 28
const ESPACE_BLOC = 20

type Couleur = 'texte' | 'secondaire' | 'accent'
// Couleurs de l'image (fond blanc) : toutes à 4,5:1 au moins sur blanc
const COULEURS: Record<Couleur, string> = { texte: '#1e1e22', secondaire: '#4a4a55', accent: '#5b3f9e' }

export interface TexteImage {
  texte: string
  x: number
  /** Ligne de base (px depuis le haut) */
  y: number
  taille: number
  gras: boolean
  couleur: Couleur
}

export interface PlanImage {
  largeur: number
  hauteur: number
  textes: TexteImage[]
}

export type Mesure = (texte: string, taille: number, gras: boolean) => number

// Coupe `texte` en lignes qui tiennent dans `largeurMax` ; un mot trop long est coupé au caractère.
function couper(texte: string, largeurMax: number, taille: number, gras: boolean, mesure: Mesure): string[] {
  const lignes: string[] = []
  let courante = ''
  const pousser = (mot: string) => {
    const essai = courante === '' ? mot : `${courante} ${mot}`
    if (mesure(essai, taille, gras) <= largeurMax) {
      courante = essai
      return
    }
    if (courante !== '') {
      lignes.push(courante)
      courante = ''
    }
    if (mesure(mot, taille, gras) <= largeurMax) {
      courante = mot
      return
    }
    // Mot plus large que la ligne : découpé caractère par caractère
    let morceau = ''
    for (const c of mot) {
      if (morceau !== '' && mesure(morceau + c, taille, gras) > largeurMax) {
        lignes.push(morceau)
        morceau = ''
      }
      morceau += c
    }
    courante = morceau
  }
  for (const mot of texte.split(/\s+/).filter(Boolean)) pousser(mot)
  if (courante !== '') lignes.push(courante)
  return lignes
}

/** Mise en page du rapport : lignes de texte positionnées, hauteur adaptée au contenu. */
export function planImage(r: RapportExport, mesure: Mesure): PlanImage {
  const textes: TexteImage[] = []
  let y = MARGE
  const ajouter = (texte: string, taille: number, gras: boolean, couleur: Couleur, x = MARGE, interligne = 1.35) => {
    for (const ligne of couper(texte, LARGEUR_IMAGE - MARGE - x, taille, gras, mesure)) {
      y += taille * interligne
      textes.push({ texte: ligne, x, y, taille, gras, couleur })
    }
  }

  ajouter(r.nom, 56, true, 'texte', MARGE, 1.2)
  if (r.dateLongue) ajouter(r.dateLongue, 30, false, 'secondaire')
  ajouter(`Durée ${r.duree} · Tonnage ${r.tonnage} · Séries ${r.series}`, 32, true, 'accent')
  if (r.notesSeance.trim()) ajouter(r.notesSeance.trim(), 28, false, 'secondaire')

  for (const g of r.groupes) {
    y += ESPACE_BLOC
    if (g.titre) ajouter(g.titre, 30, true, 'accent')
    for (const e of g.exercices) {
      y += ESPACE_BLOC / 2
      ajouter(e.nom, 36, true, 'texte')
      ajouter(e.cible, 28, false, 'secondaire', MARGE + RETRAIT)
      if (e.note?.trim()) ajouter(`Note : ${e.note.trim()}`, 28, false, 'secondaire', MARGE + RETRAIT)
      for (const l of e.lignes) ajouter(detailLigne(l), 28, false, 'texte', MARGE + RETRAIT)
      if (e.lignes.length === 0) ajouter('Aucune série enregistrée.', 28, false, 'secondaire', MARGE + RETRAIT)
    }
  }

  if (r.notesInstance.trim()) {
    y += ESPACE_BLOC
    ajouter(`Note : ${r.notesInstance.trim()}`, 28, false, 'texte')
  }
  y += ESPACE_BLOC
  ajouter('Rapport généré par PandaMove', 24, false, 'secondaire')
  return { largeur: LARGEUR_IMAGE, hauteur: Math.ceil(y + MARGE), textes }
}

export const nomFichierImage = (nomSeance: string, date: string): string => nomFichierRapport(nomSeance, date).replace(/\.html$/, '.png')

const police = (taille: number, gras: boolean) => `${gras ? '700' : '400'} ${taille}px system-ui, -apple-system, "Segoe UI", sans-serif`

/** Peint le rapport sur un canvas et renvoie le PNG. `creerCanvas` est injectable (tests). */
export async function genererPng(
  r: RapportExport,
  creerCanvas: () => HTMLCanvasElement = () => document.createElement('canvas'),
): Promise<Blob> {
  const canvas = creerCanvas()
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Le canvas n’est pas disponible sur cet appareil.')
  const mesure: Mesure = (texte, taille, gras) => {
    ctx.font = police(taille, gras)
    return ctx.measureText(texte).width
  }
  const plan = planImage(r, mesure)
  // Redimensionner réinitialise l'état du contexte : on peint après
  canvas.width = plan.largeur
  canvas.height = plan.hauteur
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, plan.largeur, plan.hauteur)
  ctx.textBaseline = 'alphabetic'
  for (const t of plan.textes) {
    ctx.font = police(t.taille, t.gras)
    ctx.fillStyle = COULEURS[t.couleur]
    ctx.fillText(t.texte, t.x, t.y)
  }
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Le PNG n’a pas pu être produit.'))), 'image/png')
  })
}
