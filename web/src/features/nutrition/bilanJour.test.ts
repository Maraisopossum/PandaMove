import { describe, expect, it } from 'vitest'
import { bilanDuJour, messageEau, salutDuJour } from './outils'

const NBSP = /\s/g
const net = (s: string) => s.replace(NBSP, ' ')

describe('mot d’accueil et bilan du jour', () => {
  it('le mot d’accueil suit l’heure aujourd’hui, et reste neutre pour un autre jour', () => {
    expect(salutDuJour('2026-11-15', '2026-11-15', 8)).toBe('Bon matin')
    expect(salutDuJour('2026-11-15', '2026-11-15', 12)).toBe('Bon appétit')
    expect(salutDuJour('2026-11-15', '2026-11-15', 16)).toBe('Bon après-midi')
    expect(salutDuJour('2026-11-15', '2026-11-15', 20)).toBe('Bonne soirée')
    expect(salutDuJour('2026-11-14', '2026-11-15', 12)).toBe('Bilan de la journée')
  })

  it('objectif atteint entre 90 % et 110 % : le panda fête', () => {
    expect(bilanDuJour(2160, 2400, true)).toMatchObject({ atteint: true, titre: 'Objectif atteint, bravo !' })
    expect(bilanDuJour(2640, 2400, true).atteint).toBe(true)
    expect(net(bilanDuJour(2386, 2400, true).texte)).toBe('2 386 kcal sur 2 400.')
    expect(bilanDuJour(2159, 2400, true).atteint).toBe(false)
    expect(bilanDuJour(2641, 2400, true).atteint).toBe(false)
  })

  it('en dessous : ce qu’il reste ; au-dessus : un ton bienveillant, jamais un reproche', () => {
    expect(net(bilanDuJour(988, 2400, true).texte)).toBe('Il reste 1 412 kcal pour aujourd’hui.')
    expect(net(bilanDuJour(988, 2400, false).texte)).toBe('988 kcal sur 2 400.')
    expect(bilanDuJour(3200, 2400, true).texte).toMatch(/rien de grave/)
    expect(bilanDuJour(3200, 2400, false).texte).toBe('Au-dessus de l’objectif ce jour-là.')
  })

  it('sans objectif : invite à noter les repas, aucune fête', () => {
    expect(bilanDuJour(500, null, true)).toMatchObject({ atteint: false, texte: 'Ajoutez vos repas pour suivre votre journée.' })
    expect(bilanDuJour(0, 0, true).atteint).toBe(false)
    expect(bilanDuJour(500, null, false).texte).toMatch(/500 kcal ce jour-là/)
  })

  it('le petit mot de l’hydratation', () => {
    expect(messageEau(0, 2500)).toBe('Un verre de plus ?')
    expect(net(messageEau(1250, 2500))).toBe('Plus que 1 250 ml.')
    expect(messageEau(2500, 2500)).toBe('Objectif d’eau atteint.')
    expect(messageEau(100, 0)).toBe('')
  })
})
