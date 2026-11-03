import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))

const estSource = (nom: string) => /\.tsx?$/.test(nom)

function sources(dossier: string): string[] {
  return readdirSync(dossier, { withFileTypes: true }).flatMap((e) => {
    const chemin = join(dossier, e.name)
    if (e.isDirectory()) return sources(chemin)
    return estSource(e.name) ? [chemin] : []
  })
}

// Le renforcement importe l'agenda (onze fichiers de `strength` lisent `InstanceVue`) : si l'agenda importait `strength`
// à son tour, les deux modules formeraient un cycle. Le code partagé (dialogues, dates) vit dans `core/`.
describe('indépendance de l’agenda vis-à-vis du renforcement', () => {
  const fichiers = sources(here)

  it('parcourt de vrais fichiers (le test ne passe pas à vide)', () => {
    expect(fichiers.some((f) => f.endsWith('useCalendar.ts'))).toBe(true)
    expect(fichiers.some((f) => f.endsWith('FeuilleSeanceCardio.tsx'))).toBe(true)
  })

  it('aucun fichier de l’agenda, test compris, n’importe depuis features/strength', () => {
    const fautifs = fichiers
      .filter((f) => /from\s+['"][^'"]*\/strength(\/|['"])/.test(readFileSync(f, 'utf8').replace(/\r\n/g, '\n')))
      .map((f) => f.slice(here.length + 1))
    expect(fautifs).toEqual([])
  })
})
