import { describe, expect, it } from 'vitest'
import { composer, ratioContraste } from './contraste'

// Couleurs des écrans accueil, liste, détail et rapport de séance (app.css) : texte >= 4,5:1, graphique >= 3:1, clair et sombre.
const sur = (couleur: string, alpha: number, fond: string) => composer({ couleur, alpha }, fond)

describe('contrastes AA de l’accueil, de la liste et du rapport', () => {
  it.each([
    ['carte Renforcement : titre blanc, début du dégradé', '#ffffff', '#5b3d9e'],
    ['carte Renforcement : titre blanc, fin du dégradé', '#ffffff', '#6d28d9'],
    ['carte Renforcement : sous-titre, début du dégradé', '#ede9fe', '#5b3d9e'],
    ['badge Go', '#0f172a', '#a3e635'],
    ['bouton en dégradé, début', '#ffffff', '#6d28d9'],
    ['bouton en dégradé, fin', '#ffffff', '#5b3d9e'],
    ['texte secondaire sur carte, clair', '#5c5c66', '#ffffff'],
    ['texte secondaire sur carte, sombre', '#a8a8b3', '#1e1e22'],
    ['note de carte (fond teinté 4 %), clair', '#5c5c66', sur('#1e1e22', 0.04, '#ffffff')],
    ['note de carte (fond teinté 4 %), sombre', '#a8a8b3', sur('#f2f2f5', 0.04, '#1e1e22')],
    ['statut « réalisé » du rapport, clair', '#047857', '#ffffff'],
    ['statut « réalisé » du rapport, sombre', '#34d399', '#1e1e22'],
    ['icône Calendrier, clair', '#92400e', sur('#92400e', 0.12, '#ffffff')],
    ['icône Calendrier, sombre', '#fbbf24', sur('#fbbf24', 0.12, '#1e1e22')],
    ['icône Statistiques, clair', '#0e7490', sur('#0e7490', 0.12, '#ffffff')],
    ['icône Statistiques, sombre', '#67e8f9', sur('#67e8f9', 0.12, '#1e1e22')],
    ['puce « Modèles », clair', '#4b2e8c', '#ede7f6'],
    ['puce « Modèles », sombre', '#d1c4e9', '#3a2f57'],
  ])('%s', (_nom, texte, fond) => {
    expect(ratioContraste(texte, fond)).toBeGreaterThanOrEqual(4.5)
  })

  it.each([
    ['bande de carte, clair', '#7c5cbf', '#ffffff'],
    ['bande de KPI séries, clair', '#059669', '#ffffff'],
    ['bande de KPI séries, sombre', '#34d399', '#1e1e22'],
  ])('graphique : %s', (_nom, a, b) => {
    expect(ratioContraste(a, b)).toBeGreaterThanOrEqual(3)
  })
})
