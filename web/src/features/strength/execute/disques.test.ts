import { describe, expect, it } from 'vitest'
import type { EquipmentInventaire } from '../../../core/progression/types'
import {
  calculerDisques, chargeInitialeCalculateur, configurationMateriel, detailDisques, DISQUES_STANDARD, etatCalculateur, nombreSaisi,
  texteDisques, texteKg, type ConfigMateriel,
} from './disques'

const VIDE: EquipmentInventaire = { halteres: { poidsFixes: [], chargeable: null }, barre: null, kettlebell: null, cable: null }

describe('calculerDisques : algorithme glouton (calculatePlatesResult)', () => {
  it('100 kg sur une barre de 20 kg : 40 kg par côté = 2 × 20', () => {
    expect(calculerDisques(100, 20, null, null)).toEqual({ disques: [{ kg: 20, nombre: 2 }], chargeKg: 100, approximatif: false })
  })

  it('62,5 kg sur 20 kg : 21,25 par côté = 20 + 1,25', () => {
    expect(calculerDisques(62.5, 20, null, null)).toEqual({
      disques: [{ kg: 20, nombre: 1 }, { kg: 1.25, nombre: 1 }], chargeKg: 62.5, approximatif: false,
    })
  })

  it('cible égale à la barre : aucun disque', () => {
    expect(calculerDisques(20, 20, null, null)).toEqual({ disques: [], chargeKg: 20, approximatif: false })
  })

  it('cible inférieure à la barre : impossible', () => {
    expect(calculerDisques(15, 20, null, null)).toBeNull()
  })

  it('respecte le stock par côté (la moitié des disques possédés)', () => {
    // 1 disque de 20 par côté seulement, puis 10 : 60 kg => 20 par côté = 20 ; 100 kg => 40 par côté = 20 + 10 + 10 (stock 10 : 2)
    const stock = [{ kg: 20, max: 1 }, { kg: 10, max: 2 }]
    expect(calculerDisques(100, 20, stock, null)?.disques).toEqual([{ kg: 20, nombre: 1 }, { kg: 10, nombre: 2 }])
  })

  it('trie du plus lourd au plus léger même si le stock est fourni dans le désordre', () => {
    const stock = [{ kg: 5, max: 4 }, { kg: 20, max: 4 }]
    expect(calculerDisques(70, 20, stock, null)?.disques).toEqual([{ kg: 20, nombre: 1 }, { kg: 5, nombre: 1 }])
  })

  it('charge inatteignable : propose la charge composable la plus proche, signalée approximative', () => {
    const stock = [{ kg: 20, max: 1 }, { kg: 5, max: 1 }]
    // 90 kg demandés = 35 par côté, stock 25 par côté max : impossible ; charges composables 20, 60, 70, 80 (barre 20 + 2 × (0|5|20|25))
    const r = calculerDisques(90, 20, stock, [20, 30, 60, 70])
    expect(r).toEqual({ disques: [{ kg: 20, nombre: 1 }, { kg: 5, nombre: 1 }], chargeKg: 70, approximatif: true })
  })

  it('ne propose que des charges au moins égales à la barre', () => {
    const stock = [{ kg: 5, max: 1 }]
    const r = calculerDisques(40, 20, stock, [10, 20, 30])
    expect(r?.chargeKg).toBe(30)
  })

  it('aucune alternative : impossible (null)', () => {
    expect(calculerDisques(90, 20, [{ kg: 5, max: 1 }], null)).toBeNull()
    expect(calculerDisques(90, 20, [{ kg: 5, max: 1 }], [])).toBeNull()
  })

  it('la plus proche est la cible elle-même (déjà ratée) : impossible', () => {
    expect(calculerDisques(30, 20, [{ kg: 20, max: 1 }], [30])).toBeNull()
  })

  it('stock standard par défaut, jusqu’aux demi-kilos', () => {
    expect(DISQUES_STANDARD[0]).toBe(20)
    expect(calculerDisques(21, 20, null, null)?.disques).toEqual([{ kg: 0.5, nombre: 1 }])
  })

  it('tolérance de 0,05 kg sur le reste', () => {
    // 0,02 kg par côté : sous la tolérance, rien à poser ; 0,1 kg par côté : trop pour être ignoré
    expect(calculerDisques(20.04, 20, null, null)?.disques).toEqual([])
    expect(calculerDisques(20.2, 20, null, null)).toBeNull()
  })
})

describe('configurationMateriel : « Mon matériel » -> disques disponibles', () => {
  const inv: EquipmentInventaire = {
    ...VIDE,
    barre: { barreKg: 15, disques: { '20': 4, '10': 3, '5': 0 } },
    halteres: { poidsFixes: [], chargeable: { barreKg: 1.5, disques: { '2.5': 4 } } },
  }

  it('barre : poids de la barre, disques par côté (total / 2, arrondi bas, > 0), charges composables', () => {
    const c: ConfigMateriel = configurationMateriel(inv, 'BARRE')
    expect(c.barreKg).toBe(15)
    expect(c.disques).toEqual([{ kg: 20, max: 2 }, { kg: 10, max: 1 }])
    expect(c.charges?.[0]).toBe(15)
    expect(c.charges).toContain(55)
  })

  it('haltère chargeable', () => {
    const c = configurationMateriel(inv, 'HALTERE')
    expect(c.barreKg).toBe(1.5)
    expect(c.disques).toEqual([{ kg: 2.5, max: 2 }])
  })

  it('rien de déclaré : barre 20 kg / haltère 2 kg, disques standard (null), pas de charges', () => {
    expect(configurationMateriel(VIDE, 'BARRE')).toEqual({ barreKg: 20, disques: null, charges: null })
    expect(configurationMateriel(VIDE, 'HALTERE')).toEqual({ barreKg: 2, disques: null, charges: null })
  })
})

describe('chargeInitialeCalculateur', () => {
  it('charge de la prochaine série non validée, sinon charge cible du modèle', () => {
    expect(chargeInitialeCalculateur(62.5, '60 kg')).toBe(62.5)
    expect(chargeInitialeCalculateur(null, '60 kg')).toBe(60)
    expect(chargeInitialeCalculateur(null, 'PDC')).toBeNull()
    expect(chargeInitialeCalculateur(null, '')).toBeNull()
  })
})

describe('textes', () => {
  it('texteKg : entier sans décimale, virgule française', () => {
    expect(texteKg(20)).toBe('20 kg')
    expect(texteKg(1.25)).toBe('1,25 kg')
  })

  it('texteDisques : « 2 × 20 kg + 1 × 5 kg », un seul disque sans multiplicateur', () => {
    expect(texteDisques([{ kg: 20, nombre: 2 }, { kg: 5, nombre: 1 }])).toBe('2 × 20 kg  +  5 kg')
    expect(texteDisques([])).toBe('')
  })
})

describe('nombreSaisi : champ en kg (virgule ou point)', () => {
  it('lit « 62,5 » et « 62.5 », vide ou illisible : null', () => {
    expect(nombreSaisi('62,5')).toBe(62.5)
    expect(nombreSaisi('62.5')).toBe(62.5)
    expect(nombreSaisi('')).toBeNull()
    expect(nombreSaisi(',')).toBeNull()
  })
})

describe('etatCalculateur : ce que la feuille affiche', () => {
  const standard: ConfigMateriel = { barreKg: 20, disques: null, charges: null }

  it('cible vide : invitation à saisir', () => {
    expect(etatCalculateur('', '20', standard)).toEqual({ type: 'invite' })
  })

  it('barre nulle ou illisible : message sur la barre', () => {
    expect(etatCalculateur('100', '', standard)).toEqual({ type: 'barre' })
    expect(etatCalculateur('100', '0', standard)).toEqual({ type: 'barre' })
  })

  it('cible impossible : message', () => {
    expect(etatCalculateur('10', '20', standard)).toEqual({ type: 'impossible' })
  })

  it('résultat exact', () => {
    const e = etatCalculateur('100', '20', standard)
    expect(e).toMatchObject({ type: 'resultat', resultat: { chargeKg: 100, approximatif: false }, barreKg: 20 })
  })

  it('résultat approximatif : conserve la cible demandée pour le message', () => {
    const cfg: ConfigMateriel = { barreKg: 20, disques: [{ kg: 20, max: 1 }, { kg: 5, max: 1 }], charges: [20, 30, 60, 70] }
    expect(etatCalculateur('90', '20', cfg)).toMatchObject({ type: 'resultat', cibleKg: 90, resultat: { chargeKg: 70, approximatif: true } })
  })
})

describe('detailDisques : barre + disques = total', () => {
  it('disques des deux côtés', () => {
    expect(detailDisques({ disques: [{ kg: 20, nombre: 1 }, { kg: 1.25, nombre: 1 }], chargeKg: 62.5, approximatif: false }, 20)).toEqual({
      parCoteKg: 21.25, totalDisquesKg: 42.5, totalKg: 62.5,
    })
  })

  it('sans disque : la barre seule', () => {
    expect(detailDisques({ disques: [], chargeKg: 20, approximatif: false }, 20)).toEqual({ parCoteKg: 0, totalDisquesKg: 0, totalKg: 20 })
  })
})
