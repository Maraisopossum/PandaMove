import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = readFileSync(new URL('../../../app/app.css', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const regle = (selecteur: string) => {
  const debut = css.indexOf(`
${selecteur} {`)
  return debut < 0 ? '' : css.slice(debut, css.indexOf('}', debut))
}

// Sur téléphone, un champ de saisie ne doit pas élargir la carte d'exercice au-delà de l'écran :
// les colonnes de grille sont en minmax(0, 1fr) et les champs peuvent rétrécir.
describe("styles de la carte d'exercice (édition)", () => {
  it('le panneau et la durée cible utilisent des colonnes rétractables', () => {
    expect(regle('.exo__panneau')).toContain('grid-template-columns: minmax(0, 1fr)')
    expect(regle('.duree__champs')).toContain('repeat(2, minmax(0, 1fr))')
  })

  it('les champs de formulaire occupent la colonne sans la dépasser', () => {
    const bloc = /\.formulaire__champ textarea \{([^}]*)\}/.exec(css)?.[1] ?? ''
    expect(bloc).toContain('width: 100%')
    expect(bloc).toContain('min-width: 0')
  })
})
