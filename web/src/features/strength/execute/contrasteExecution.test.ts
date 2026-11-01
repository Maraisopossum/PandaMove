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

// Tableau de séries à steppers (app.css) : texte >= 4,5:1, éléments graphiques (coche, bouton −/+) >= 3:1.
describe('contrastes du tableau de séries à steppers', () => {
  const ligneClair = sur('#5b3d9e', 0.08, '#ffffff')
  const ligneSombre = sur('#c9b6f2', 0.12, '#1e1e22')
  const estompe = (texte: string, fond: string) => composer({ couleur: texte, alpha: 0.65 }, fond)

  it.each([
    ['n° de la série en cours, clair', '#5b3d9e', ligneClair],
    ['n° de la série en cours, sombre', '#c9b6f2', ligneSombre],
    ['n° des autres séries sur la ligne en cours, clair', '#5c5c66', ligneClair],
    ['n° des autres séries sur la ligne en cours, sombre', '#a8a8b3', ligneSombre],
    ['valeur grisée (prévu) sur cellule, clair', '#5c5c66', '#ffffff'],
    ['valeur grisée (prévu) sur cellule, sombre', '#a8a8b3', '#1e1e22'],
    ['valeur d’une série validée (estompée), clair', estompe('#1e1e22', '#ffffff'), '#ffffff'],
    ['valeur d’une série validée (estompée), sombre', estompe('#f2f2f5', '#1e1e22'), '#1e1e22'],
    ['en-têtes de colonnes, clair', '#5c5c66', '#f6f6f8'],
    ['en-têtes de colonnes, sombre', '#a8a8b3', '#121214'],
  ])('texte : %s', (_nom, texte, fond) => {
    expect(ratioContraste(texte, fond)).toBeGreaterThanOrEqual(4.5)
  })

  it.each([
    ['coche blanche sur cercle validé #059669, clair', '#ffffff', '#059669'],
    ['coche sombre sur cercle validé #34d399, sombre', '#0f2a22', '#34d399'],
    ['cercle validé sur la ligne en cours, clair', '#059669', ligneClair],
    ['cercle validé sur la ligne en cours, sombre', '#34d399', ligneSombre],
    ['boutons − / + sur cellule, clair', '#7c5cbf', '#ffffff'],
    ['boutons − / + sur cellule, sombre', '#b8a1f0', '#1e1e22'],
    ['liseré de la série en cours, clair', '#5b3d9e', '#ffffff'],
    ['liseré de la série en cours, sombre', '#c9b6f2', '#1e1e22'],
  ])('graphique : %s', (_nom, premier, second) => {
    expect(ratioContraste(premier, second)).toBeGreaterThanOrEqual(3)
  })
})

// Barre d'exercices (app.css) : compteur « n sur N », statut des badges à venir, coche verte des exercices terminés.
describe('contrastes de la barre d’exercices', () => {
  it.each([
    ['compteur « n sur N », clair', '#5b3d9e', sur('#5b3d9e', 0.1, '#ffffff')],
    ['compteur « n sur N », sombre', '#c9b6f2', sur('#c9b6f2', 0.1, '#1e1e22')],
    ['statut d’un badge à venir, clair', '#5c5c66', sur('#1e1e22', 0.04, '#ffffff')],
    ['statut d’un badge à venir, sombre', '#a8a8b3', sur('#f2f2f5', 0.04, '#1e1e22')],
    ['nom d’un badge à venir, clair', '#1e1e22', sur('#1e1e22', 0.04, '#ffffff')],
    ['nom d’un badge à venir, sombre', '#f2f2f5', sur('#f2f2f5', 0.04, '#1e1e22')],
    ['étiquette de bloc, clair', '#5c5c66', '#ffffff'],
    ['étiquette de bloc, sombre', '#a8a8b3', '#1e1e22'],
  ])('texte : %s', (_nom, texte, fond) => {
    expect(ratioContraste(texte, fond)).toBeGreaterThanOrEqual(4.5)
  })

  it.each([
    ['coche blanche sur vert, clair', '#ffffff', '#059669'],
    ['coche sombre sur vert, sombre', '#0f2a22', '#34d399'],
  ])('graphique : %s', (_nom, a, b) => {
    expect(ratioContraste(a, b)).toBeGreaterThanOrEqual(3)
  })
})
