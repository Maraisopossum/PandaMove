import { describe, expect, it } from 'vitest'
import {
  arrondirSaisie, depuisBase, ecrireMesures, equivalence, identifiantMesure, libelleQuantite, lireMesures, mesureDeBase, mesureDepuisPortion,
  mesureParDefaut, mesuresDisponibles, nombreDUnites, pasDe, raccourcis, trouverMesure, verifierMesures, versBase, type Mesure,
} from './mesures'

const OEUF: Mesure = { id: 'oeuf', libelle: 'œuf', pluriel: 'œufs', base: 60 }
const ASSIETTE: Mesure = { id: 'assiette', libelle: 'assiette', pluriel: 'assiettes', base: 150 }
const VERRE_PROPRE: Mesure = { id: 'verre', libelle: 'verre', pluriel: 'verres', base: 250 }

describe('mesures disponibles', () => {
  it('les mesures de l’aliment d’abord, puis l’unité de base', () => {
    expect(mesuresDisponibles({ uniteBase: 'g', mesures: [OEUF] }).map((m) => m.id)).toEqual(['oeuf', 'g'])
    expect(mesureParDefaut({ uniteBase: 'g', mesures: [OEUF] })).toBe(OEUF)
    expect(mesureParDefaut({ uniteBase: 'g', mesures: [] }).id).toBe('g')
  })

  it('un liquide reçoit les mesures communes, sans doublon avec les siennes', () => {
    const ids = mesuresDisponibles({ uniteBase: 'ml', mesures: [VERRE_PROPRE] }).map((m) => m.id)
    expect(ids[0]).toBe('verre')
    expect(ids.filter((i) => i === 'verre')).toHaveLength(1)
    expect(ids).toEqual(expect.arrayContaining(['bol', 'tasse', 'canette', 'c-a-soupe', 'c-a-cafe', 'ml']))
    expect(ids.at(-1)).toBe('ml')
    // Le verre gardé est celui de l'aliment (250 ml), pas le verre commun (200 ml)
    expect(trouverMesure({ uniteBase: 'ml', mesures: [VERRE_PROPRE] }, 'verre')?.base).toBe(250)
  })

  it('jamais de mesure de liquide pour un aliment en grammes, ni de grammes pour un liquide', () => {
    expect(mesuresDisponibles({ uniteBase: 'g', mesures: [] }).map((m) => m.id)).toEqual(['g'])
    expect(mesuresDisponibles({ uniteBase: 'ml', mesures: [] }).map((m) => m.id)).not.toContain('g')
  })

  it('une mesure introuvable (supprimée, entrée ancienne) donne null', () => {
    expect(trouverMesure({ uniteBase: 'g', mesures: [OEUF] }, 'tranche')).toBeNull()
    expect(trouverMesure({ uniteBase: 'g', mesures: [OEUF] }, null)).toBeNull()
    expect(trouverMesure({ uniteBase: 'g', mesures: [OEUF] }, 'g')?.base).toBe(1)
  })
})

describe('calculs et réglage', () => {
  it('conversion vers la base et retour', () => {
    expect(versBase(2, OEUF)).toBe(120)
    expect(depuisBase(120, OEUF)).toBe(2)
    expect(versBase(180, mesureDeBase('g'))).toBe(180)
  })

  it('pas : demi-unité, 10 g, 50 ml', () => {
    expect(pasDe(OEUF)).toBe(0.5)
    expect(pasDe(mesureDeBase('g'))).toBe(10)
    expect(pasDe(mesureDeBase('ml'))).toBe(50)
  })

  it('arrondi de la saisie', () => {
    expect(arrondirSaisie(1.3, OEUF)).toBe(1.25)
    expect(arrondirSaisie(182.6, mesureDeBase('g'))).toBe(183)
    expect(arrondirSaisie(247, mesureDeBase('ml'))).toBe(245)
    expect(arrondirSaisie(-2, OEUF)).toBe(0)
    expect(arrondirSaisie(Number.NaN, OEUF)).toBe(0)
  })

  it('raccourcis selon la mesure', () => {
    expect(raccourcis(OEUF)).toEqual([1, 2, 3, 4])
    expect(raccourcis(ASSIETTE)).toEqual([0.5, 1, 1.5, 2])
    expect(raccourcis(mesureDeBase('g'), 180)).toEqual([90, 180, 270, 360])
    expect(raccourcis(mesureDeBase('g'))).toEqual([50, 100, 150, 200])
    expect(raccourcis(mesureDeBase('ml'))).toEqual([200, 250, 330, 500])
  })
})

describe('affichage', () => {
  it('nombre d’unités avec fractions', () => {
    expect(nombreDUnites(1)).toBe('1')
    expect(nombreDUnites(0.5)).toBe('½')
    expect(nombreDUnites(1.5)).toBe('1 ½')
    expect(nombreDUnites(0.75)).toBe('¾')
    expect(nombreDUnites(1.3)).toBe('1,3')
  })

  it('libellé avec singulier, pluriel et unités de base', () => {
    expect(libelleQuantite(1, OEUF)).toBe('1 œuf')
    expect(libelleQuantite(2, OEUF)).toBe('2 œufs')
    expect(libelleQuantite(0.5, OEUF)).toBe('½ œuf')
    expect(libelleQuantite(180, mesureDeBase('g'))).toBe('180 g')
    expect(libelleQuantite(250, mesureDeBase('ml'))).toBe('250 ml')
    expect(libelleQuantite(1500, mesureDeBase('ml'))).toBe('1,5 L')
  })

  it('équivalence sous le nombre', () => {
    expect(equivalence(2, OEUF, 'g')).toBe('= 120 g')
    expect(equivalence(1, VERRE_PROPRE, 'ml')).toBe('= 250 ml')
    expect(equivalence(180, mesureDeBase('g'), 'g')).toBeNull()
  })
})

describe('lecture, écriture et vérification', () => {
  it('aller-retour JSON', () => {
    const avecDetail: Mesure = { id: 'biscuit', libelle: 'biscuit', pluriel: 'biscuits', base: 12.5, detail: '1 biscuit (12,5 g)' }
    expect(lireMesures(ecrireMesures([OEUF, avecDetail]))).toEqual([OEUF, avecDetail])
    expect(ecrireMesures([])).toBeNull()
  })

  it('lecture tolérante : valeurs abîmées ignorées, jamais d’erreur', () => {
    expect(lireMesures(null)).toEqual([])
    expect(lireMesures('pas du json')).toEqual([])
    expect(lireMesures('{"id":"x"}')).toEqual([])
    expect(lireMesures('[{"libelle":"tranche","base":30},{"libelle":"","base":3},{"libelle":"x","base":-1},{"id":"g","libelle":"g","base":1},{"libelle":"tranche","base":40}]'))
      .toEqual([{ id: 'tranche', libelle: 'tranche', pluriel: 'tranche', base: 30 }])
  })

  it('format écrit par la migration 0022 (espaces de Postgres compris)', () => {
    expect(lireMesures('[{"id" : "portion", "libelle" : "portion", "pluriel" : "portions", "base" : 125, "detail" : "1 pot"}]'))
      .toEqual([{ id: 'portion', libelle: 'portion', pluriel: 'portions', base: 125, detail: '1 pot' }])
  })

  it('vérification des bornes et des doublons', () => {
    expect(verifierMesures([OEUF, ASSIETTE])).toBeNull()
    expect(verifierMesures([{ ...OEUF, base: 0 }])).toMatch(/entre 0 et 5000/)
    expect(verifierMesures([OEUF, { ...OEUF }])).toMatch(/même nom/)
    expect(verifierMesures([{ ...OEUF, libelle: '' }])).toMatch(/nom/)
    expect(verifierMesures([{ ...OEUF, id: 'g' }])).toMatch(/même nom/)
    expect(verifierMesures(Array.from({ length: 13 }, (_, i) => ({ ...OEUF, id: `m${i}` })))).toMatch(/12 mesures/)
  })

  it('identifiant tiré du libellé', () => {
    expect(identifiantMesure('Œuf')).toBe('oeuf')
    expect(identifiantMesure('c. à soupe')).toBe('c-a-soupe')
    expect(identifiantMesure('!!!')).toBe('mesure')
  })

  it('reprise d’une ancienne portion', () => {
    expect(mesureDepuisPortion(125, '1 pot')).toEqual({ id: 'portion', libelle: 'portion', pluriel: 'portions', base: 125, detail: '1 pot' })
    expect(mesureDepuisPortion(80, null)).toEqual({ id: 'portion', libelle: 'portion', pluriel: 'portions', base: 80 })
    expect(mesureDepuisPortion(100, null)).toBeNull()
    expect(mesureDepuisPortion(null, 'x')).toBeNull()
  })
})
