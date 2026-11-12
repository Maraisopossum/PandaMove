import { describe, expect, it } from 'vitest'
import { DUREES_MIN, EXERCICES, SEANCES_TYPES, TOUTES_ZONES, ZONES, type MomentSeance, type ZoneCorps } from './donnees'
import { dureeTotale, genererSeance, remplacerEtape, zonesCouvertes } from './generer'

const demande = (minutes: number, zones: ZoneCorps[] = [], moment: MomentSeance = 'libre', graine = 1) => ({ minutes, zones, moment, graine })

describe('catalogue', () => {
  it('a des identifiants uniques, des durées réalistes et chaque zone est couverte par plusieurs exercices', () => {
    expect(new Set(EXERCICES.map((x) => x.id)).size).toBe(EXERCICES.length)
    for (const x of EXERCICES) {
      expect(x.dureeS, x.id).toBeGreaterThanOrEqual(20)
      expect(x.dureeS, x.id).toBeLessThanOrEqual(60)
      expect(x.consigne.length, x.id).toBeGreaterThan(20)
    }
    for (const z of ZONES) expect(EXERCICES.filter((x) => x.zones[0] === z.id).length, z.id).toBeGreaterThanOrEqual(2)
  })

  it('les séances types ne citent que des zones connues', () => {
    for (const s of SEANCES_TYPES) for (const z of s.zones) expect(TOUTES_ZONES, s.id).toContain(z)
  })
})

describe('genererSeance', () => {
  it.each(DUREES_MIN)('remplit le temps demandé à ±12 %% pour %i minutes (tout le corps)', (minutes) => {
    const p = genererSeance(demande(minutes))
    expect(Math.abs(p.dureeTotaleS - minutes * 60) / (minutes * 60)).toBeLessThanOrEqual(0.12)
    expect(p.dureeTotaleS).toBe(dureeTotale(p.etapes))
  })

  it('ne propose que des exercices des zones ciblées et les couvre toutes quand le temps le permet', () => {
    const cibles: ZoneCorps[] = ['hanches', 'mollets', 'cou']
    const p = genererSeance(demande(15, cibles, 'apres'))
    for (const x of p.etapes) expect(x.exercice.zones.some((z) => cibles.includes(z)), x.exercice.id).toBe(true)
    expect(zonesCouvertes(p.etapes)).toEqual(expect.arrayContaining(cibles))
  })

  it('même graine, même séance ; autre graine, variante', () => {
    const a = genererSeance(demande(10, ['hanches', 'ischios'], 'apres', 7))
    expect(genererSeance(demande(10, ['hanches', 'ischios'], 'apres', 7))).toEqual(a)
    const autres = [1, 2, 3, 4, 5].map((g) => genererSeance(demande(10, ['hanches', 'ischios'], 'apres', g)).etapes.map((x) => x.exercice.id).join())
    expect(new Set(autres).size).toBeGreaterThan(1)
  })

  it('avant le sport : surtout de la mobilité et de l’activation ; après : surtout des étirements', () => {
    const avant = genererSeance(demande(15, ['hanches', 'ischios', 'mollets', 'quadriceps'], 'avant'))
    const apres = genererSeance(demande(15, ['hanches', 'ischios', 'mollets', 'quadriceps'], 'apres'))
    const part = (p: typeof avant, t: string) => p.etapes.filter((x) => x.exercice.type === t).length / p.etapes.length
    expect(part(avant, 'etirement')).toBeLessThan(0.5)
    expect(part(apres, 'etirement')).toBeGreaterThanOrEqual(0.5)
  })

  it('regroupe les postures : debout, puis assis, puis au sol', () => {
    const p = genererSeance(demande(20))
    const rang = { debout: 0, assis: 1, sol: 2 } as const
    const rangs = p.etapes.map((x) => rang[x.exercice.posture])
    expect(rangs).toEqual([...rangs].sort((a, b) => a - b))
  })

  it('reste valide pour 5 minutes sur une seule zone, et sans zone : tout le corps', () => {
    expect(genererSeance(demande(5, ['chevilles'])).etapes.length).toBeGreaterThanOrEqual(2)
    expect(zonesCouvertes(genererSeance(demande(30)).etapes).length).toBeGreaterThanOrEqual(10)
  })

  it('respecte les exclusions', () => {
    const p = genererSeance(demande(10, ['hanches']), ['pigeon', 'flechisseur'])
    expect(p.etapes.some((x) => ['pigeon', 'flechisseur'].includes(x.exercice.id))).toBe(false)
  })
})

describe('remplacerEtape', () => {
  it('remplace par un autre exercice de la même zone, hors de la séance, en gardant à peu près le temps', () => {
    const p = genererSeance(demande(10, ['hanches', 'ischios'], 'apres', 3))
    const i = 0
    const r = remplacerEtape(p, i)
    expect(r.etapes[i].exercice.id).not.toBe(p.etapes[i].exercice.id)
    expect(new Set(r.etapes.map((x) => x.exercice.id)).size).toBe(r.etapes.length)
    expect(r.etapes[i].exercice.zones.some((z) => p.etapes[i].exercice.zones.includes(z))).toBe(true)
    expect(Math.abs(r.dureeTotaleS - p.dureeTotaleS)).toBeLessThanOrEqual(30)
  })

  it('rend la séance telle quelle pour un index inconnu', () => {
    const p = genererSeance(demande(5))
    expect(remplacerEtape(p, 99)).toBe(p)
  })
})
