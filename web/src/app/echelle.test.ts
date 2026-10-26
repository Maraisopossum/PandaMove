import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// Échelle de dimensions mobile (app.css) : garde-fous d'accessibilité (cibles tactiles, taille minimale du texte).
const css = readFileSync(new URL('./app.css', import.meta.url), 'utf8')

/** Valeur d'un jeton défini dans le premier bloc `:root` (échelle mobile par défaut). */
function jeton(nom: string): string {
  const m = new RegExp(`${nom}:\\s*([^;]+);`).exec(css)
  expect(m, nom).not.toBeNull()
  return m![1].trim()
}

// Sous 641 px : 1rem = 15 px (html à 93,75 %)
const PX_PAR_REM_MOBILE = 15

describe('échelle de dimensions mobile', () => {
  it('la hauteur de contrôle reste de 44 px au moins (cible tactile)', () => {
    expect(parseFloat(jeton('--hauteur-controle'))).toBeGreaterThanOrEqual(44)
  })

  it('la racine mobile est à 93,75 % (1rem = 15 px) et revient à 100 % au-dessus de 640 px', () => {
    expect(css).toMatch(/\nhtml\s*\{\s*font-size:\s*93\.75%/)
    expect(css).toMatch(/@media \(min-width: 641px\)\s*\{\s*html\s*\{\s*font-size:\s*100%/)
  })

  it('aucun texte courant ne descend sous 12 px sur mobile', () => {
    for (const nom of ['--taille-petit', '--taille-micro']) {
      expect(parseFloat(jeton(nom)) * PX_PAR_REM_MOBILE, nom).toBeGreaterThanOrEqual(12)
    }
  })

  it('les chiffres clés restent entre 22 et 26 px et les titres entre 18 et 22 px sur mobile', () => {
    const kpi = parseFloat(jeton('--taille-kpi')) * PX_PAR_REM_MOBILE
    expect(kpi).toBeGreaterThanOrEqual(22)
    expect(kpi).toBeLessThanOrEqual(26)
    const titre2 = parseFloat(jeton('--taille-titre-2')) * PX_PAR_REM_MOBILE
    expect(titre2).toBeGreaterThanOrEqual(18)
    expect(titre2).toBeLessThanOrEqual(22)
  })

  it('le bouton ✓ garde une zone cliquable de 44 x 44 px', () => {
    const m = /\.tableau-series__fait \{([^}]*)\}/.exec(css)
    expect(m).not.toBeNull()
    expect(m![1]).toMatch(/width:\s*44px/)
    expect(m![1]).toMatch(/height:\s*44px/)
  })
})
