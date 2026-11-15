import { describe, expect, it } from 'vitest'
import { createTestDb } from '../../../test/sqliteDb'
import {
  cloreSimulation, creerCourseHyrox, definirReference, demarrerSimulation, enregistrerSegment, ErreurHyrox, lireObjectifHyrox, lireSegments, lireSegmentsMesures,
  lireSimulation, lireSimulationEnCours, lireSimulations, modifierCourseHyrox, modifierNotesSimulation, supprimerCourseHyrox, supprimerSimulation,
} from './hyrox'

const saisie = { nom: 'Préparation Hyrox', categorie: 'open' as const, genre: 'homme' as const }
const segments = [
  { rang: 1, type: 'course' as const, station: null, cibleS: 300, chargeLabel: null },
  { rang: 2, type: 'station' as const, station: 'skierg', cibleS: 240, chargeLabel: null },
]
const depart = { forme: 'partielle' as const, categorie: 'open' as const, genre: 'homme' as const, segments }

describe('objectif Hyrox', () => {
  it('se crée sans date de course et se relit', async () => {
    const db = createTestDb()
    expect(await lireObjectifHyrox(db)).toBeNull()
    await creerCourseHyrox(db, { ...saisie, objectifS: 4200 })
    expect(await lireObjectifHyrox(db)).toMatchObject({ nom: 'Préparation Hyrox', date: null, lieu: null, objectifS: 4200, resultatS: null, categorie: 'open', genre: 'homme' })
  })

  it('l’objectif actif est le plus récent', async () => {
    const db = createTestDb()
    await creerCourseHyrox(db, { ...saisie, nom: 'Ancien' })
    await new Promise((r) => setTimeout(r, 5))
    await creerCourseHyrox(db, { ...saisie, nom: 'Récent' })
    expect((await lireObjectifHyrox(db))?.nom).toBe('Récent')
  })

  it('se modifie puis se supprime logiquement', async () => {
    const db = createTestDb()
    const id = await creerCourseHyrox(db, saisie)
    await modifierCourseHyrox(db, id, { ...saisie, date: '2027-05-09', lieu: 'Lille', categorie: 'pro', resultatS: 4100 })
    expect(await lireObjectifHyrox(db)).toMatchObject({ date: '2027-05-09', lieu: 'Lille', categorie: 'pro', resultatS: 4100 })
    await supprimerCourseHyrox(db, id)
    expect(await lireObjectifHyrox(db)).toBeNull()
    expect(await db.getAll('SELECT id FROM hyrox_courses')).toHaveLength(1)
  })

  it.each([
    ['nom vide', { nom: ' ' }],
    ['date impossible', { date: '2027-02-30' }],
    ['catégorie inconnue', { categorie: 'elite' as never }],
    ['temps négatif', { objectifS: -1 }],
    ['temps non entier', { objectifS: 12.5 }],
    ['temps trop grand', { resultatS: 604801 }],
  ])('refuse : %s', async (_c, champs) => {
    await expect(creerCourseHyrox(createTestDb(), { ...saisie, ...champs })).rejects.toBeInstanceOf(ErreurHyrox)
  })

  it('modifier un objectif inconnu échoue', async () => {
    await expect(modifierCourseHyrox(createTestDb(), 'inconnu', saisie)).rejects.toMatchObject({ code: 'introuvable' })
  })
})

describe('simulations Hyrox', () => {
  it('démarre une simulation avec ses segments non chronométrés', async () => {
    const db = createTestDb()
    const id = await demarrerSimulation(db, depart)
    expect(await lireSimulation(db, id)).toMatchObject({ statut: 'en_cours', forme: 'partielle', totalS: null, reference: false })
    expect((await lireSegments(db, id)).map((s) => [s.rang, s.type, s.station, s.cibleS, s.reelS])).toEqual([[1, 'course', null, 300, null], [2, 'station', 'skierg', 240, null]])
    expect((await lireSimulationEnCours(db))?.id).toBe(id)
  })

  it('enregistre les temps puis clôt avec le total', async () => {
    const db = createTestDb()
    const id = await demarrerSimulation(db, depart)
    await enregistrerSegment(db, id, 1, 310.4)
    await enregistrerSegment(db, id, 2, 250)
    await cloreSimulation(db, id, 'terminee')
    expect(await lireSimulation(db, id)).toMatchObject({ statut: 'terminee', totalS: 560 })
    expect(await lireSimulationEnCours(db)).toBeNull()
    expect((await lireSegmentsMesures(db)).map((s) => s.reelS)).toEqual([310, 250])
  })

  it('une simulation abandonnée garde le total des segments faits', async () => {
    const db = createTestDb()
    const id = await demarrerSimulation(db, depart)
    await enregistrerSegment(db, id, 1, 305)
    await cloreSimulation(db, id, 'abandonnee')
    expect(await lireSimulation(db, id)).toMatchObject({ statut: 'abandonnee', totalS: 305 })
  })

  it('une seule référence à la fois', async () => {
    const db = createTestDb()
    const a = await demarrerSimulation(db, depart)
    const b = await demarrerSimulation(db, depart)
    await definirReference(db, a, true)
    await definirReference(db, b, true)
    const refs = (await lireSimulations(db)).filter((s) => s.reference).map((s) => s.id)
    expect(refs).toEqual([b])
    await definirReference(db, b, false)
    expect((await lireSimulations(db)).some((s) => s.reference)).toBe(false)
  })

  it('enregistre des notes et supprime logiquement la simulation et ses segments', async () => {
    const db = createTestDb()
    const id = await demarrerSimulation(db, depart)
    await modifierNotesSimulation(db, id, ' Bonne forme ')
    expect((await lireSimulation(db, id))?.notes).toBe('Bonne forme')
    await supprimerSimulation(db, id)
    expect(await lireSimulation(db, id)).toBeNull()
    expect(await lireSegments(db, id)).toEqual([])
    expect(await db.getAll('SELECT id FROM hyrox_segments')).toHaveLength(2)
  })

  it('refuse une simulation sans segment ou un rang hors limites', async () => {
    const db = createTestDb()
    await expect(demarrerSimulation(db, { ...depart, segments: [] })).rejects.toBeInstanceOf(ErreurHyrox)
    await expect(demarrerSimulation(db, { ...depart, segments: [{ ...segments[0], rang: 17 }] })).rejects.toBeInstanceOf(ErreurHyrox)
    expect(await lireSimulations(db)).toEqual([])
  })

  it('un segment mesuré d’une simulation en cours ne compte pas dans les records', async () => {
    const db = createTestDb()
    const id = await demarrerSimulation(db, depart)
    await enregistrerSegment(db, id, 1, 280)
    expect(await lireSegmentsMesures(db)).toEqual([])
  })
})
