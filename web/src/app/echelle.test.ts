import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// Échelle de dimensions (app.css) alignée sur les jetons Stitch « PandaMove System » (web/DESIGN.md §3) :
// garde-fous d'accessibilité (cibles tactiles, taille minimale du texte) et tailles rendues attendues.
const css = readFileSync(new URL('./app.css', import.meta.url), 'utf8')
const polices = readFileSync(new URL('./polices.css', import.meta.url), 'utf8')

/** Valeur d'un jeton défini dans le premier bloc `:root` (échelle mobile par défaut). */
function jeton(nom: string): string {
  const m = new RegExp(`${nom}:\\s*([^;]+);`).exec(css)
  expect(m, nom).not.toBeNull()
  return m![1].trim()
}

// La racine reste à 100 % (1rem = 16 px, comme les maquettes Stitch) : la taille de police choisie par
// l'utilisateur dans le système s'applique par pourcentage, sans facteur de correction caché.
const PX_PAR_REM = 16

/** Taille en px d'un jeton exprimé en rem ou en px. */
function px(nom: string): number {
  const v = jeton(nom)
  return v.endsWith('rem') ? parseFloat(v) * PX_PAR_REM : parseFloat(v)
}

describe('échelle de dimensions (jetons Stitch)', () => {
  it('cibles tactiles : contrôle 48 px, cellule 44 px, barre 52 px', () => {
    expect(px('--hauteur-controle')).toBe(48)
    expect(px('--hauteur-cellule')).toBe(44)
    expect(px('--hauteur-barre')).toBe(52)
  })

  it('rayons : carte 16 px, bouton 12 px, pilule 999 px', () => {
    expect(px('--radius-carte')).toBe(16)
    expect(px('--radius-bouton')).toBe(12)
    expect(px('--radius-pilule')).toBe(999)
  })

  it('aucune base de police réduite : pas de html à 93,75 % (1rem = 16 px partout)', () => {
    expect(css).not.toMatch(/font-size:\s*93\.75%/)
    expect(css).not.toMatch(/\nhtml\s*\{[^}]*font-size:\s*(?!100%)\d/)
  })

  it('tailles rendues à 390 px : corps 16, petit 14, micro 13, titre mobile 22, KPI 26, chrono 40', () => {
    expect(px('--taille-corps')).toBe(16)
    expect(px('--taille-petit')).toBe(14)
    expect(px('--taille-micro')).toBe(13)
    expect(px('--taille-titre-1')).toBe(22)
    expect(px('--taille-titre-2')).toBe(20)
    expect(px('--taille-titre-3')).toBe(18)
    expect(px('--taille-kpi')).toBe(26)
    expect(px('--taille-chrono')).toBe(40)
  })

  it('aucun texte courant ne descend sous 12 px', () => {
    for (const nom of ['--taille-petit', '--taille-micro']) {
      expect(px(nom), nom).toBeGreaterThanOrEqual(12)
    }
  })

  it('jetons de couleur : modules et succès de Stitch', () => {
    expect(jeton('--couleur-renforcement')).toBe('#5b3d9e')
    expect(jeton('--couleur-calendrier')).toBe('#e65100')
    expect(jeton('--couleur-stats')).toBe('#bf360c')
    expect(jeton('--couleur-import')).toBe('#1565c0')
    expect(jeton('--couleur-succes')).toBe('#059669')
    expect(jeton('--couleur-succes-fond')).toBe('#ecfdf5')
    expect(jeton('--stepper-btn-couleur')).toBe('#7c5cbf')
  })

  it('le bouton ✓ garde une zone cliquable de 44 x 44 px', () => {
    const m = /\.tableau-series__fait \{([^}]*)\}/.exec(css)
    expect(m).not.toBeNull()
    expect(m![1]).toMatch(/width:\s*44px/)
    expect(m![1]).toMatch(/height:\s*44px/)
  })

  it('la barre flottante réserve la zone sécurisée et porte l’ombre flottante', () => {
    const m = /\.execution__actions-flottantes \{([^}]*)\}/.exec(css)
    expect(m).not.toBeNull()
    expect(m![1]).toMatch(/env\(safe-area-inset-bottom\)/)
    expect(m![1]).toMatch(/var\(--ombre-flottante\)/)
  })
})

describe('polices hébergées', () => {
  it('Plus Jakarta Sans et Inter : variables, font-display swap, sous-ensemble latin', () => {
    expect(polices).toMatch(/font-family:\s*'Plus Jakarta Sans Variable'/)
    expect(polices).toMatch(/font-family:\s*'Inter Variable'/)
    expect(polices.match(/^\s*font-display:\s*swap/gm)?.length).toBe(2)
    expect(polices).not.toMatch(/cyrillic|greek|vietnamese/)
  })

  it('titres en Plus Jakarta Sans, texte en Inter, repli système', () => {
    expect(jeton('--police-titres')).toMatch(/^'Plus Jakarta Sans Variable'.*system-ui/)
    expect(jeton('--police-texte')).toMatch(/^'Inter Variable'.*system-ui/)
  })
})
