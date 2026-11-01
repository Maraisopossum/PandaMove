import { FORMAT_ID } from './format'

// Extraction du JSON d'une réponse d'IA. Les IA répondent souvent par du texte autour d'un bloc ```json … ```,
// avec parfois des guillemets typographiques ou une virgule finale. Réparations limitées aux deux cas sûrs
// (guillemets doubles typographiques, virgules avant } ou ]) et toujours signalées à l'utilisateur.

export type ResultatExtraction = { ok: true; valeur: unknown; notes: string[] } | { ok: false; erreur: string }

const NOTE_EXTRAIT = 'Bloc JSON extrait du texte collé.'
const NOTE_GUILLEMETS = 'Guillemets typographiques remplacés par des guillemets droits.'
const NOTE_VIRGULES = 'Virgules finales supprimées.'

const estConteneur = (v: unknown): boolean => typeof v === 'object' && v !== null

/** Supprime les virgules suivies (espaces compris) d'une accolade ou d'un crochet fermant, hors des chaînes. */
function sansVirgulesFinales(texte: string): string {
  let sortie = ''
  let dansChaine = false
  for (let i = 0; i < texte.length; i++) {
    const c = texte[i]
    if (dansChaine) {
      sortie += c
      if (c === '\\') sortie += texte[++i] ?? ''
      else if (c === '"') dansChaine = false
      continue
    }
    if (c === '"') dansChaine = true
    if (c === ',') {
      const suite = /^\s*[}\]]/.exec(texte.slice(i + 1))
      if (suite) continue
    }
    sortie += c
  }
  return sortie
}

function essayer(candidat: string): { valeur: unknown; notes: string[] } | { erreur: string } {
  try {
    return { valeur: JSON.parse(candidat), notes: [] }
  } catch (premiere) {
    const notes: string[] = []
    let repare = candidat.replace(/\u00a0/g, ' ')
    if (/[\u201c\u201d\u201e\u201f]/.test(repare)) {
      repare = repare.replace(/[\u201c\u201d\u201e\u201f]/g, '"')
      notes.push(NOTE_GUILLEMETS)
    }
    const sans = sansVirgulesFinales(repare)
    if (sans !== repare) notes.push(NOTE_VIRGULES)
    try {
      return { valeur: JSON.parse(sans), notes }
    } catch {
      return { erreur: messageSyntaxe(candidat, premiere) }
    }
  }
}

// « JSON invalide ou tronqué (ligne 3, colonne 4) » quand la position est connue.
function messageSyntaxe(texte: string, e: unknown): string {
  const m = /position (\d+)/.exec(e instanceof Error ? e.message : '')
  if (!m) return 'JSON invalide ou tronqué'
  const avant = texte.slice(0, Number(m[1]))
  const ligne = avant.split('\n').length
  const colonne = avant.length - avant.lastIndexOf('\n')
  return `JSON invalide ou tronqué (ligne ${ligne}, colonne ${colonne})`
}

// Premier objet { … } équilibré à partir de `debut`, en respectant les chaînes ; null s'il est tronqué.
function objetEquilibre(texte: string, debut: number): string | null {
  let profondeur = 0
  let dansChaine = false
  for (let i = debut; i < texte.length; i++) {
    const c = texte[i]
    if (dansChaine) {
      if (c === '\\') i++
      else if (c === '"' || c === '\u201d' || c === '\u201c') dansChaine = false
      continue
    }
    if (c === '"' || c === '\u201c') dansChaine = true
    else if (c === '{') profondeur++
    else if (c === '}' && --profondeur === 0) return texte.slice(debut, i + 1)
  }
  return null
}

function candidats(texte: string): string[] {
  const trouves: string[] = []
  for (const m of texte.matchAll(/```[a-zA-Z0-9_-]*\s*\n?([\s\S]*?)```/g)) trouves.push(m[1].trim())
  const accolade = texte.indexOf('{')
  if (accolade >= 0) {
    const equilibre = objetEquilibre(texte, accolade)
    if (equilibre) trouves.push(equilibre)
  }
  return trouves.filter((c) => c !== '')
}

/** Extrait le JSON d'un fichier ou d'un texte collé (réponse d'IA comprise). */
export function extraireJson(brut: string): ResultatExtraction {
  const texte = brut.replace(/^\uFEFF/, '').trim()
  if (texte === '') return { ok: false, erreur: 'Le fichier est vide.' }

  const direct = essayer(texte)
  if ('valeur' in direct && estConteneur(direct.valeur)) return { ok: true, valeur: direct.valeur, notes: direct.notes }
  // Un fichier qui commence par { ou [ est du JSON abîmé, pas du texte autour : on dit où ça casse
  if ('erreur' in direct && /^[{[]/.test(texte) && !texte.includes('```')) return { ok: false, erreur: direct.erreur }

  const lus: { valeur: unknown; notes: string[] }[] = []
  let derniereErreur: string | null = null
  for (const candidat of candidats(texte)) {
    const r = essayer(candidat)
    if ('erreur' in r) derniereErreur = r.erreur
    else if (estConteneur(r.valeur)) lus.push({ valeur: r.valeur, notes: [NOTE_EXTRAIT, ...r.notes] })
  }
  const choisi = lus.find((l) => (l.valeur as { format?: unknown }).format === FORMAT_ID) ?? lus[0]
  if (choisi) return { ok: true, valeur: choisi.valeur, notes: choisi.notes }
  if (derniereErreur) return { ok: false, erreur: derniereErreur }
  return { ok: false, erreur: "Aucun JSON trouvé dans le texte. Collez uniquement la réponse JSON de l'IA." }
}
