// Convertit les fonds de heatmap musculaire (assets/11_Heatmaps, PNG 1024×1536) en WebP 600×900
// pour l'écran Statistiques (usage ponctuel : `node scripts/make-heatmaps.mjs`).
// Les WebP produits dans public/panda/ sont versionnés ; relancer le script seulement si la source change.
// Les calques SVG de src/features/stats/heatmapZones.ts sont tracés dans le repère 600×900 :
// changer LARGEUR/HAUTEUR impose de retracer (ou de mettre à l'échelle) ces zones.
import { mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const racine = join(dirname(fileURLToPath(import.meta.url)), '..')
const source = join(racine, '..', 'assets', '11_Heatmaps')
const sortie = join(racine, 'public', 'panda')
const LARGEUR = 600
const HAUTEUR = 900

// Nom source -> nom publié (la vue « back » devient « dos »)
const IMAGES = [
  ['male_face_v1.png', 'heatmap-male-face.webp'],
  ['male_back_v1.png', 'heatmap-male-dos.webp'],
  ['female_face_v1.png', 'heatmap-female-face.webp'],
  ['female_back_v1.png', 'heatmap-female-dos.webp'],
]

await mkdir(sortie, { recursive: true })
for (const [entree, nom] of IMAGES) {
  await sharp(join(source, entree))
    .resize(LARGEUR, HAUTEUR, { fit: 'fill' })
    .webp({ quality: 80 })
    .toFile(join(sortie, nom))
}
console.log('Heatmaps écrites dans', sortie)
