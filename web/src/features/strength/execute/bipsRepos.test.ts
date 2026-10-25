import { describe, expect, it } from 'vitest'
import { bipRepos } from './bipsRepos'

// Android (ActiveSessionManager) : un bip discret chaque seconde des 5 dernières secondes du repos.
describe('bipRepos', () => {
  it('bip à chaque seconde entière franchie entre 5 et 1', () => {
    expect(bipRepos(5400, 4900)).toBe(true) // 6 s -> 5 s
    expect(bipRepos(4900, 3900)).toBe(true) // 5 -> 4
    expect(bipRepos(1900, 900)).toBe(true) // 2 -> 1
  })

  it('pas de bip avant la dernière tranche de 5 secondes', () => {
    expect(bipRepos(30_000, 29_000)).toBe(false)
    expect(bipRepos(7000, 6000)).toBe(false)
  })

  it('pas de second bip tant que la seconde affichée ne change pas', () => {
    expect(bipRepos(4900, 4300)).toBe(false)
  })

  it('pas de bip à l’arrivée à zéro (c’est la fin du repos, pas un décompte)', () => {
    expect(bipRepos(900, 0)).toBe(false)
  })

  it('pas de bip sans repos avant (démarrage) ni sans repos après (arrêt)', () => {
    expect(bipRepos(null, 4000)).toBe(false)
    expect(bipRepos(3000, null)).toBe(false)
    expect(bipRepos(null, null)).toBe(false)
  })

  it('pas de bip si le repos est rallongé (le décompte remonte)', () => {
    expect(bipRepos(2000, 32_000)).toBe(false)
    expect(bipRepos(3000, 4000)).toBe(false)
  })

  it('une seconde sautée (onglet ralenti) sonne une seule fois', () => {
    expect(bipRepos(5900, 3900)).toBe(true)
  })
})
