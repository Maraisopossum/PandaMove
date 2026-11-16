// Génère la pastille du menu Nutrition (public/icons/menu/nutrition.webp) depuis nutrition.svg. À relancer à la main si l'illustration change :
//   node scripts/icones/nutrition.mjs
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const ici = dirname(fileURLToPath(import.meta.url))
const svg = readFileSync(join(ici, 'nutrition.svg'))
await sharp(svg, { density: 288 }).resize(192, 192).webp({ quality: 92 }).toFile(join(ici, '..', '..', 'public', 'icons', 'menu', 'nutrition.webp'))
console.log('nutrition.webp écrit')
