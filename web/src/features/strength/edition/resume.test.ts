import { describe, expect, it } from 'vitest'
import { nouvelExercice } from '../draft'
import { assemblerDuree, decouperDuree, formatReps, normaliserCharge, resumeExercice } from './resume'

const base = nouvelExercice('e', { id: 'x', name: 'Squat', muscles: [], equipment: [], isBodyweight: false }, null)

describe('formatReps', () => {
  it('répétitions : texte tel quel, tiret long si vide', () => {
    expect(formatReps('8-12', 'REPS')).toBe('8-12')
    expect(formatReps('  ', 'REPS')).toBe('—')
  })

  it('durée : secondes, ou m:ss à partir d’une minute', () => {
    expect(formatReps('45', 'DURATION')).toBe('45s')
    expect(formatReps('60', 'DURATION')).toBe('1:00')
    expect(formatReps('95', 'DURATION')).toBe('1:35')
    expect(formatReps('', 'DURATION')).toBe('—')
    expect(formatReps('abc', 'DURATION')).toBe('abc')
  })
})

describe('resumeExercice (ligne repliée)', () => {
  it('séries × répétitions · charge', () => {
    expect(resumeExercice({ ...base, nombreSeriesPrevues: 3, repsCibles: '10', chargeCible: '20 kg' })).toBe('3 × 10 · 20 kg')
    expect(resumeExercice({ ...base, nombreSeriesPrevues: 4 })).toBe('4 × —')
  })

  it('double progression : la plage remplace les répétitions cibles', () => {
    const e = { ...base, repsCibles: '8', chargeCible: '20 kg', progressionActivee: true, systemeProgression: 'DOUBLE', repsMin: 8, repsMax: 12 }
    expect(resumeExercice(e)).toBe('3 × 8–12 · 20 kg')
    expect(resumeExercice({ ...e, systemeProgression: 'LINEAIRE' })).toBe('3 × 8 · 20 kg')
    expect(resumeExercice({ ...e, progressionActivee: false })).toBe('3 × 8 · 20 kg')
  })

  it('poids de corps : « PDC » à la place de la charge', () => {
    expect(resumeExercice({ ...base, repsCibles: '12', chargeCible: '5 kg', isBodyweight: true })).toBe('3 × 12 · PDC')
  })

  it('durée : format court', () => {
    expect(resumeExercice({ ...base, repsType: 'DURATION', repsCibles: '90' })).toBe('3 × 1:30')
  })
})

describe('durée en minutes et secondes', () => {
  it('découpe un total de secondes', () => {
    expect(decouperDuree('90')).toEqual({ min: '1', sec: '30' })
    expect(decouperDuree('45')).toEqual({ min: '0', sec: '45' })
    expect(decouperDuree('')).toEqual({ min: '', sec: '' })
    expect(decouperDuree('0')).toEqual({ min: '', sec: '' })
    expect(decouperDuree('texte')).toEqual({ min: '', sec: '' })
  })

  it('assemble minutes et secondes en secondes totales (texte)', () => {
    expect(assemblerDuree('1', '30')).toBe('90')
    expect(assemblerDuree('', '45')).toBe('45')
    expect(assemblerDuree('2', '')).toBe('120')
    expect(assemblerDuree('', '')).toBe('')
    expect(assemblerDuree('0', '0')).toBe('')
    // Seules les 2 premières saisies numériques comptent, les secondes peuvent dépasser 59
    expect(assemblerDuree('1', '75')).toBe('135')
    expect(assemblerDuree('a1b', '3x0')).toBe('90')
  })
})

describe('normaliserCharge', () => {
  it('virgule décimale -> point, et unité kg normalisée (lue ainsi par le moteur de progression)', () => {
    expect(normaliserCharge('12,5')).toBe('12.5')
    expect(normaliserCharge('12,5 kg')).toBe('12.5 kg')
    expect(normaliserCharge('20kg')).toBe('20 kg')
    expect(normaliserCharge('20 KG')).toBe('20 kg')
  })

  it('laisse intact le texte libre et les saisies incomplètes', () => {
    expect(normaliserCharge('PDC')).toBe('PDC')
    expect(normaliserCharge('Élastique')).toBe('Élastique')
    expect(normaliserCharge('2')).toBe('2')
    expect(normaliserCharge('20 k')).toBe('20 k')
    expect(normaliserCharge('')).toBe('')
  })
})
