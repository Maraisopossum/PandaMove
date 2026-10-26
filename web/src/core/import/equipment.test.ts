import { describe, expect, it } from 'vitest'
import { mergeEquipment, type EquipmentPatch } from './equipment'

const BARRE = { barreKg: 20, disques: { '20': 2, '10': 4 } }
const CABLE = { minKg: 2.5, maxKg: 50, pasKg: 2.5 }
const KB = { minKg: 8, maxKg: 24, pasKg: 4 }

const existant = {
  halteres: { poidsFixes: [10], chargeable: null },
  barre: BARRE,
  kettlebell: KB,
  cable: CABLE,
  selectedCategories: ['HALTERES', 'BARRE', 'KETTLEBELL', 'CABLE', 'MACHINE'],
  pasParCategorie: { MACHINE: 5, CABLE: 2.5 },
}

const patchMinimal: EquipmentPatch = {
  selectedCategories: ['HALTERES'],
  pasParCategorie: { MACHINE: 2 },
  halteres: { poidsFixes: [], chargeable: null },
}

describe('mergeEquipment (règles DataImportManager Android)', () => {
  it('garde barre / kettlebell / câble existants quand le patch ne les fournit pas', () => {
    const r = mergeEquipment(existant, patchMinimal)
    expect(r.barre).toEqual(BARRE)
    expect(r.kettlebell).toEqual(KB)
    expect(r.cable).toEqual(CABLE)
  })

  it('remplace barre / kettlebell / câble présents dans le patch', () => {
    const autreBarre = { barreKg: 15, disques: { '5': 4 } }
    const r = mergeEquipment(existant, { ...patchMinimal, barre: autreBarre, cable: { minKg: 1, maxKg: 10, pasKg: 1 } })
    expect(r.barre).toEqual(autreBarre)
    expect(r.cable).toEqual({ minKg: 1, maxKg: 10, pasKg: 1 })
    expect(r.kettlebell).toEqual(KB)
  })

  it('écrase selectedCategories, fusionne pasParCategorie clé par clé et remplace les haltères', () => {
    const r = mergeEquipment(existant, patchMinimal)
    expect(r.selectedCategories).toEqual(['HALTERES'])
    expect(r.pasParCategorie).toEqual({ MACHINE: 2, CABLE: 2.5 })
    expect(r.halteres).toEqual({ poidsFixes: [], chargeable: null })
  })

  it('part d\'un inventaire vide quand l\'existant est absent ou malformé', () => {
    const vide = {
      halteres: { poidsFixes: [], chargeable: null },
      barre: null,
      kettlebell: null,
      cable: null,
      selectedCategories: ['HALTERES'],
      pasParCategorie: { MACHINE: 2 },
    }
    expect(mergeEquipment(null, patchMinimal)).toEqual(vide)
    expect(mergeEquipment(undefined, patchMinimal)).toEqual(vide)
    expect(mergeEquipment('{pas du json', patchMinimal)).toEqual(vide)
    expect(mergeEquipment('{}', patchMinimal)).toEqual(vide)
    expect(mergeEquipment(42, patchMinimal)).toEqual(vide)
    expect(mergeEquipment({ barre: 'n/a', cable: { minKg: 'x' }, pasParCategorie: [1] }, patchMinimal)).toEqual(vide)
  })

  it('accepte l\'existant sous forme de chaîne JSON (colonne equipment_json)', () => {
    const r = mergeEquipment(JSON.stringify(existant), patchMinimal)
    expect(r.barre).toEqual(BARRE)
    expect(r.pasParCategorie).toEqual({ MACHINE: 2, CABLE: 2.5 })
  })
})
