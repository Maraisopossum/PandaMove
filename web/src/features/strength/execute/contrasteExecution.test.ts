import { describe, expect, it } from 'vitest'
import { composer, ratioContraste } from '../../../app/contraste'

// Couleurs des outils de l'exécution (app.css) : texte sur sa pastille teintée, AA (>= 4,5:1) en clair et en sombre.
const sur = (couleur: string, alpha: number, fond: string) => composer({ couleur, alpha }, fond)

describe('contrastes AA des outils de l’exécution', () => {
  it.each([
    ['badge de repos, thème clair', '#5b3d9e', sur('#5b3d9e', 0.12, '#ffffff')],
    ['badge de repos urgent, thème clair', '#b3261e', sur('#b3261e', 0.18, '#ffffff')],
    ['badge de repos, thème sombre', '#c9b6f2', sur('#c9b6f2', 0.16, '#1e1e22')],
    ['badge de repos urgent, thème sombre', '#ff8a80', sur('#ff8a80', 0.18, '#1e1e22')],
    ['bandeau de progression (début du dégradé)', '#ffffff', '#5b3d9e'],
    ['bandeau de progression (fin du dégradé)', '#ffffff', '#3f2778'],
    ['palier fait, thème clair', '#2a7430', '#ffffff'],
    ['palier fait, thème sombre', '#81c784', '#1e1e22'],
    ['total des disques, thème clair', '#5b3d9e', '#f3eefb'],
    ['total des disques, thème sombre', '#c9b6f2', '#2a2540'],
  ])('%s', (_nom, texte, fond) => {
    expect(ratioContraste(texte, fond)).toBeGreaterThanOrEqual(4.5)
  })
})
