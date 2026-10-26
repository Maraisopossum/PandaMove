import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { ratioContraste } from '../../../app/contraste'
import { couleursBloc } from '../execute/navExercices'
import { TYPES_BLOC } from '../draft'

// Contrastes WCAG AA (4,5:1 pour le texte) des teintes de l'écran d'édition, lues dans app.css.
const css = readFileSync(new URL('../../../app/app.css', import.meta.url), 'utf8')
const debut = css.indexOf("/* Édition d'une séance de renforcement")

function jetons(selecteur: string): Record<string, string> {
  const bloc = new RegExp(`${selecteur.replace(/[[\]'.]/g, '\\$&')} \\{([^}]*)\\}`).exec(css.slice(debut))
  expect(bloc, selecteur).not.toBeNull()
  return Object.fromEntries([...bloc![1].matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1], m[2]]))
}

const CLAIR = { surface: '#ffffff', ...jetons(':root') }
const SOMBRE = { surface: '#1e1e22', ...jetons(":root[data-theme='dark']") }

const PAIRES: [string, string, string][] = [
  ['puce-texte', 'puce-fond', 'badge progression / compteurs'],
  ['puce-active-texte', 'puce-active-fond', 'puce ou rang actif'],
  ['badge-orange-texte', 'badge-orange-fond', 'badge bilatéral'],
  ['avertissement', 'surface', 'avertissements sur la carte'],
  ['avertissement', 'progression-fond', 'avertissements dans la surcharge'],
  ['puce-texte', 'surface', 'boutons + / − sur la carte'],
]

describe('contraste AA des jetons de l’édition', () => {
  for (const [nom, theme] of [['clair', CLAIR], ['sombre', SOMBRE]] as const) {
    for (const [fg, bg, usage] of PAIRES) {
      it(`${nom} : ${usage} (${fg} sur ${bg})`, () => {
        expect(theme[fg as keyof typeof theme], fg).toBeTruthy()
        expect(ratioContraste(theme[fg as keyof typeof theme], theme[bg as keyof typeof theme])).toBeGreaterThanOrEqual(4.5)
      })
    }
  }

  it('nom de bloc : teintes de la barre d’exercices sur le fond teinté de la carte (8 % de la teinte)', () => {
    const teinte = (hex: string, fond: string) => {
      const m = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
      const [a, b] = [m(hex), m(fond)]
      return '#' + a.map((c, i) => Math.round(c * 0.08 + b[i] * 0.92).toString(16).padStart(2, '0')).join('')
    }
    for (const type of TYPES_BLOC) {
      const c = couleursBloc(type)
      expect(ratioContraste(c.clair, teinte(c.clair, CLAIR.surface)), `${type} clair`).toBeGreaterThanOrEqual(4.5)
      expect(ratioContraste(c.sombre, teinte(c.sombre, SOMBRE.surface)), `${type} sombre`).toBeGreaterThanOrEqual(4.5)
    }
  })
})
