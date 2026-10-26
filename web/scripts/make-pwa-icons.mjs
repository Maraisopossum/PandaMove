// Génère les icônes PWA à partir de l'icône Android (usage ponctuel : `node scripts/make-pwa-icons.mjs`).
// Les PNG produits dans public/icons/ sont versionnés ; relancer le script seulement si la source change.
import { mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const racine = join(dirname(fileURLToPath(import.meta.url)), '..')
const source = join(racine, '..', 'assets', '09_UI_Formats', 'app_icon_v1.png')
const sortie = join(racine, 'public', 'icons')
// Fond de la version « maskable » (cohérent avec background_color du manifeste)
const FOND = { r: 255, g: 255, b: 255, alpha: 1 }

await mkdir(sortie, { recursive: true })

// Icônes « any » : simple réduction, transparence conservée
for (const taille of [192, 512]) {
  await sharp(source).resize(taille, taille, { fit: 'cover' }).png().toFile(join(sortie, `icon-${taille}.png`))
}

// Icône maskable : le motif occupe ~70 % du centre (zone de sécurité de 80 %), le reste est du fond uni
const TAILLE = 512
const motif = Math.round(TAILLE * 0.7)
const centre = await sharp(source).resize(motif, motif, { fit: 'cover' }).png().toBuffer()
await sharp({ create: { width: TAILLE, height: TAILLE, channels: 4, background: FOND } })
  .composite([{ input: centre, gravity: 'center' }])
  .png()
  .toFile(join(sortie, 'icon-maskable-512.png'))

console.log('Icônes écrites dans', sortie)
