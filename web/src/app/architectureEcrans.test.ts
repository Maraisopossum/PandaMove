import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// Règle d'architecture (CLAUDE.md) : écran = composant de présentation + hook. Un composant (.tsx) n'appelle jamais `getDb()` : la lecture
// et l'écriture passent par un hook ou un module `.ts` voisin (useAcces<Module>, use<Ecran>…), qui s'appuie sur les dépôts. La liste
// d'exceptions est vide ; elle ne doit jamais grandir.
const RACINE = resolve(import.meta.dirname, '..')
const EXCEPTIONS: string[] = []

function fichiers(dossier: string): string[] {
  return readdirSync(dossier, { withFileTypes: true }).flatMap((e) => {
    const chemin = join(dossier, e.name)
    if (e.isDirectory()) return fichiers(chemin)
    return e.name.endsWith('.tsx') && !/\.test\.tsx$/.test(e.name) ? [chemin] : []
  })
}

describe('architecture des écrans', () => {
  it('aucun composant de src/features ni de src/app n’appelle getDb()', () => {
    const fautifs = [...fichiers(join(RACINE, 'features')), ...fichiers(join(RACINE, 'app'))]
      .filter((f) => /\bgetDb\b/.test(readFileSync(f, 'utf8')))
      .map((f) => relative(RACINE, f).replaceAll('\\', '/'))
      .filter((f) => !EXCEPTIONS.includes(f))
    expect(fautifs, 'un composant lit la base : extraire un hook (voir useAccesNutrition.ts ou useAccesHyrox.ts)').toEqual([])
  })
})
