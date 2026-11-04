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

// Sur un téléphone, les quatre boutons (Dévalider, Modifier, Changer la date, Supprimer) ne tiennent pas sur une ligne. La règle des
// séances jouées donne `flex: 1 1 0` à « Changer » et « Supprimer » : base nulle, donc jamais de retour à la ligne, et le libellé
// est écrasé ou déborde. Dans une carte de cardio, chaque bouton garde la largeur de son texte et la rangée passe à la ligne.
describe('rangée de boutons d’une carte de cardio sur petit écran', () => {
  const regleCardio = /\.calendrier__seance--cardio \.seance__actions > \.bouton\[aria-label\]\s*\{([^}]*)\}/.exec(css)?.[1] ?? ''
  const posRegleSeances = css.indexOf(".calendrier__seance .seance__actions > .bouton[aria-label^='Changer']")
  const posRegleCardio = css.indexOf('.calendrier__seance--cardio .seance__actions > .bouton[aria-label]')

  it('la règle existe', () => {
    expect(regleCardio).not.toBe('')
  })

  it('les boutons gardent la largeur de leur texte (pas de base nulle, pas de rétrécissement)', () => {
    expect(regleCardio).toMatch(/flex:\s*0 0 auto/)
  })

  it('le libellé ne se coupe pas en deux lignes', () => {
    expect(regleCardio).toMatch(/white-space:\s*nowrap/)
  })

  it('la rangée peut passer à la ligne', () => {
    expect(css).toMatch(/\.seance__actions\s*\{[^}]*flex-wrap:\s*wrap/)
  })

  it('passe après la règle des séances jouées, à spécificité égale ou supérieure', () => {
    expect(posRegleSeances).toBeGreaterThan(-1)
    expect(posRegleCardio).toBeGreaterThan(posRegleSeances)
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
