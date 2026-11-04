import { beforeEach, describe, expect, it } from 'vitest'
import { createTestDb } from '../../../test/sqliteDb'
import type { Db } from '../Db'
import {
  creerMethode, enregistrerSeance, ErreurRespiration, lireMethode, lireMethodes, lireSeances, modifierMethode, type SaisieMethode,
  supprimerMethode, supprimerSeance,
} from './respiration'

let db: Db
beforeEach(() => {
  db = createTestDb()
})

const METHODE: SaisieMethode = {
  nom: 'Ma méthode', emoji: '🌬️', inspireSec: 4, retentionPleineSec: 7, expireSec: 8, retentionVideSec: 0, cyclesDefaut: 6,
}
const SEANCE = { methodeId: '4_7_8', methodeNom: '4-7-8', cycles: 4, dureeSec: 76, date: '2026-11-04' }

const code = async (promesse: Promise<unknown>) => {
  const erreur = await promesse.then(() => null, (e: unknown) => e)
  expect(erreur).toBeInstanceOf(ErreurRespiration)
  return (erreur as ErreurRespiration).code
}

describe('méthodes personnalisées', () => {
  it('crée puis relit une méthode', async () => {
    const id = await creerMethode(db, METHODE)
    expect(await lireMethode(db, id)).toEqual({ id, ...METHODE })
    expect(await lireMethodes(db)).toEqual([{ id, ...METHODE }])
  })

  it('nettoie le nom et l’emoji', async () => {
    const id = await creerMethode(db, { ...METHODE, nom: '  Calme  ', emoji: ' 🌙 ' })
    expect(await lireMethode(db, id)).toMatchObject({ nom: 'Calme', emoji: '🌙' })
  })

  it('liste les méthodes dans l’ordre de création', async () => {
    const a = await creerMethode(db, { ...METHODE, nom: 'A' })
    await new Promise((r) => setTimeout(r, 5))
    const b = await creerMethode(db, { ...METHODE, nom: 'B' })
    expect((await lireMethodes(db)).map((m) => m.id)).toEqual([a, b])
  })

  it('modifie une méthode', async () => {
    const id = await creerMethode(db, METHODE)
    await modifierMethode(db, id, { ...METHODE, nom: 'Renommée', retentionPleineSec: 0, cyclesDefaut: 10 })
    expect(await lireMethode(db, id)).toMatchObject({ nom: 'Renommée', retentionPleineSec: 0, cyclesDefaut: 10 })
  })

  it('refuse de modifier ou supprimer une méthode inconnue', async () => {
    expect(await code(modifierMethode(db, 'absente', METHODE))).toBe('introuvable')
    expect(await code(supprimerMethode(db, 'absente'))).toBe('introuvable')
  })

  it('supprime logiquement : la méthode disparaît des lectures mais la ligne reste', async () => {
    const id = await creerMethode(db, METHODE)
    await supprimerMethode(db, id)
    expect(await lireMethode(db, id)).toBeNull()
    expect(await lireMethodes(db)).toEqual([])
    const brute = await db.getOptional<{ deleted_at: string | null }>('SELECT deleted_at FROM methodes_respiration WHERE id = ?', [id])
    expect(brute?.deleted_at).toEqual(expect.any(String))
    expect(await code(supprimerMethode(db, id))).toBe('introuvable')
  })

  it.each<[string, Partial<SaisieMethode>]>([
    ['nom vide', { nom: '   ' }],
    ['nom trop long', { nom: 'x'.repeat(101) }],
    ['emoji vide', { emoji: '' }],
    ['emoji trop long', { emoji: 'x'.repeat(17) }],
    ['inspiration à 0', { inspireSec: 0 }],
    ['inspiration à 61', { inspireSec: 61 }],
    ['expiration décimale', { expireSec: 2.5 }],
    ['rétention négative', { retentionVideSec: -1 }],
    ['rétention à 61', { retentionPleineSec: 61 }],
    ['0 cycle', { cyclesDefaut: 0 }],
    ['121 cycles', { cyclesDefaut: 121 }],
  ])('refuse la saisie invalide : %s (rien n’est écrit)', async (_nom, champs) => {
    expect(await code(creerMethode(db, { ...METHODE, ...champs }))).toBe('invalide')
    expect(await lireMethodes(db)).toEqual([])
  })

  it('compte les caractères, pas les unités UTF-16 (100 emojis sont acceptés)', async () => {
    const id = await creerMethode(db, { ...METHODE, nom: '🌙'.repeat(100) })
    expect((await lireMethode(db, id))?.nom).toBe('🌙'.repeat(100))
  })

  it('valide aussi à la modification, sans toucher la ligne', async () => {
    const id = await creerMethode(db, METHODE)
    expect(await code(modifierMethode(db, id, { ...METHODE, nom: '' }))).toBe('invalide')
    expect(await lireMethode(db, id)).toMatchObject({ nom: 'Ma méthode' })
  })
})

describe('historique des séances', () => {
  it('enregistre puis relit une séance', async () => {
    const id = await enregistrerSeance(db, SEANCE)
    expect(await lireSeances(db, 15)).toEqual([{ id, ...SEANCE }])
  })

  it('trie les plus récentes d’abord et applique la limite', async () => {
    const vieille = await enregistrerSeance(db, { ...SEANCE, date: '2026-10-01' })
    const recente = await enregistrerSeance(db, { ...SEANCE, date: '2026-11-04' })
    const milieu = await enregistrerSeance(db, { ...SEANCE, date: '2026-10-20' })
    expect((await lireSeances(db, 15)).map((s) => s.id)).toEqual([recente, milieu, vieille])
    expect((await lireSeances(db, 2)).map((s) => s.id)).toEqual([recente, milieu])
  })

  it('conserve l’historique d’une méthode supprimée', async () => {
    const methode = await creerMethode(db, METHODE)
    const id = await enregistrerSeance(db, { ...SEANCE, methodeId: methode })
    await supprimerMethode(db, methode)
    expect((await lireSeances(db, 15)).map((s) => s.id)).toEqual([id])
  })

  it('supprime logiquement une séance', async () => {
    const id = await enregistrerSeance(db, SEANCE)
    await supprimerSeance(db, id)
    expect(await lireSeances(db, 15)).toEqual([])
    expect(await code(supprimerSeance(db, id))).toBe('introuvable')
  })

  it.each<[string, Partial<typeof SEANCE>]>([
    ['méthode sans nom', { methodeNom: ' ' }],
    ['méthode sans identifiant', { methodeId: '' }],
    ['0 cycle', { cycles: 0 }],
    ['durée nulle', { dureeSec: 0 }],
    ['durée de plus d’un jour', { dureeSec: 86_401 }],
    ['30 février', { date: '2026-02-30' }],
    ['date mal formée', { date: '04/11/2026' }],
  ])('refuse la saisie invalide : %s', async (_nom, champs) => {
    expect(await code(enregistrerSeance(db, { ...SEANCE, ...champs }))).toBe('invalide')
    expect(await lireSeances(db, 15)).toEqual([])
  })
})
