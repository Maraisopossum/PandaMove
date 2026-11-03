import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = readFileSync(new URL('../../../app/app.css', import.meta.url), 'utf8')
const ligneCardio = readFileSync(new URL('./LigneCardio.tsx', import.meta.url), 'utf8')

// Dans une carte de séance, les boutons d'action qui ne sont pas « principal » deviennent des carrés de 44 px (icônes 📅 et ⋮),
// SAUF ceux de la liste des « boutons texte » (largeur du contenu). Un bouton texte oublié de cette liste voit son libellé rogné,
// ce que les tests jsdom ne peuvent pas détecter : on vérifie donc le CSS lui-même.
describe('boutons d’action de la ligne cardio', () => {
  const regleTexte = /((?:\.seance__actions > \.bouton\[aria-label\^='[^']+'\],?\s*)+)\{[^}]*width:\s*auto/.exec(css)
  const prefixesTexte = regleTexte ? [...regleTexte[1].matchAll(/\^='([^']+)'/g)].map((m) => m[1]) : []
  // Premier mot de chaque nom accessible de bouton de LigneCardio : Valider, Dévalider, Modifier, Changer, Supprimer
  const prefixesUtilises = [...ligneCardio.matchAll(/aria-label=\{`([^$`]+?)\s*\$\{/g)].map((m) => m[1].trim().split(' ')[0])

  it('la règle des boutons texte existe', () => {
    expect(prefixesTexte.length).toBeGreaterThan(0)
  })

  it('lit bien tous les boutons de la ligne', () => {
    expect([...new Set(prefixesUtilises)].sort()).toEqual(['Changer', 'Dévalider', 'Modifier', 'Supprimer', 'Valider'])
  })

  it.each(['Dévalider', 'Modifier', 'Changer', 'Supprimer'])('« %s » est un bouton texte (largeur du contenu, libellé entier)', (prefixe) => {
    expect(prefixesTexte).toContain(prefixe)
  })

  it('« Valider » est le bouton principal, qui prend la place restante', () => {
    expect(ligneCardio).toMatch(/className="bouton bouton--principal"[^>]*aria-label=\{`Valider /)
  })
})

describe('champs de saisie d’une séance de cardio', () => {
  it('le message d’erreur d’un champ a un style (texte, jamais la couleur seule)', () => {
    expect(css).toMatch(/\.formulaire__erreur\s*{/)
  })

  it('le bouton « Ajouter une séance de cardio » a un style', () => {
    expect(css).toMatch(/\.calendrier__ajout\s*{/)
  })
})
