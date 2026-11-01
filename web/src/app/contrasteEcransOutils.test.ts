import { describe, expect, it } from 'vitest'
import { composer, ratioContraste } from './contraste'

// Couleurs des écrans calendrier, statistiques, profil et import (app.css) : texte >= 4,5:1, graphique >= 3:1, clair et sombre.
const sur = (couleur: string, alpha: number, fond: string) => composer({ couleur, alpha }, fond)
const SOMBRE = '#1e1e22'

describe('contrastes AA du calendrier, des statistiques, du profil et de l’import', () => {
  it.each([
    ['calendrier : texte orange sur blanc', '#b43c00', '#ffffff'],
    ['calendrier : texte orange sur fond orangé, clair', '#b43c00', '#fff7ed'],
    ['calendrier : jour choisi, clair', '#b43c00', '#ffedd5'],
    ['calendrier : texte orange sur surface, sombre', '#fb923c', SOMBRE],
    ['calendrier : jour courant, sombre', '#fb923c', sur('#fb923c', 0.12, SOMBRE)],
    ['calendrier : jour choisi, sombre', '#fb923c', sur('#fb923c', 0.22, SOMBRE)],
    ['calendrier : bouton « Ouvrir » (blanc sur #c2410c)', '#ffffff', '#c2410c'],
    ['statistiques : pilule de période active', '#ffffff', '#c2410c'],
    ['statistiques : texte orange sur blanc, clair', '#c2410c', '#ffffff'],
    ['statistiques : texte orange, sombre', '#fb923c', SOMBRE],
    ['import : bouton (blanc sur #1565c0)', '#ffffff', '#1565c0'],
    ['import : icône sur encart, clair', '#0d47a1', '#eff6ff'],
    ['import : icône sur encart, sombre', '#bfdbfe', sur('#90caf9', 0.1, SOMBRE)],
    ['profil : icône sauge sur son fond, clair', '#576746', sur('#576746', 0.1, '#ffffff')],
    ['profil : icône sauge sur son fond, sombre', '#a6bb90', sur('#a6bb90', 0.14, SOMBRE)],
    ['texte secondaire sur fond discret, clair', '#5c5c66', sur('#1e1e22', 0.05, '#ffffff')],
    ['texte secondaire sur fond discret, sombre', '#a8a8b3', sur('#f2f2f5', 0.05, SOMBRE)],
  ])('%s', (_nom, texte, fond) => {
    expect(ratioContraste(texte, fond)).toBeGreaterThanOrEqual(4.5)
  })

  it.each([
    ['pastille « programmée », clair', '#b45309', '#ffffff'],
    ['pastille « terminée », clair', '#059669', '#ffffff'],
    ['pastille « programmée », sombre', '#fbbf24', SOMBRE],
    ['pastille « terminée », sombre', '#34d399', SOMBRE],
    ['bordure du jour choisi, clair', '#e65100', '#ffedd5'],
    ['bande des chiffres-clés, clair', '#c2410c', '#ffffff'],
    ['bande des chiffres-clés, sombre', '#fb923c', SOMBRE],
    ['interrupteur du profil allumé', '#576746', '#ffffff'],
  ])('graphique : %s', (_nom, a, b) => {
    expect(ratioContraste(a, b)).toBeGreaterThanOrEqual(3)
  })
})
