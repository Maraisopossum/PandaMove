import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createTestDb } from '../../../test/sqliteDb'
import type { Db } from '../Db'
import {
  creer, definirValidation, deplacer, ErreurSeanceCardio, type GenreCardio, lirePlage, lireParId, lireProchaines, modifier,
  supprimer, TABLES_CARDIO,
} from './seancesCardio'

let db: Db
beforeEach(() => {
  db = createTestDb()
})

const GENRES: GenreCardio[] = ['course', 'velo']
const LIEN = 'https://www.strava.com/activities/123456789'

// Crée une séance minimale à la date donnée ; renvoie son id.
const seance = (genre: GenreCardio, date: string, titre = 'Footing facile') => creer(db, genre, { date, titre })

const code = async (promesse: Promise<unknown>) => {
  const erreur = await promesse.then(() => null, (e: unknown) => e)
  expect(erreur).toBeInstanceOf(ErreurSeanceCardio)
  return (erreur as ErreurSeanceCardio).code
}

describe('liste blanche des tables', () => {
  it('associe chaque genre à sa table et à elle seule', () => {
    expect(TABLES_CARDIO).toEqual({ course: 'seances_course', velo: 'seances_velo' })
  })

  it.each(['natation', '', 'constructor', '__proto__', 'course; DROP TABLE seances'])(
    'refuse le genre inconnu « %s » avant de construire le moindre SQL',
    async (genre) => {
      const inconnu = genre as GenreCardio
      await expect(lirePlage(db, inconnu, '2026-01-01', '2026-12-31')).rejects.toThrow(/Genre cardio inconnu/)
      await expect(creer(db, inconnu, { date: '2026-11-03', titre: 'x' })).rejects.toThrow(/Genre cardio inconnu/)
      await expect(supprimer(db, inconnu, 'id')).rejects.toThrow(/Genre cardio inconnu/)
    },
  )
})

describe.each(GENRES)('%s', (genre) => {
  const autre: GenreCardio = genre === 'course' ? 'velo' : 'course'

  describe('creer et lireParId', () => {
    it('enregistre une séance minimale avec ses valeurs par défaut', async () => {
      const id = await seance(genre, '2026-11-03')
      expect(await lireParId(db, genre, id)).toEqual({
        id, genre, date: '2026-11-03', titre: 'Footing facile', consigne: null, detail: null, optionnelle: false, jalon: null,
        lien: null, isValidated: false, supprimee: false, createdAt: expect.any(String),
      })
    })

    it('enregistre une séance complète, détail non découpé', async () => {
      const id = await creer(db, genre, {
        date: '2027-03-14', titre: 'Pi Marathon — relais', consigne: 'Départ prudent.', detail: '14,065 km · objectif 1 h 10',
        optionnelle: true, jalon: 'Pi Marathon', lien: LIEN,
      })
      expect(await lireParId(db, genre, id)).toMatchObject({
        titre: 'Pi Marathon — relais', consigne: 'Départ prudent.', detail: '14,065 km · objectif 1 h 10', optionnelle: true,
        jalon: 'Pi Marathon', lien: LIEN, isValidated: false,
      })
    })

    it("garde l'identifiant et la date de création fournis (import idempotent)", async () => {
      const id = await creer(db, genre, { id: 'w1|e0', createdAt: '2026-11-01T10:00:00.000Z', date: '2026-11-03', titre: 'x' })
      expect(id).toBe('w1|e0')
      expect(await lireParId(db, genre, id)).toMatchObject({ id: 'w1|e0', createdAt: '2026-11-01T10:00:00.000Z' })
    })

    it('retire les espaces et enregistre NULL (jamais une chaîne vide) pour les champs facultatifs vides', async () => {
      const id = await creer(db, genre, { date: '2026-11-03', titre: '  Footing  ', consigne: '   ', detail: '', jalon: ' ', lien: '' })
      expect(await lireParId(db, genre, id)).toMatchObject({ titre: 'Footing', consigne: null, detail: null, jalon: null, lien: null })
    })

    it("n'écrit pas user_id (rempli par le serveur avec auth.uid()) et pose created_at et updated_at", async () => {
      const id = await seance(genre, '2026-11-03')
      const ligne = await db.get<Record<string, unknown>>(`SELECT * FROM ${TABLES_CARDIO[genre]} WHERE id = ?`, [id])
      expect(ligne.user_id).toBeNull()
      expect(ligne.created_at).toEqual(expect.any(String))
      expect(ligne.updated_at).toEqual(expect.any(String))
    })

    it('ne lit que dans sa propre table', async () => {
      const id = await seance(genre, '2026-11-03')
      expect(await lireParId(db, autre, id)).toBeNull()
    })

    it.each([
      ['date inexistante (30 février)', { date: '2026-02-30', titre: 'x' }],
      ['date au mauvais format', { date: '03/11/2026', titre: 'x' }],
      ['titre vide', { date: '2026-11-03', titre: '' }],
      ['titre fait d\'espaces', { date: '2026-11-03', titre: '   ' }],
      ['titre de 201 caractères', { date: '2026-11-03', titre: 'x'.repeat(201) }],
      ['consigne de 2001 caractères', { date: '2026-11-03', titre: 'x', consigne: 'x'.repeat(2001) }],
      ['détail de 101 caractères', { date: '2026-11-03', titre: 'x', detail: 'x'.repeat(101) }],
      ['jalon de 101 caractères', { date: '2026-11-03', titre: 'x', jalon: 'x'.repeat(101) }],
      ['lien en http://', { date: '2026-11-03', titre: 'x', lien: 'http://www.strava.com/activities/1' }],
      ['lien en majuscules HTTPS://', { date: '2026-11-03', titre: 'x', lien: 'HTTPS://www.strava.com/activities/1' }],
      ['lien de 2049 caractères', { date: '2026-11-03', titre: 'x', lien: `https://${'x'.repeat(2041)}` }],
    ])('refuse : %s (rien n\'est écrit)', async (_nom, saisie) => {
      expect(await code(creer(db, genre, saisie))).toBe('invalide')
      expect(await db.getAll(`SELECT id FROM ${TABLES_CARDIO[genre]}`)).toEqual([])
    })

    it('accepte les valeurs à la limite des bornes', async () => {
      await creer(db, genre, {
        date: '2026-11-03', titre: 'x'.repeat(200), consigne: 'x'.repeat(2000), detail: 'x'.repeat(100), jalon: 'x'.repeat(100),
        lien: `https://${'x'.repeat(2040)}`,
      })
    })

    it('annule tout dans une transaction appelante (import atomique)', async () => {
      await expect(
        db.writeTransaction(async (tx) => {
          await creer(tx, genre, { date: '2026-11-03', titre: 'a' })
          await creer(tx, genre, { date: '2026-11-04', titre: 'b' })
          throw new Error('échec simulé')
        }),
      ).rejects.toThrow('échec simulé')
      expect(await lirePlage(db, genre, '2026-01-01', '2026-12-31')).toEqual([])
    })
  })

  describe('lirePlage', () => {
    it('renvoie les séances vivantes de la plage (bornes comprises), triées par date puis id', async () => {
      await creer(db, genre, { id: 'b', date: '2026-11-10', titre: 'b' })
      await creer(db, genre, { id: 'a', date: '2026-11-10', titre: 'a' })
      await seance(genre, '2026-11-01')
      await seance(genre, '2026-11-30')
      await seance(genre, '2026-10-31')
      await seance(genre, '2026-12-01')
      const plage = await lirePlage(db, genre, '2026-11-01', '2026-11-30')
      expect(plage.map((s) => `${s.date}:${s.id.length === 1 ? s.id : '·'}`)).toEqual([
        '2026-11-01:·', '2026-11-10:a', '2026-11-10:b', '2026-11-30:·',
      ])
    })

    it("ignore les séances supprimées, garde les validées, et ne mélange pas les genres", async () => {
      const vivante = await seance(genre, '2026-11-05')
      const supprimee = await seance(genre, '2026-11-06')
      const validee = await seance(genre, '2026-11-07')
      await seance(autre, '2026-11-08')
      await supprimer(db, genre, supprimee)
      await definirValidation(db, genre, validee, true)
      const plage = await lirePlage(db, genre, '2026-11-01', '2026-11-30')
      expect(plage.map((s) => s.id)).toEqual([vivante, validee])
      expect(plage.every((s) => s.genre === genre)).toBe(true)
    })
  })

  describe('lireProchaines', () => {
    it('renvoie à partir d\'aujourd\'hui (compris), hors validées et supprimées, triées, limitées', async () => {
      await seance(genre, '2026-11-02') // passée
      const a = await seance(genre, '2026-11-03')
      const validee = await seance(genre, '2026-11-04')
      const supprimee = await seance(genre, '2026-11-05')
      const b = await seance(genre, '2026-11-06')
      await seance(genre, '2026-11-07')
      await definirValidation(db, genre, validee, true)
      await supprimer(db, genre, supprimee)
      const prochaines = await lireProchaines(db, genre, '2026-11-03', 2)
      expect(prochaines.map((s) => s.id)).toEqual([a, b])
    })

    it('ne mélange pas les genres', async () => {
      await seance(autre, '2026-11-03')
      expect(await lireProchaines(db, genre, '2026-11-03', 10)).toEqual([])
    })
  })

  describe('lireParId', () => {
    it('inclut les séances supprimées logiquement (l\'import ne les recrée pas) et renvoie null si jamais créée', async () => {
      const id = await seance(genre, '2026-11-03')
      await supprimer(db, genre, id)
      expect(await lireParId(db, genre, id)).toMatchObject({ id, supprimee: true })
      expect(await lireParId(db, genre, 'inconnue')).toBeNull()
    })
  })

  describe('modifier', () => {
    it('ne change que les champs fournis et rafraîchit updated_at', async () => {
      const id = await creer(db, genre, { date: '2026-11-03', titre: 'Footing', consigne: 'Facile', lien: LIEN })
      await db.execute(`UPDATE ${TABLES_CARDIO[genre]} SET updated_at = ? WHERE id = ?`, ['2000-01-01T00:00:00.000Z', id])
      await modifier(db, genre, id, { titre: 'Footing souple', optionnelle: true, lien: null })
      expect(await lireParId(db, genre, id)).toMatchObject({
        titre: 'Footing souple', consigne: 'Facile', optionnelle: true, lien: null, date: '2026-11-03',
      })
      const { updated_at } = await db.get<{ updated_at: string }>(`SELECT updated_at FROM ${TABLES_CARDIO[genre]} WHERE id = ?`, [id])
      expect(updated_at > '2000-01-01T00:00:00.000Z').toBe(true)
    })

    it("ne touche ni à la date ni à l'état validé (fonctions dédiées)", async () => {
      const id = await seance(genre, '2026-11-03')
      await modifier(db, genre, id, { titre: 'Autre', date: '2027-01-01', isValidated: true } as never)
      expect(await lireParId(db, genre, id)).toMatchObject({ titre: 'Autre', date: '2026-11-03', isValidated: false })
    })

    it('valide les champs fournis et refuse un titre vide', async () => {
      const id = await seance(genre, '2026-11-03')
      expect(await code(modifier(db, genre, id, { titre: '  ' }))).toBe('invalide')
      expect(await code(modifier(db, genre, id, { lien: 'http://x.fr' }))).toBe('invalide')
      expect(await lireParId(db, genre, id)).toMatchObject({ titre: 'Footing facile', lien: null })
    })

    it('autorise la modification d\'une séance validée', async () => {
      const id = await seance(genre, '2026-11-03')
      await definirValidation(db, genre, id, true)
      await modifier(db, genre, id, { lien: LIEN })
      expect(await lireParId(db, genre, id)).toMatchObject({ lien: LIEN, isValidated: true })
    })

    it('refuse une séance introuvable ou supprimée', async () => {
      const id = await seance(genre, '2026-11-03')
      await supprimer(db, genre, id)
      expect(await code(modifier(db, genre, id, { titre: 'x' }))).toBe('introuvable')
      expect(await code(modifier(db, genre, 'inconnue', { titre: 'x' }))).toBe('introuvable')
    })
  })

  describe('deplacer', () => {
    it('change la date dans une transaction', async () => {
      const id = await seance(genre, '2026-11-03')
      const transaction = vi.spyOn(db, 'writeTransaction')
      await deplacer(db, genre, id, '2026-11-04')
      expect(transaction).toHaveBeenCalledTimes(1)
      expect(await lireParId(db, genre, id)).toMatchObject({ date: '2026-11-04' })
    })

    it('refuse une séance validée sans rien écrire (code « validee »), puis accepte après dévalidation', async () => {
      const id = await seance(genre, '2026-11-03')
      await definirValidation(db, genre, id, true)
      expect(await code(deplacer(db, genre, id, '2026-11-04'))).toBe('validee')
      expect(await lireParId(db, genre, id)).toMatchObject({ date: '2026-11-03', isValidated: true })
      await definirValidation(db, genre, id, false)
      await deplacer(db, genre, id, '2026-11-04')
      expect(await lireParId(db, genre, id)).toMatchObject({ date: '2026-11-04', isValidated: false })
    })

    it("relit l'état dans la transaction : une validation arrivée entre l'affichage et le déplacement est détectée", async () => {
      const id = await seance(genre, '2026-11-03')
      const affichee = await lireParId(db, genre, id) // vue « non validée » affichée à l'écran
      expect(affichee?.isValidated).toBe(false)
      await db.execute(`UPDATE ${TABLES_CARDIO[genre]} SET is_validated = 1 WHERE id = ?`, [id]) // validée ailleurs, reçue par synchro
      expect(await code(deplacer(db, genre, id, '2026-11-04'))).toBe('validee')
    })

    it('refuse une date invalide, une séance supprimée et une séance inconnue', async () => {
      const id = await seance(genre, '2026-11-03')
      expect(await code(deplacer(db, genre, id, '2026-02-30'))).toBe('invalide')
      await supprimer(db, genre, id)
      expect(await code(deplacer(db, genre, id, '2026-11-04'))).toBe('introuvable')
      expect(await code(deplacer(db, genre, 'inconnue', '2026-11-04'))).toBe('introuvable')
    })
  })

  describe('definirValidation', () => {
    it('valide puis dévalide, sans changer la date', async () => {
      const id = await seance(genre, '2026-11-03')
      await definirValidation(db, genre, id, true)
      expect(await lireParId(db, genre, id)).toMatchObject({ isValidated: true, date: '2026-11-03' })
      await definirValidation(db, genre, id, false)
      expect(await lireParId(db, genre, id)).toMatchObject({ isValidated: false })
    })

    it('refuse une séance supprimée ou inconnue', async () => {
      const id = await seance(genre, '2026-11-03')
      await supprimer(db, genre, id)
      expect(await code(definirValidation(db, genre, id, true))).toBe('introuvable')
      expect(await code(definirValidation(db, genre, 'inconnue', true))).toBe('introuvable')
    })
  })

  describe('supprimer', () => {
    it('écrit deleted_at (suppression logique, jamais un DELETE) et la séance reste lisible par identifiant', async () => {
      const id = await seance(genre, '2026-11-03')
      await supprimer(db, genre, id)
      const ligne = await db.get<{ deleted_at: string | null; updated_at: string }>(
        `SELECT deleted_at, updated_at FROM ${TABLES_CARDIO[genre]} WHERE id = ?`,
        [id],
      )
      expect(ligne.deleted_at).toEqual(expect.any(String))
      expect(ligne.updated_at).toBe(ligne.deleted_at)
    })

    it('supprime aussi une séance validée, mais pas deux fois, et ne touche pas l\'autre genre', async () => {
      const id = await seance(genre, '2026-11-03')
      const voisine = await seance(autre, '2026-11-03')
      await definirValidation(db, genre, id, true)
      await supprimer(db, genre, id)
      expect(await code(supprimer(db, genre, id))).toBe('introuvable')
      expect(await lireParId(db, autre, voisine)).toMatchObject({ supprimee: false })
    })
  })
})
