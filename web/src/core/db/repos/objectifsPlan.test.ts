import { describe, expect, it } from 'vitest'
import { createTestDb } from '../../../test/sqliteDb'
import {
  creerObjectifPlan, ErreurObjectif, idObjectifDeJalon, lireObjectifDeSeance, lireObjectifPlan, lireObjectifsPlan, modifierObjectifPlan, supprimerObjectifPlan,
} from './objectifsPlan'

const saisie = { nom: 'Ravensberg 10 km', discipline: 'course' as const, date: '2027-01-31' }

describe('objectifs de plan', () => {
  it('crée un objectif avec ses valeurs par défaut et le relit', async () => {
    const db = createTestDb()
    const id = await creerObjectifPlan(db, saisie)
    expect(await lireObjectifPlan(db, id)).toMatchObject({ nom: 'Ravensberg 10 km', discipline: 'course', date: '2027-01-31', priorite: 'B', statut: 'prevu', cibleS: null, resultatS: null })
  })

  it('liste les objectifs vivants par date', async () => {
    const db = createTestDb()
    await creerObjectifPlan(db, { ...saisie, nom: 'B', date: '2027-03-14' })
    await creerObjectifPlan(db, { ...saisie, nom: 'A', date: '2027-01-31' })
    expect((await lireObjectifsPlan(db)).map((o) => o.nom)).toEqual(['A', 'B'])
  })

  it('modifie tous les champs, dont le résultat', async () => {
    const db = createTestDb()
    const id = await creerObjectifPlan(db, saisie)
    await modifierObjectifPlan(db, id, { ...saisie, statut: 'fait', resultatS: 2880, cibleS: 3000, priorite: 'A' })
    expect(await lireObjectifPlan(db, id)).toMatchObject({ statut: 'fait', resultatS: 2880, cibleS: 3000, priorite: 'A' })
  })

  it('supprime logiquement, sans effacer la ligne', async () => {
    const db = createTestDb()
    const id = await creerObjectifPlan(db, saisie)
    await supprimerObjectifPlan(db, id)
    expect(await lireObjectifPlan(db, id)).toBeNull()
    expect((await db.getAll('SELECT id FROM objectifs_plan WHERE id = ? AND deleted_at IS NOT NULL', [id]))).toHaveLength(1)
    await expect(supprimerObjectifPlan(db, id)).rejects.toMatchObject({ code: 'introuvable' })
  })

  it.each([
    ['nom vide', { nom: '  ' }],
    ['nom trop long', { nom: 'x'.repeat(201) }],
    ['discipline inconnue', { discipline: 'golf' as never }],
    ['date invalide', { date: '31/01/2027' }],
    ['date irréelle', { date: '2027-02-30' }],
    ['priorité inconnue', { priorite: 'Z' as never }],
    ['temps visé négatif', { cibleS: -1 }],
    ['résultat non entier', { resultatS: 12.5 }],
    ['distance hors limites', { distanceM: 20_000_000 }],
  ])('refuse : %s', async (_cas, champs) => {
    const db = createTestDb()
    await expect(creerObjectifPlan(db, { ...saisie, ...champs })).rejects.toBeInstanceOf(ErreurObjectif)
    expect(await lireObjectifsPlan(db)).toEqual([])
  })

  it('retrouve l’objectif repris d’un jalon, avec un identifiant stable', async () => {
    const db = createTestDb()
    const id = idObjectifDeJalon('u1', 'seance-1')
    expect(idObjectifDeJalon('u1', 'seance-1')).toBe(id)
    expect(idObjectifDeJalon('u2', 'seance-1')).not.toBe(id)
    await creerObjectifPlan(db, { ...saisie, id, seanceId: 'seance-1' })
    expect((await lireObjectifDeSeance(db, 'seance-1'))?.id).toBe(id)
    expect(await lireObjectifDeSeance(db, 'autre')).toBeNull()
  })
})
