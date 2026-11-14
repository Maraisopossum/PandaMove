import { describe, expect, it } from 'vitest'
import { duree, ecart, fenetresBilan, indicateursBilan } from './bilanSemaine'
import { calculerFormeJour } from './donneesAccueil'
import type { Sortie } from '../../core/db/repos/sorties'

describe('fenetresBilan', () => {
  it('compare le lundi → aujourd’hui au même point de la semaine précédente', () => {
    expect(fenetresBilan('2026-11-05')).toEqual({
      courante: { debut: '2026-11-02', fin: '2026-11-05' },
      precedente: { debut: '2026-10-26', fin: '2026-10-29' },
    })
  })
  it('un lundi : un seul jour de chaque côté', () => {
    expect(fenetresBilan('2026-11-02')).toEqual({
      courante: { debut: '2026-11-02', fin: '2026-11-02' },
      precedente: { debut: '2026-10-26', fin: '2026-10-26' },
    })
  })
})

describe('duree', () => {
  it.each([
    [0, '0 min'],
    [2100, '35 min'],
    [3600, '1 h'],
    [19200, '5 h 20'],
    [3660 + 1800, '1 h 31'],
  ])('%i s -> %s', (s, texte) => expect(duree(s)).toBe(texte))
})

describe('ecart', () => {
  const km = (m: number) => `${m / 1000} km`
  it('hausse, baisse et égalité', () => {
    expect(ecart(10, 4, String)).toEqual({ texte: '+6', sens: 'hausse' })
    expect(ecart(3, 5, String)).toEqual({ texte: '−2', sens: 'baisse' })
    expect(ecart(7, 7, String)).toEqual({ texte: 'Identique', sens: 'stable' })
    expect(ecart(12000, 5800, km)).toEqual({ texte: '+6.2 km', sens: 'hausse' })
  })
})

describe('indicateursBilan', () => {
  const vide = { terminees: 0, dureeS: 0, distanceM: 0, tonnageKg: 0 }
  it('séances terminées sur prévues, durée, distance et tonnage avec leurs écarts', () => {
    const k = indicateursBilan({ terminees: 3, dureeS: 19200, distanceM: 38400, tonnageKg: 6200 }, { terminees: 2, dureeS: 21300, distanceM: 32200, tonnageKg: 5800 }, 5)
    expect(k.map((i) => [i.valeur, i.ecart.texte, i.ecart.sens])).toEqual([
      ['3 sur 5', '+1', 'hausse'],
      ['5 h 20', '−35 min', 'baisse'],
      ['38,4 km', '+6,2 km', 'hausse'],
      ['6,2 t', '+400 kg', 'hausse'],
    ])
  })
  it('semaine entièrement faite : le total n’est pas répété ; au singulier pour une séance', () => {
    const [seances] = indicateursBilan({ ...vide, terminees: 1 }, vide, 1)
    expect([seances.valeur, seances.libelle]).toEqual(['1', 'séance terminée'])
  })
})

describe('calculerFormeJour', () => {
  const sortie = (date: string, dureeS: number): Sortie => ({
    id: date, sport: 'course', date, debutAt: null, titre: 'Footing', dureeS, dureeDeplacementS: null, distanceM: 10000,
    denivelePosM: null, deniveleNegM: null, fcMoy: null, fcMax: null, rpe: 6, puissanceMoyW: null, puissanceMaxW: null,
    puissanceNormW: null, cadenceMoy: null, enSalle: false, notes: null, lien: null, source: 'manuel', empreinte: null,
    seanceId: null, tours: null, serie: null, trace: null,
  } as Sortie)

  it('sans sortie : pas de carte', () => {
    expect(calculerFormeJour([], {}, '2026-11-05')).toBeNull()
  })
  it('avec des sorties : fraîcheur, charges, état et courbe', () => {
    const f = calculerFormeJour([sortie('2026-11-04', 3600), sortie('2026-10-20', 3600)], {}, '2026-11-05')
    expect(f).not.toBeNull()
    expect(f!.serie).toHaveLength(17) // de la première sortie (20 oct.) à aujourd'hui ; au plus 42 jours
    expect(f!.etat.libelle.length).toBeGreaterThan(0)
    expect(Number.isInteger(f!.fraicheur) && Number.isInteger(f!.forme) && Number.isInteger(f!.fatigue)).toBe(true)
    expect(f!.fatigue).toBeGreaterThan(0)
  })
})
