import { describe, expect, it } from 'vitest'
import { ancienneteRecord, courbeEvolution, recordsEnAvant, valeurAutre } from './presentationRecords'
import type { RecordsSport } from './recordsSorties'
import { DISTANCES, EFFORTS } from './recordsSorties'

describe('courbeEvolution', () => {
  it('moins de deux points : pas de courbe', () => {
    expect(courbeEvolution([])).toBeNull()
    expect(courbeEvolution([{ mois: '2026-11', dureeS: 1478 }])).toBeNull()
  })

  it('le plus rapide en bas, graduations rondes qui encadrent les valeurs, une date par point', () => {
    const c = courbeEvolution([
      { mois: '2026-08', dureeS: 1554 },
      { mois: '2026-09', dureeS: 1535 },
      { mois: '2026-10', dureeS: 1508 },
      { mois: '2026-11', dureeS: 1478 },
    ])!
    // Le temps le plus long est le plus haut (y petit), le plus court le plus bas
    expect(c.points[0].y).toBeLessThan(c.points[3].y)
    expect(c.graduationsX.map((t) => t.libelle)).toEqual(['août', 'sept.', 'oct.', 'nov.'])
    expect(c.graduationsY.length).toBeGreaterThanOrEqual(2)
    expect(c.graduationsY[0].libelle).toBe('24:30') // 1 478 s = 24:38 -> graduation 24:30
    expect(c.graduationsY.at(-1)!.libelle).toBe('26:00')
    expect(c.polyligne.split(' ')).toHaveLength(4)
    expect(c.points.every((p) => p.y >= c.zone.haut && p.y <= c.zone.bas)).toBe(true)
  })

  it('deux valeurs identiques : l’échelle garde de l’épaisseur (pas de division par zéro)', () => {
    const c = courbeEvolution([{ mois: '2026-09', dureeS: 1500 }, { mois: '2026-10', dureeS: 1500 }])!
    expect(c.points.every((p) => Number.isFinite(p.y))).toBe(true)
    expect(c.graduationsY.length).toBeGreaterThanOrEqual(2)
  })
})

describe('ancienneteRecord', () => {
  it('« Nouveau » jusqu’à 14 jours, ensuite « il y a N j »', () => {
    expect(ancienneteRecord('2026-11-12', '2026-11-12')).toEqual({ texte: 'Nouveau', recent: true })
    expect(ancienneteRecord('2026-10-29', '2026-11-12')).toEqual({ texte: 'Nouveau', recent: true })
    expect(ancienneteRecord('2026-10-28', '2026-11-12')).toEqual({ texte: 'il y a 15 j', recent: false })
  })
})

describe('records en avant', () => {
  const vide = (): RecordsSport => ({
    distances: DISTANCES.map((definition) => ({ definition, record: null })),
    efforts: EFFORTS.map((definition) => ({ definition, record: null })),
    evolution5k: [],
    autres: [],
  })

  it('course : 5 km, 10 km et semi quand ils existent', () => {
    const r = vide()
    r.distances = r.distances.map((d) =>
      ['1k', '5k', '10k'].includes(d.definition.id)
        ? { ...d, record: { id: d.definition.id, libelle: d.definition.libelle, dureeS: d.definition.id === '5k' ? 1478 : 3130, date: '2026-11-04', sortieId: 's', allure: 300 } }
        : d,
    )
    expect(recordsEnAvant('course', r).map((l) => [l.libelle, l.valeur])).toEqual([['5 km', '24:38'], ['10 km', '52:10']])
  })

  it('vélo : efforts de 5, 20 et 60 minutes en watts', () => {
    const r = vide()
    r.efforts = r.efforts.map((e) => ({ ...e, record: { id: e.definition.id, libelle: e.definition.libelle, watts: 250, date: '2026-11-04', sortieId: 's' } }))
    expect(recordsEnAvant('velo', r).map((l) => l.libelle)).toEqual(['5 min', '20 min', '60 min'])
    expect(recordsEnAvant('velo', r)[0].valeur).toBe('250 W')
  })

  it('sans analyse détaillée : records de base (plus longue, durée, dénivelé), pas la meilleure semaine', () => {
    const r = vide()
    r.autres = [
      { id: 'plus-longue', nom: 'Sortie la plus longue', valeur: 21_300, date: '2026-10-04' },
      { id: 'plus-longue-duree', nom: 'Plus longue durée', valeur: 7080, date: '2026-10-04' },
      { id: 'meilleure-semaine', nom: 'Meilleure semaine', valeur: 41_200, date: '2026-10-19' },
      { id: 'denivele', nom: 'Meilleur dénivelé', valeur: 312, date: '2026-09-27' },
    ]
    expect(recordsEnAvant('course', r).map((l) => [l.libelle, l.valeur])).toEqual([
      ['Sortie la plus longue', '21,3 km'], ['Plus longue durée', '1:58:00'], ['Meilleur dénivelé', '312 m'],
    ])
    expect(recordsEnAvant('course', vide())).toEqual([])
    expect(valeurAutre(r.autres[2])).toBe('41,2 km')
  })
})
