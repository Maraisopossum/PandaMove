import { describe, expect, it } from 'vitest'
import { MUSCLE_GROUPS, type MuscleGroup } from '../db/types'
import { LIBELLES_GROUPE, muscleToGroup } from './muscleToGroup'

// Valeurs réelles de muscle_groups dans MuscuCatalog.kt (Android), plus des variantes à parenthèses
const CATALOGUE: [string, MuscleGroup][] = [
  ['Pectoraux', 'PECTORAUX'],
  ['Pectoraux (chef claviculaire)', 'PECTORAUX'],
  ['Pectoraux (chef sternal)', 'PECTORAUX'],
  ['Triceps', 'TRICEPS'],
  ['Triceps (longue portion)', 'TRICEPS'],
  ['Trapèze', 'TRAPEZES'],
  ['Trapèze supérieur', 'TRAPEZES'],
  ['Rhomboïdes', 'TRAPEZES'],
  ['Érecteurs du rachis', 'LOMBAIRES'],
  ['Grand dorsal', 'DOS'],
  ['Infra-épineux', 'DOS'],
  ['Deltoïde postérieur', 'DOS'],
  ['Deltoïde antérieur', 'EPAULES'],
  ['Deltoïde médial', 'EPAULES'],
  ['Deltoïdes', 'EPAULES'],
  ['Épaules', 'EPAULES'],
  ['Biceps', 'BICEPS'],
  ['Biceps brachial', 'BICEPS'],
  ['Brachial', 'BICEPS'],
  ['Quadriceps', 'QUADRICEPS'],
  ['Ischio-jambiers', 'ISCHIO'],
  ['Adducteurs', 'ADDUCTEURS'],
  ['Fessiers', 'FESSIERS'],
  ['Fessiers (moyen)', 'FESSIERS'],
  ['Gastrocnémien', 'MOLLETS'],
  ['Soléaire', 'MOLLETS'],
  ['Tibial antérieur', 'MOLLETS'],
  ['Obliques', 'OBLIQUES'],
  ['Droit abdominal', 'ABDOMINAUX'],
  ['Transverse', 'ABDOMINAUX'],
  ['Iliopsoas', 'ABDOMINAUX'],
  ['Fléchisseurs du carpe', 'AVANT_BRAS'],
  ['Extenseurs du carpe', 'AVANT_BRAS'],
  ['Brachioradial', 'AVANT_BRAS'],
  ['Avant-bras (grip)', 'AVANT_BRAS'],
  ['Serratus', 'AUTRE'],
]

describe('muscleToGroup', () => {
  it.each(CATALOGUE)('« %s » -> %s (règles de MuscleGroup.kt)', (texte, attendu) => {
    expect(muscleToGroup(texte)).toBe(attendu)
  })

  it('reconnaît le code exact de chacun des 16 groupes (exercices créés sur le web)', () => {
    for (const g of MUSCLE_GROUPS) expect(muscleToGroup(g)).toBe(g)
  })

  it('reconnaît chaque libellé Android sans tenir compte de la casse (exercices personnalisés)', () => {
    for (const g of MUSCLE_GROUPS) {
      expect(muscleToGroup(LIBELLES_GROUPE[g])).toBe(g)
      expect(muscleToGroup(LIBELLES_GROUPE[g].toUpperCase())).toBe(g)
      expect(muscleToGroup(` ${LIBELLES_GROUPE[g].toLowerCase()} `)).toBe(g)
    }
  })

  it('texte vide ou inconnu -> AUTRE', () => {
    expect(muscleToGroup('')).toBe('AUTRE')
    expect(muscleToGroup('   ')).toBe('AUTRE')
    expect(muscleToGroup('Cardio')).toBe('AUTRE')
  })
})
