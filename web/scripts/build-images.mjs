// Pipeline d'images du panda (spec §8) : `npm run images`.
// Lit un sous-ensemble de assets/ (PNG lourds, jamais copiés dans web/), produit des WebP dans public/panda/
// et écrit le manifeste typé src/core/images/manifest.generated.ts (versionné, comme les WebP).
//
// - Deux tailles par image (sm, lg), sauf les fonds de heatmap : taille unique 600 × 900, car les calques
//   SVG de src/features/stats/heatmapZones.ts sont tracés dans ce repère (ne pas changer leur taille).
// - Idempotent : une sortie plus récente que sa source n'est pas ré-encodée ; le manifeste n'est réécrit
//   que si son contenu change, et son contenu ne dépend que des fichiers produits (pas de date).
// - `--force` : ré-encode tout. `--check` : n'encode rien, vérifie que chaque sortie existe et que le
//   manifeste commité correspond aux fichiers de public/panda/ (code de sortie 1 sinon ; utilisé par les tests).
import { existsSync } from 'node:fs'
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const racine = join(dirname(fileURLToPath(import.meta.url)), '..')
const assets = join(racine, '..', 'assets')
const sortie = join(racine, 'public', 'panda')
const fichierManifeste = join(racine, 'src', 'core', 'images', 'manifest.generated.ts')

const CHECK = process.argv.includes('--check')
const FORCE = process.argv.includes('--force')

// Largeur cible par taille (la hauteur suit le ratio de la source ; jamais d'agrandissement)
const LARGEURS = { sm: 320, lg: 640 }
const HEATMAP = { largeur: 600, hauteur: 900 }

const EMO_M = '02_Emotions_Male'
const EMO_F = '03_Emotions_Female'
const POSES = '07A_Poses'
const UI = '09_UI_Formats'
const FONDS = '10_Backgrounds'
const HEAT = '11_Heatmaps'

// nom logique -> { alt, sources par variante (chemin relatif à assets/), heatmap = taille unique }
const IMAGES = {
  // Émotions
  joy: { alt: 'Panda joyeux, bras ouverts', male: `${EMO_M}/male_emotion_joy_v1.png`, female: `${EMO_F}/female_emotion_joy_v1.png` },
  victory: { alt: 'Panda qui célèbre sa victoire', male: `${EMO_M}/male_emotion_victory_v1.png`, female: `${EMO_F}/female_emotion_victory_v1.png` },
  tired: { alt: 'Panda fatigué, à bout de souffle', male: `${EMO_M}/male_emotion_tired_v1.png`, female: `${EMO_F}/female_emotion_tired_v1.png` },
  injury: { alt: 'Panda blessé, avec un pansement', male: `${EMO_M}/male_emotion_injury_v1.png`, female: `${EMO_F}/female_emotion_injury_v1.png` },
  motivation: { alt: 'Panda motivé, poing levé', male: `${EMO_M}/male_emotion_motivation_v1.png`, female: `${EMO_F}/female_emotion_motivation_v1.png` },
  // Sport
  musculation: { alt: 'Panda qui soulève des haltères', male: '05_Sports_Male/male_musculation_v1.png', female: '06_Sports_Female/female_musculation_v1.png' },
  // Poses (la plupart n'existent qu'en version femme : pandaImage se replie dessus)
  pose_standing: { alt: 'Panda debout', male: `${POSES}/male_pose_standing_v1.png`, female: `${POSES}/female_pose_standing_v1.png` },
  pose_sitting: { alt: 'Panda assis, au repos', male: `${POSES}/male_pose_sitting_v1.png`, female: `${POSES}/female_pose_sitting_v1.png` },
  pose_squat: { alt: 'Panda en squat', female: `${POSES}/female_pose_squat_v1.png` },
  pose_deadlift: { alt: 'Panda en soulevé de terre', female: `${POSES}/female_pose_deadlift_v1.png` },
  pose_pushup: { alt: 'Panda en pompe', female: `${POSES}/female_pose_pushup_v1.png` },
  pose_plank: { alt: 'Panda en gainage', female: `${POSES}/female_pose_plank_v1.png` },
  pose_farmers_carry: { alt: 'Panda en marche du fermier, une kettlebell dans chaque main', female: `${POSES}/female_pose_farmers_carry_v1.png` },
  pose_burpees: { alt: 'Panda en plein burpee', female: `${POSES}/female_pose_burpees_v1.png` },
  pose_sled_push: { alt: 'Panda qui pousse un traîneau', female: `${POSES}/female_pose_sled_push_v1.png` },
  // Fonds (communs)
  bg_gym: { alt: 'Salle de sport futuriste', commun: `${FONDS}/bg_gym_futuristic_v1.png` },
  bg_reward: { alt: 'Podium illuminé sous des confettis dorés', commun: `${FONDS}/bg_reward_ceremony_v1.png` },
  bg_bamboo: { alt: 'Forêt de bambous', commun: `${FONDS}/bg_bamboo_v1.png` },
  // Formats UI (communs)
  splash: { alt: 'Deux pandas qui courent dans une forêt de bambous', commun: `${UI}/format_splash_v1.png` },
  onboarding_01: { alt: 'Panda qui salue de la main', commun: `${UI}/onboarding_01_welcome.png` },
  onboarding_02: { alt: 'Panda qui court', commun: `${UI}/onboarding_02_sports.png` },
  onboarding_03: { alt: 'Panda qui tient un bol de fruits et de légumes', commun: `${UI}/onboarding_03_nutrition.png` },
  onboarding_04: { alt: 'Panda devant des graphiques de progression', commun: `${UI}/onboarding_04_stats.png` },
  onboarding_05: { alt: 'Deux pandas qui sautent de joie sous les confettis', commun: `${UI}/onboarding_05_ready.png` },
  // Fonds de heatmap : noms de fichiers historiques conservés (heatmap-{variante}-{vue}.webp)
  heatmap_face: { alt: 'Panda vu de face', heatmap: 'face', male: `${HEAT}/male_face_v1.png`, female: `${HEAT}/female_face_v1.png` },
  heatmap_dos: { alt: 'Panda vu de dos', heatmap: 'dos', male: `${HEAT}/male_back_v1.png`, female: `${HEAT}/female_back_v1.png` },
}

const VARIANTES = ['male', 'female', 'commun']

// Nom de fichier publié pour une image, une variante et une taille
function nomFichier(nom, def, variante, taille) {
  if (def.heatmap) return `heatmap-${variante}-${def.heatmap}.webp`
  const base = nom.replaceAll('_', '-')
  return variante === 'commun' ? `${base}-${taille}.webp` : `${base}-${variante}-${taille}.webp`
}

async function aJour(source, cible) {
  if (!existsSync(cible)) return false
  if (FORCE) return false
  if (!existsSync(source)) return true
  return (await stat(cible)).mtimeMs >= (await stat(source)).mtimeMs
}

async function encoder(source, cible, def, taille) {
  const image = sharp(source)
  if (def.heatmap) {
    await image.resize(HEATMAP.largeur, HEATMAP.hauteur, { fit: 'fill' }).webp({ quality: 80 }).toFile(cible)
  } else {
    await image
      .resize({ width: LARGEURS[taille], withoutEnlargement: true })
      .webp({ quality: 78, alphaQuality: 80, effort: 5 })
      .toFile(cible)
  }
}

const erreurs = []
let encodees = 0
const attendus = new Set()
const manifeste = {}

if (!CHECK) await mkdir(sortie, { recursive: true })

for (const [nom, def] of Object.entries(IMAGES)) {
  const variantes = {}
  for (const variante of VARIANTES) {
    if (!def[variante]) continue
    const source = join(assets, def[variante])
    const tailles = {}
    // Heatmap : un seul fichier, partagé par sm et lg
    for (const taille of def.heatmap ? ['lg'] : ['sm', 'lg']) {
      const fichier = nomFichier(nom, def, variante, taille)
      const cible = join(sortie, fichier)
      attendus.add(fichier)
      if (!CHECK && !(await aJour(source, cible))) {
        if (!existsSync(source)) {
          erreurs.push(`Source absente et sortie manquante : ${def[variante]}`)
          continue
        }
        await encoder(source, cible, def, taille)
        encodees++
      }
      if (!existsSync(cible)) {
        erreurs.push(`Sortie manquante : public/panda/${fichier}`)
        continue
      }
      const { width, height } = await sharp(cible).metadata()
      tailles[taille] = { src: `/panda/${fichier}`, width, height }
    }
    if (def.heatmap && tailles.lg) tailles.sm = tailles.lg
    variantes[variante] = { sm: tailles.sm, lg: tailles.lg }
  }
  manifeste[nom] = { alt: def.alt, variantes }
}

const q = (s) => `'${s.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`
const fichierTs = (f) => (f ? `{ src: ${q(f.src)}, width: ${f.width}, height: ${f.height} }` : 'undefined')

function genererManifeste() {
  const lignes = [
    '// Fichier GÉNÉRÉ par scripts/build-images.mjs (`npm run images`) : ne pas modifier à la main.',
    '// Les écrans demandent une image par nom logique via pandaImage(), jamais par chemin.',
    "import type { EntreeManifeste } from './types'",
    '',
    'export const PANDA_MANIFEST = {',
  ]
  for (const [nom, entree] of Object.entries(manifeste)) {
    lignes.push(`  ${nom}: {`, `    alt: ${q(entree.alt)},`, '    variantes: {')
    for (const [variante, t] of Object.entries(entree.variantes)) {
      lignes.push(`      ${variante}: {`, `        sm: ${fichierTs(t.sm)},`, `        lg: ${fichierTs(t.lg)},`, '      },')
    }
    lignes.push('    },', '  },')
  }
  lignes.push(
    '} as const satisfies Record<string, EntreeManifeste>',
    '',
    '/** Nom logique d’une image : un nom absent du manifeste ne compile pas. */',
    'export type PandaImageName = keyof typeof PANDA_MANIFEST',
    '',
  )
  return lignes.join('\n')
}

// Fichiers présents dans public/panda/ mais absents de la liste (signalés, jamais supprimés)
const orphelins = existsSync(sortie) ? (await readdir(sortie)).filter((f) => f.endsWith('.webp') && !attendus.has(f)) : []
for (const f of orphelins) console.warn(`Fichier non référencé dans public/panda/ : ${f}`)

if (erreurs.length > 0) {
  for (const e of erreurs) console.error(e)
  process.exit(1)
}

const contenu = genererManifeste()
// Fins de ligne normalisées : une extraction Git en CRLF (Windows) ne rend pas le manifeste « périmé »
const actuel = existsSync(fichierManifeste) ? (await readFile(fichierManifeste, 'utf8')).replaceAll('\r\n', '\n') : null

if (CHECK) {
  if (actuel !== contenu) {
    console.error('Manifeste périmé : relancer `npm run images`.')
    process.exit(1)
  }
  console.log(`Manifeste à jour (${attendus.size} fichiers).`)
} else {
  if (actuel !== contenu) await writeFile(fichierManifeste, contenu)
  console.log(`${encodees} image(s) encodée(s), ${attendus.size} fichiers attendus ; manifeste ${actuel === contenu ? 'inchangé' : 'écrit'}.`)
}
