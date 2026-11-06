import { beforeEach, describe, expect, it } from 'vitest'
import { createTestDb } from '../../../test/sqliteDb'
import type { Db } from '../Db'
import {
  creerSortie, ErreurSortie, lireParEmpreinte, lireSortie, lireSorties, modifierSortie, supprimerSortie, TITRE_PAR_DEFAUT, type SaisieSortie,
} from './sorties'

let db: Db
beforeEach(() => {
  db = createTestDb()
})

const COURSE: SaisieSortie = { sport: 'course', date: '2026-11-05', dureeS: 3000, distanceM: 10_000, fcMoy: 150, fcMax: 175 }

const code = async (promesse: Promise<unknown>) => {
  const erreur = await promesse.then(() => null, (e: unknown) => e)
  expect(erreur).toBeInstanceOf(ErreurSortie)
  return (erreur as ErreurSortie).code
}

describe('création et lecture', () => {
  it('crée puis relit une sortie, titre par défaut selon le sport', async () => {
    const id = await creerSortie(db, COURSE)
    const s = await lireSortie(db, id)
    expect(s).toMatchObject({ id, sport: 'course', date: '2026-11-05', titre: TITRE_PAR_DEFAUT.course, dureeS: 3000, distanceM: 10_000, fcMoy: 150, source: 'manuel', enSalle: false })
    expect(s?.notes).toBeNull()
    expect(s?.seanceId).toBeNull()
  })

  it('titre par défaut du vélo, champs facultatifs absents enregistrés à null', async () => {
    const id = await creerSortie(db, { sport: 'velo', date: '2026-11-05', enSalle: true, puissanceMoyW: 210 })
    expect(await lireSortie(db, id)).toMatchObject({ titre: 'Sortie vélo', enSalle: true, puissanceMoyW: 210, distanceM: null, fcMoy: null })
  })

  it('range la séance planifiée dans la colonne du bon sport', async () => {
    const id = await creerSortie(db, { ...COURSE, seanceId: '11111111-1111-4111-8111-111111111111' })
    expect((await lireSortie(db, id))?.seanceId).toBe('11111111-1111-4111-8111-111111111111')
    const velo = await creerSortie(db, { sport: 'velo', date: '2026-11-05', seanceId: '22222222-2222-4222-8222-222222222222' })
    expect((await lireSortie(db, velo))?.seanceId).toBe('22222222-2222-4222-8222-222222222222')
  })

  it('liste les plus récentes d’abord, filtre par sport, limite', async () => {
    const a = await creerSortie(db, { ...COURSE, date: '2026-11-01' })
    const b = await creerSortie(db, { ...COURSE, date: '2026-11-04' })
    const c = await creerSortie(db, { sport: 'velo', date: '2026-11-03' })
    expect((await lireSorties(db)).map((s) => s.id)).toEqual([b, c, a])
    expect((await lireSorties(db, { sport: 'course' })).map((s) => s.id)).toEqual([b, a])
    expect((await lireSorties(db, { limite: 1 })).map((s) => s.id)).toEqual([b])
  })

  it('retrouve une sortie par empreinte', async () => {
    const id = await creerSortie(db, { ...COURSE, empreinte: 'course|2026-11-05T07:00:00Z|3000' })
    expect((await lireParEmpreinte(db, 'course|2026-11-05T07:00:00Z|3000'))?.id).toBe(id)
    expect(await lireParEmpreinte(db, 'autre')).toBeNull()
  })
})

describe('validation', () => {
  it.each([
    ['date inexistante', { ...COURSE, date: '2026-02-30' }],
    ['durée négative', { ...COURSE, dureeS: -1 }],
    ['distance non finie', { ...COURSE, distanceM: Number.NaN }],
    ['FC hors bornes', { ...COURSE, fcMax: 300 }],
    ['FC moyenne au-dessus de la max', { ...COURSE, fcMoy: 180, fcMax: 170 }],
    ['RPE décimal', { ...COURSE, rpe: 7.5 }],
    ['RPE hors bornes', { ...COURSE, rpe: 11 }],
    ['durée en mouvement > durée', { ...COURSE, dureeDeplacementS: 4000 }],
    ['lien sans https', { ...COURSE, lien: 'http://x.fr' }],
    ['titre trop long', { ...COURSE, titre: 'x'.repeat(201) }],
    ['notes trop longues', { ...COURSE, notes: 'x'.repeat(2001) }],
    ['source inconnue', { ...COURSE, source: 'strava' as never }],
    ['sport inconnu', { ...COURSE, sport: 'natation' as never }],
  ])('refuse : %s', async (_nom, saisie) => {
    expect(await code(creerSortie(db, saisie as SaisieSortie))).toBe('invalide')
    expect(await lireSorties(db)).toEqual([])
  })
})

describe('modification et suppression', () => {
  it('remplace les champs', async () => {
    const id = await creerSortie(db, COURSE)
    await modifierSortie(db, id, { sport: 'course', date: '2026-11-06', titre: 'Sortie longue', notes: 'Bien', rpe: 6 })
    expect(await lireSortie(db, id)).toMatchObject({ date: '2026-11-06', titre: 'Sortie longue', notes: 'Bien', rpe: 6, distanceM: null, fcMoy: null })
  })

  it('modifier une sortie inconnue : introuvable', async () => {
    expect(await code(modifierSortie(db, 'nope', COURSE))).toBe('introuvable')
  })

  it('suppression logique : disparaît des lectures, la ligne reste avec deleted_at', async () => {
    const id = await creerSortie(db, COURSE)
    await supprimerSortie(db, id)
    expect(await lireSortie(db, id)).toBeNull()
    expect(await lireSorties(db)).toEqual([])
    const ligne = await db.get<{ deleted_at: string | null }>('SELECT deleted_at FROM sorties WHERE id = ?', [id])
    expect(ligne.deleted_at).not.toBeNull()
    expect(await code(supprimerSortie(db, id))).toBe('introuvable')
  })
})
