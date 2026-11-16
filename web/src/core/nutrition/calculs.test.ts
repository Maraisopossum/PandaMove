import { describe, expect, it } from 'vitest'
import { BASE_ALIMENTS, chercherDansBase, normaliserTexte } from './baseAliments'
import {
  apportPourQuantite, ecartEnergie, kcalDesMacros, metabolismeDeBase, mettreALEchelle, proposerObjectifs, repartitionEnergie, repasParDefaut, resumerBilan, sommer, verifierProfil,
  type ProfilNutrition,
} from './calculs'

const riz = { kcal: 130, proteines: 2.7, glucides: 28, lipides: 0.3, fibres: 0.4 }

describe('apports', () => {
  it('calcule l’apport d’une quantité (énergie à l’unité, macros au dixième)', () => {
    expect(apportPourQuantite(riz, 150)).toEqual({ kcal: 195, proteines: 4.1, glucides: 42, lipides: 0.5, fibres: 0.6 })
    expect(apportPourQuantite(riz, 0)).toEqual({ kcal: 0, proteines: 0, glucides: 0, lipides: 0, fibres: 0 })
    expect(apportPourQuantite({ ...riz, fibres: null }, 100).fibres).toBe(0)
  })

  it('additionne sans dérive d’arrondi', () => {
    const t = sommer([apportPourQuantite(riz, 150), apportPourQuantite(riz, 150), { kcal: 0.4, proteines: 0.1, glucides: 0.2, lipides: 0.3, fibres: 0 }])
    expect(t.kcal).toBe(390)
    expect(t.proteines).toBe(8.3)
    expect(sommer([])).toEqual({ kcal: 0, proteines: 0, glucides: 0, lipides: 0, fibres: 0 })
  })

  it('remet une entrée à l’échelle en gardant les proportions', () => {
    const a = apportPourQuantite(riz, 100)
    expect(mettreALEchelle(a, 100, 250)).toEqual({ kcal: 325, proteines: 6.8, glucides: 70, lipides: 0.8, fibres: 1 })
    expect(mettreALEchelle(a, 0, 50)).toEqual(a)
    expect(mettreALEchelle(a, 100, -5).kcal).toBe(0)
  })

  it('repère une énergie incohérente avec les macros (4-4-9)', () => {
    expect(kcalDesMacros(10, 20, 5)).toBe(165)
    expect(ecartEnergie(165, 10, 20, 5)).toBe(0)
    expect(ecartEnergie(300, 10, 20, 5)).toBeCloseTo(0.45)
    expect(ecartEnergie(0, 10, 20, 5)).toBeNull()
  })

  it('propose le repas selon l’heure', () => {
    expect([7, 12, 16, 21].map(repasParDefaut)).toEqual(['petit_dejeuner', 'dejeuner', 'collation', 'diner'])
  })

  it('donne la part de l’énergie de chaque macro', () => {
    expect(repartitionEnergie({ kcal: 0, proteines: 0, glucides: 0, lipides: 0, fibres: 0 })).toBeNull()
    const r = repartitionEnergie({ kcal: 2000, proteines: 150, glucides: 200, lipides: 67, fibres: 0 })!
    expect(r.proteines + r.glucides + r.lipides).toBe(100)
    expect(r.proteines).toBe(30)
  })
})

describe('objectifs proposés', () => {
  const homme: ProfilNutrition = { sexe: 'homme', age: 35, tailleCm: 180, poidsKg: 80, activite: 'moderee', but: 'maintien' }

  it('métabolisme de base (Mifflin-St Jeor)', () => {
    expect(metabolismeDeBase(homme)).toBe(1755)
    expect(metabolismeDeBase({ ...homme, sexe: 'femme', poidsKg: 60, tailleCm: 165 })).toBe(1295)
  })

  it('maintien : énergie = dépense, macros cohérentes avec l’énergie', () => {
    const o = proposerObjectifs(homme)
    expect(o.kcal).toBe(2720)
    expect(o.proteinesG).toBe(128)
    expect(Math.abs(4 * o.proteinesG + 4 * o.glucidesG + 9 * o.lipidesG - o.kcal)).toBeLessThan(15)
    expect(o.eauMl).toBe(2800)
  })

  it('perte : énergie réduite et protéines plus hautes ; prise : énergie augmentée', () => {
    const perte = proposerObjectifs({ ...homme, but: 'perte' })
    const prise = proposerObjectifs({ ...homme, but: 'prise' })
    expect(perte.kcal).toBeLessThan(2720)
    expect(prise.kcal).toBeGreaterThan(2720)
    expect(perte.proteinesG).toBe(160)
    expect(prise.proteinesG).toBe(144)
  })

  it('ne descend jamais sous 1 200 kcal et garde des glucides positifs', () => {
    const petite = proposerObjectifs({ sexe: 'femme', age: 80, tailleCm: 150, poidsKg: 40, activite: 'sedentaire', but: 'perte' })
    expect(petite.kcal).toBeGreaterThanOrEqual(1200)
    expect(petite.glucidesG).toBeGreaterThanOrEqual(0)
  })

  it('valide le profil', () => {
    expect(verifierProfil(homme)).toBeNull()
    expect(verifierProfil({ ...homme, age: 10 })).toMatch(/âge/)
    expect(verifierProfil({ ...homme, tailleCm: 300 })).toMatch(/taille/)
    expect(verifierProfil({ ...homme, poidsKg: Number.NaN })).toMatch(/poids/)
  })
})

describe('bilan', () => {
  const jour = (date: string, kcal: number) => ({ date, apport: { kcal, proteines: kcal / 20, glucides: kcal / 10, lipides: kcal / 30, fibres: 10 } })

  it('moyenne sur les jours saisis seulement, et compte les jours dans la cible (±10 %)', () => {
    const r = resumerBilan([jour('2026-11-01', 2000), jour('2026-11-02', 2200), jour('2026-11-03', 0), jour('2026-11-04', 1500)], 2000)
    expect(r.joursSaisis).toBe(3)
    expect(r.moyenne.kcal).toBe(1900)
    expect(r.joursDansLaCible).toBe(2)
  })

  it('sans saisie : moyenne nulle, sans objectif : aucun jour dans la cible', () => {
    expect(resumerBilan([], 2000)).toMatchObject({ joursSaisis: 0, moyenne: { kcal: 0 }, joursDansLaCible: 0 })
    expect(resumerBilan([jour('2026-11-01', 2000)], null).joursDansLaCible).toBe(0)
  })
})

describe('base d’aliments', () => {
  it('a des identifiants uniques et des valeurs plausibles (énergie proche des macros)', () => {
    expect(new Set(BASE_ALIMENTS.map((a) => a.id)).size).toBe(BASE_ALIMENTS.length)
    for (const a of BASE_ALIMENTS) {
      expect(a.portionG, a.nom).toBeGreaterThan(0)
      if (['base-vin', 'base-biere'].includes(a.id)) continue // l'alcool apporte 7 kcal/g hors macros
      const attendue = kcalDesMacros(a.proteines, a.glucides, a.lipides)
      // Tolérance large : alcool, fibres, polyols et arrondis des tables
      expect(Math.abs(attendue - a.kcal), a.nom).toBeLessThanOrEqual(Math.max(40, a.kcal * 0.3))
    }
  })

  it('cherche sans tenir compte des accents ni de la casse, début de nom d’abord', () => {
    expect(normaliserTexte('Œuf Entier')).toBe('oeuf entier')
    expect(chercherDansBase('oeuf').map((a) => a.nom)).toContain('Œuf entier')
    expect(chercherDansBase('RIZ')[0].nom.toLowerCase()).toContain('riz')
    expect(chercherDansBase('poulet cuit')[0].nom).toBe('Blanc de poulet cuit')
    expect(chercherDansBase('  ')).toEqual([])
    expect(chercherDansBase('zzzzz')).toEqual([])
  })
})
