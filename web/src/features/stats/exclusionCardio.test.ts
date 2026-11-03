import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const features = join(here, '..')

// Dossiers dont les requêtes ne doivent jamais lire les séances de cardio (hors statistiques : règle du spec).
const DOSSIERS = ['stats', 'demarrage', 'home']
const INTERDITS = ['seances_course', 'seances_velo']

const estSource = (nom: string) => /\.tsx?$/.test(nom) && !/\.test\.tsx?$/.test(nom)

function sources(dossier: string): string[] {
  return readdirSync(dossier, { withFileTypes: true }).flatMap((e) => {
    const chemin = join(dossier, e.name)
    if (e.isDirectory()) return sources(chemin)
    return estSource(e.name) ? [chemin] : []
  })
}

describe('exclusion du cardio des statistiques, du démarrage et de l’accueil', () => {
  const fichiers = DOSSIERS.flatMap((d) => sources(join(features, d)))

  it('parcourt de vrais fichiers (le test ne passe pas à vide)', () => {
    const noms = fichiers.map((f) => f.slice(features.length + 1).replace(/\\/g, '/'))
    expect(noms).toEqual(expect.arrayContaining(['stats/statsQueries.ts', 'demarrage/useDemarrage.ts', 'home/useEcranAccueil.ts']))
  })

  it.each(INTERDITS)('aucune source ne mentionne %s', (table) => {
    const fautifs = fichiers.filter((f) => readFileSync(f, 'utf8').includes(table)).map((f) => f.slice(features.length + 1))
    expect(fautifs).toEqual([])
  })
})
