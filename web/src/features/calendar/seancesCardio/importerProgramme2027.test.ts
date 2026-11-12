import { beforeEach, describe, expect, it } from 'vitest'
import type { Db } from '../../../core/db/Db'
import { deterministicId } from '../../../core/db/ids'
import { definirValidation, deplacer, lireParId, lirePlage, supprimer } from '../../../core/db/repos/seancesCardio'
import { createTestDb } from '../../../test/sqliteDb'
import { idSeanceProgramme2027, importerProgramme2027, type EntreeProgramme } from './importerProgramme2027'
import programme from './programme2027.json'

const USER = 'utilisateur-1'

const entree = (cle: string, extra: Partial<EntreeProgramme> = {}): EntreeProgramme => ({
  cle, genre: 'course', date: '2026-11-03', titre: 'Footing facile', consigne: 'Facile.', detail: '40 min · Z1',
  optionnelle: false, jalon: null, ...extra,
})

let db: Db
beforeEach(() => {
  db = createTestDb()
})

const compter = async () => {
  const l = await db.getAll<{ n: number }>('SELECT (SELECT count(*) FROM seances_course) + (SELECT count(*) FROM seances_velo) AS n')
  return l[0].n
}

describe('idSeanceProgramme2027', () => {
  it('est déterministe : même utilisateur et même clé, même id', () => {
    expect(idSeanceProgramme2027(USER, 'w1|e0')).toBe(idSeanceProgramme2027(USER, 'w1|e0'))
    expect(idSeanceProgramme2027(USER, 'w1|e0')).toBe(deterministicId(USER, 'programme2027|w1|e0'))
  })

  it('change avec la clé et avec l’utilisateur', () => {
    expect(idSeanceProgramme2027(USER, 'w1|e0')).not.toBe(idSeanceProgramme2027(USER, 'w1|e1'))
    expect(idSeanceProgramme2027(USER, 'w1|e0')).not.toBe(idSeanceProgramme2027('autre', 'w1|e0'))
  })
})

describe('importerProgramme2027', () => {
  it('crée chaque séance dans la table de son genre, avec tous ses champs', async () => {
    const res = await importerProgramme2027(db, USER, [
      entree('w1|e0'),
      entree('w1|e1', { genre: 'velo', date: '2027-06-06', titre: 'Lille-Hardelot', jalon: 'Lille-Hardelot', optionnelle: true, consigne: null, detail: null }),
    ])
    expect(res).toEqual({ creees: 2, dejaPresentes: 0, restaurees: 0 })
    const c = await lireParId(db, 'course', idSeanceProgramme2027(USER, 'w1|e0'))
    expect(c).toMatchObject({ genre: 'course', date: '2026-11-03', titre: 'Footing facile', consigne: 'Facile.', detail: '40 min · Z1', optionnelle: false, jalon: null, isValidated: false })
    const v = await lireParId(db, 'velo', idSeanceProgramme2027(USER, 'w1|e1'))
    expect(v).toMatchObject({ genre: 'velo', date: '2027-06-06', jalon: 'Lille-Hardelot', optionnelle: true, consigne: null, detail: null })
    expect(await lirePlage(db, 'course', '2026-01-01', '2027-12-31')).toHaveLength(1)
    expect(await lirePlage(db, 'velo', '2026-01-01', '2027-12-31')).toHaveLength(1)
  })

  it('est rejouable : un second import ne crée aucun doublon', async () => {
    const entrees = [entree('w1|e0'), entree('w1|e1', { genre: 'velo' })]
    await importerProgramme2027(db, USER, entrees)
    const res = await importerProgramme2027(db, USER, entrees)
    expect(res).toEqual({ creees: 0, dejaPresentes: 2, restaurees: 0 })
    expect(await compter()).toBe(2)
  })

  it('complète un import partiel : seules les séances absentes sont créées', async () => {
    await importerProgramme2027(db, USER, [entree('w1|e0')])
    const res = await importerProgramme2027(db, USER, [entree('w1|e0'), entree('w1|e1')])
    expect(res).toEqual({ creees: 1, dejaPresentes: 1, restaurees: 0 })
  })

  it('ne remplace pas une séance déplacée', async () => {
    await importerProgramme2027(db, USER, [entree('w1|e0')])
    const id = idSeanceProgramme2027(USER, 'w1|e0')
    await deplacer(db, 'course', id, '2026-11-05')
    await importerProgramme2027(db, USER, [entree('w1|e0')])
    expect((await lireParId(db, 'course', id))?.date).toBe('2026-11-05')
  })

  it('ne dévalide pas une séance validée', async () => {
    await importerProgramme2027(db, USER, [entree('w1|e0')])
    const id = idSeanceProgramme2027(USER, 'w1|e0')
    await definirValidation(db, 'course', id, true)
    await importerProgramme2027(db, USER, [entree('w1|e0')])
    expect((await lireParId(db, 'course', id))?.isValidated).toBe(true)
  })

  it('ne recrée pas une séance supprimée', async () => {
    await importerProgramme2027(db, USER, [entree('w1|e0')])
    const id = idSeanceProgramme2027(USER, 'w1|e0')
    await supprimer(db, 'course', id)
    const res = await importerProgramme2027(db, USER, [entree('w1|e0')])
    expect(res).toEqual({ creees: 0, dejaPresentes: 1, restaurees: 0 })
    expect(await lirePlage(db, 'course', '2026-01-01', '2027-12-31')).toHaveLength(0)
  })

  it('rétablit sur demande les séances supprimées, sans toucher aux déplacées ni aux validées', async () => {
    await importerProgramme2027(db, USER, [entree('w1|e0'), entree('w1|e1'), entree('w1|e2')])
    const [a, b, c] = ['w1|e0', 'w1|e1', 'w1|e2'].map((k) => idSeanceProgramme2027(USER, k))
    await supprimer(db, 'course', a)
    await supprimer(db, 'course', b)
    await definirValidation(db, 'course', c, true)
    const res = await importerProgramme2027(db, USER, [entree('w1|e0'), entree('w1|e1'), entree('w1|e2')], { restaurer: true })
    expect(res).toEqual({ creees: 0, dejaPresentes: 1, restaurees: 2 })
    expect(await lirePlage(db, 'course', '2026-01-01', '2027-12-31')).toHaveLength(3)
    expect((await lireParId(db, 'course', a))).toMatchObject({ supprimee: false, isValidated: false, titre: 'Footing facile' })
    expect((await lireParId(db, 'course', c))?.isValidated).toBe(true)
  })

  it('est atomique : une entrée refusée n’en laisse aucune autre', async () => {
    const entrees = [entree('w1|e0'), entree('w1|e1', { date: '2026-02-30' })]
    await expect(importerProgramme2027(db, USER, entrees)).rejects.toThrow()
    expect(await compter()).toBe(0)
  })

  it('sans utilisateur, refuse et n’écrit rien', async () => {
    await expect(importerProgramme2027(db, '', [entree('w1|e0')])).rejects.toThrow(/connect/i)
    expect(await compter()).toBe(0)
  })

  it('importe le programme versionné en entier, puis ne fait rien au second passage', async () => {
    const entrees = programme as EntreeProgramme[]
    const premier = await importerProgramme2027(db, USER)
    expect(premier).toEqual({ creees: entrees.length, dejaPresentes: 0, restaurees: 0 })
    expect(await compter()).toBe(entrees.length)
    expect(await importerProgramme2027(db, USER)).toEqual({ creees: 0, dejaPresentes: entrees.length, restaurees: 0 })
    expect(await compter()).toBe(entrees.length)
  })

  it('donne à deux utilisateurs des identifiants distincts', async () => {
    await importerProgramme2027(db, USER, [entree('w1|e0')])
    await importerProgramme2027(db, 'autre', [entree('w1|e0')])
    expect(await compter()).toBe(2)
  })
})
