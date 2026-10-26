import { describe, expect, it } from 'vitest'
import fixtures from './__fixtures__/inventory.json'
import {
  chargeNonComposableHint,
  chargesAtteignables,
  chargesAtteignablesPour,
  chargesAtteignablesPourEquipement,
} from './inventory'
import type { DisquesConfig, EquipmentCategory, EquipmentInventaire, HalteresConfig, PlageConfig } from './types'

interface Cas {
  nom: string
  origine: 'test-kotlin' | 'source'
  fonction: 'disques' | 'plage' | 'halteres' | 'pourCategorie' | 'pourEquipement' | 'hint'
  entree: unknown
  attendu: unknown
}

function executer(cas: Cas): unknown {
  switch (cas.fonction) {
    case 'disques':
      return chargesAtteignables(cas.entree as DisquesConfig)
    case 'plage':
      return chargesAtteignables(cas.entree as PlageConfig)
    case 'halteres':
      return chargesAtteignables(cas.entree as HalteresConfig)
    case 'pourCategorie': {
      const e = cas.entree as { inventaire: EquipmentInventaire; categorie: EquipmentCategory }
      return chargesAtteignablesPour(e.inventaire, e.categorie)
    }
    case 'pourEquipement': {
      const e = cas.entree as { inventaire: EquipmentInventaire; equipement: string[] }
      return chargesAtteignablesPourEquipement(e.inventaire, e.equipement)
    }
    case 'hint': {
      const e = cas.entree as { charges: number[]; chargeKg: number; epsilon?: number }
      return chargeNonComposableHint(e.charges, e.chargeKg, e.epsilon)
    }
  }
}

describe('EquipmentInventory (fixtures partagées avec Kotlin)', () => {
  it('reprend les 8 tests Kotlin (le test de dispatch compte 5 assertions, donc 12 cas)', () => {
    const kotlin = (fixtures.cas as Cas[]).filter((c) => c.origine === 'test-kotlin')
    expect(kotlin).toHaveLength(12)
  })

  it.each(fixtures.cas as Cas[])('$origine : $nom', (cas) => {
    expect(executer(cas)).toEqual(cas.attendu)
  })
})
