import { describe, expect, it } from 'vitest'
import {
  mapBloc, mapExerciceSeance, mapExercise, mapInstance, mapObjectif, mapSeance, mapSerie, type Ligne,
} from './mappers'

// Ligne où toutes les colonnes sont NULL (PowerSync les rend toutes nullables).
const vide: Ligne = { id: 'x' }

describe('mappers : ligne entièrement NULL', () => {
  it('mapSeance applique les défauts Android', () => {
    expect(mapSeance(vide)).toEqual({
      id: 'x', nom: '', groupesMusculaires: '', dureeEstimeeMin: 60, notes: '',
      seanceCategory: 'STRENGTH', createdAt: '', isArchived: false, updatedAt: '',
    })
  })

  it('mapBloc applique les défauts et laisse les champs nullables à null', () => {
    expect(mapBloc(vide)).toEqual({
      id: 'x', seanceId: '', nom: '', type: 'ECHAUFFEMENT', position: 0, dureeMin: null, description: '',
      tempsReposInterSec: 20, tempsReposFinRoundSec: 120, instanceSeanceId: null, blocSourceId: null,
      updatedAt: '',
    })
  })

  it('mapExerciceSeance applique les défauts du moteur de progression', () => {
    const e = mapExerciceSeance(vide)
    expect(e).toMatchObject({
      repsType: 'REPS', incrementDureeSec: 5, seuilDeload: 3, tempsReposSec: 90, nombreSeriesPrevues: 3,
      position: 0, repsCibles: '', isBilateral: false, progressionActivee: false, isBodyweight: false,
    })
    expect(e).toMatchObject({
      repsMin: null, repsMax: null, incrementKg: null, incrementPct: null, typeExercice: null,
      systemeProgression: null, blocId: null, supersetGroupe: null,
    })
  })

  it('mapInstance applique les défauts', () => {
    expect(mapInstance(vide)).toEqual({
      id: 'x', seanceId: '', date: '', notes: '', isCompleted: false, completedAt: null,
      durationSeconds: 0, createdAt: '', updatedAt: '', startedAt: null, pausedJson: null, progression: null,
    })
  })

  it('mapInstance lit le marqueur de progression, défensivement', () => {
    expect(mapInstance({ ...vide, progression_json: '{"evaluee":true,"decisions":{"e1":"refusee"}}' }).progression).toEqual({
      evaluee: true,
      decisions: { e1: 'refusee' },
    })
    expect(mapInstance({ ...vide, progression_json: '{malformé' }).progression).toBeNull()
  })

  it('mapSerie applique les défauts et garde les mesures nulles', () => {
    expect(mapSerie(vide)).toEqual({
      id: 'x', instanceSeanceId: '', exerciceSeanceId: '', numeroSerie: 0, repsRealisees: null,
      chargeKg: null, chargeLabel: null, rpe: null, notes: '', isCompleted: false, updatedAt: '',
    })
  })

  it('mapObjectif applique les défauts', () => {
    expect(mapObjectif(vide)).toEqual({
      id: 'x', seanceId: '', exerciseId: '', chargeCible: null, repsCible: null, dureeCibleSec: null,
      compteurEchec: 0, derniereMaj: null, nombreSeriesCible: null, updatedAt: '',
    })
  })

  it('mapExercise applique les défauts', () => {
    expect(mapExercise(vide)).toEqual({
      id: 'x', name: '', category: '', muscleGroups: '', description: '', isFavorite: false,
      isCustom: false, imageUrl: null, exerciseType: '', equipment: '', musclePrimary: '',
      isBodyweight: false, updatedAt: '',
    })
  })
})
