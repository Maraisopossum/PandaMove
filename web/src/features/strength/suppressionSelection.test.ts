import { beforeEach, describe, expect, it } from 'vitest'
import type { Db } from '../../core/db/Db'
import { inserer } from '../../test/fixtures'
import { createTestDb } from '../../test/sqliteDb'
import { supprimerInstancesSelection, supprimerSeancesSelection, textesSuppressionSelection } from './suppressionSelection'

const base = { user_id: 'u', updated_at: '2026-01-01T00:00:00Z', deleted_at: null }
let db: Db

const supprimee = async (table: string, id: string) =>
  (await db.get<{ d: string | null }>(`SELECT deleted_at AS d FROM ${table} WHERE id = ?`, [id])).d !== null
const archivee = async (id: string) => (await db.get<{ a: number }>('SELECT is_archived AS a FROM seances WHERE id = ?', [id])).a === 1

beforeEach(async () => {
  db = createTestDb()
  await inserer(db, 'seances', { ...base, id: 'vide', nom: 'Sans historique', is_archived: 0, seance_category: 'STRENGTH', created_at: 'c' })
  await inserer(db, 'seances', { ...base, id: 'jouee', nom: 'Avec historique', is_archived: 0, seance_category: 'STRENGTH', created_at: 'c' })
  await inserer(db, 'seances', { ...base, id: 'archivee', nom: 'Archivée', is_archived: 1, seance_category: 'STRENGTH', created_at: 'c' })
  await inserer(db, 'exercices_seance', { ...base, id: 'm-jouee', seance_id: 'jouee', exercise_id: 'x', instance_seance_id: null })
  await inserer(db, 'instances_seance', { ...base, id: 'i-jouee', seance_id: 'jouee', date: '2026-10-01', is_completed: 1, created_at: 'c' })
  await inserer(db, 'instances_seance', { ...base, id: 'i-archivee', seance_id: 'archivee', date: '2026-09-01', is_completed: 1, created_at: 'c' })
  await inserer(db, 'series_realisees', { ...base, id: 'r1', instance_seance_id: 'i-archivee', exercice_seance_id: 'e', numero_serie: 1, is_completed: 1, notes: '' })
})

describe('supprimerSeancesSelection (Android deleteSeances)', () => {
  it('une séance type sans séance jouée est supprimée', async () => {
    const r = await supprimerSeancesSelection(db, ['vide'])
    expect(r).toEqual({ supprimees: 1, archivees: 0 })
    expect(await supprimee('seances', 'vide')).toBe(true)
  })

  it('une séance type qui a des séances jouées est archivée, son historique est conservé', async () => {
    const r = await supprimerSeancesSelection(db, ['jouee'])
    expect(r).toEqual({ supprimees: 0, archivees: 1 })
    expect(await archivee('jouee')).toBe(true)
    expect(await supprimee('seances', 'jouee')).toBe(false)
    expect(await supprimee('instances_seance', 'i-jouee')).toBe(false)
  })

  it('une séance déjà archivée est purgée pour de bon (séances jouées et séries comprises), suppression logique', async () => {
    const r = await supprimerSeancesSelection(db, ['archivee'])
    expect(r).toEqual({ supprimees: 1, archivees: 0 })
    expect(await supprimee('seances', 'archivee')).toBe(true)
    expect(await supprimee('instances_seance', 'i-archivee')).toBe(true)
    expect(await supprimee('series_realisees', 'r1')).toBe(true)
    // les lignes d'une autre séance ne sont pas touchées
    expect(await supprimee('instances_seance', 'i-jouee')).toBe(false)
  })

  it('mélange : chaque séance suit sa règle', async () => {
    const r = await supprimerSeancesSelection(db, ['vide', 'jouee', 'archivee'])
    expect(r).toEqual({ supprimees: 2, archivees: 1 })
  })

  it('une séance inconnue ou déjà supprimée est ignorée sans erreur', async () => {
    await supprimerSeancesSelection(db, ['vide'])
    expect(await supprimerSeancesSelection(db, ['vide', 'inconnue'])).toEqual({ supprimees: 0, archivees: 0 })
  })
})

describe('supprimerInstancesSelection (Android deleteInstances)', () => {
  it('supprime logiquement chaque séance jouée choisie, sans toucher au modèle', async () => {
    await inserer(db, 'instances_seance', { ...base, id: 'i2', seance_id: 'jouee', date: '2026-10-02', is_completed: 0, created_at: 'c' })
    const n = await supprimerInstancesSelection(db, ['i-jouee', 'i2'])
    expect(n).toBe(2)
    expect(await supprimee('instances_seance', 'i-jouee')).toBe(true)
    expect(await supprimee('instances_seance', 'i2')).toBe(true)
    expect(await supprimee('seances', 'jouee')).toBe(false)
  })

  it('ignore une séance jouée déjà supprimée', async () => {
    expect(await supprimerInstancesSelection(db, ['i-jouee'])).toBe(1)
    expect(await supprimerInstancesSelection(db, ['i-jouee'])).toBe(0)
  })
})

describe('textesSuppressionSelection (dialogue de l’Android)', () => {
  it('un seul élément : « cet élément »', () => {
    expect(textesSuppressionSelection({ types: 1, archivees: 0, planifiees: 0, terminees: 0 })).toMatchObject({
      titre: 'Supprimer cet élément ?',
    })
  })
  it('plusieurs : « ces N éléments » et détail par nature, accordé', () => {
    const t = textesSuppressionSelection({ types: 2, archivees: 1, planifiees: 0, terminees: 0 })
    expect(t.titre).toBe('Supprimer ces 3 éléments ?')
    expect(t.lignes[0]).toBe('2 séances types et 1 séance archivée seront supprimées.')
  })
  it('séances jouées : planifiées et terminées', () => {
    expect(textesSuppressionSelection({ types: 0, archivees: 0, planifiees: 1, terminees: 0 }).lignes[0]).toBe('1 séance planifiée sera supprimée.')
    expect(textesSuppressionSelection({ types: 0, archivees: 0, planifiees: 0, terminees: 3 }).lignes[0]).toBe('3 séances terminées seront supprimées.')
  })
  it('explique l’archivage d’une séance type qui a de l’historique et la purge d’une archivée', () => {
    const t = textesSuppressionSelection({ types: 1, archivees: 0, planifiees: 0, terminees: 0 })
    expect(t.lignes.join(' ')).toMatch(/déjà des séances jouées est archivée/)
    const a = textesSuppressionSelection({ types: 0, archivees: 1, planifiees: 0, terminees: 0 })
    expect(a.lignes.join(' ')).toMatch(/définitivement/)
  })
  it('séances jouées seules : pas d’explication sur les modèles', () => {
    expect(textesSuppressionSelection({ types: 0, archivees: 0, planifiees: 2, terminees: 0 }).lignes).toHaveLength(2)
  })
})
