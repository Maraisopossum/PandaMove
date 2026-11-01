import { describe, expect, it } from 'vitest'
import { lireEquipementStocke } from '../../../core/import/equipment'
import { PAS_REPOS_SEC, chargeSuivante, valeurSuivante } from './pasSteppers'

const vide = lireEquipementStocke(null)
const avecBarre = lireEquipementStocke({
  barre: { barreKg: 20, disques: { '10': 4, '5': 2, '2.5': 2 } },
  pasParCategorie: {},
})

describe('valeurSuivante (reps, repos)', () => {
  it('avance d’un pas, sans dérive ni passage sous le minimum', () => {
    expect(valeurSuivante(8, 1, 1, 1)).toBe(9)
    expect(valeurSuivante(1, -1, 1, 1)).toBe(1)
    expect(valeurSuivante(30, 1, PAS_REPOS_SEC, 0)).toBe(35)
    expect(valeurSuivante(3, -1, PAS_REPOS_SEC, 0)).toBe(0)
  })
  it('part du minimum quand la valeur est vide', () => {
    expect(valeurSuivante(null, 1, 1, 1)).toBe(2)
    expect(valeurSuivante(Number.NaN, 1, PAS_REPOS_SEC, 0)).toBe(5)
  })
})

describe('chargeSuivante', () => {
  it('sans matériel structuré : pas de 2,5 kg', () => {
    expect(chargeSuivante(20, 1, ['Machine guidée'], vide)).toBe(22.5)
    expect(chargeSuivante(20, -1, [], vide)).toBe(17.5)
  })
  it('jamais sous zéro', () => {
    expect(chargeSuivante(1, -1, [], vide)).toBe(0)
    expect(chargeSuivante(null, -1, [], vide)).toBe(0)
  })
  it('utilise le pas déclaré pour la catégorie de l’exercice', () => {
    const materiel = lireEquipementStocke({ pasParCategorie: { MACHINE: 5 } })
    expect(chargeSuivante(40, 1, ['Machine guidée'], materiel)).toBe(45)
  })
  it('saute à la charge réellement composable suivante / précédente', () => {
    // Barre 20 kg + paires de 2,5 / 5 / 10 : 20, 25, 30, 35, ...
    expect(chargeSuivante(20, 1, ['Barre olympique'], avecBarre)).toBe(25)
    expect(chargeSuivante(25, -1, ['Barre olympique'], avecBarre)).toBe(20)
    // Valeur non composable : on rejoint la plus proche dans le sens demandé
    expect(chargeSuivante(22, 1, ['Barre olympique'], avecBarre)).toBe(25)
    expect(chargeSuivante(22, -1, ['Barre olympique'], avecBarre)).toBe(20)
  })
  it('au-delà des extrêmes composables, retombe sur le pas simple', () => {
    expect(chargeSuivante(20, -1, ['Barre olympique'], avecBarre)).toBe(17.5)
  })
})
