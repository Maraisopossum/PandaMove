import { beforeEach, describe, expect, it } from 'vitest'
import type { Db, DbTx } from '../../core/db/Db'
import { inserer } from '../../test/fixtures'
import { createTestDb } from '../../test/sqliteDb'
import { deplacerInstance, lireInstancesPlage, lireProchaines, supprimerInstance } from './calendrier'

const base = { user_id: 'u1', updated_at: 'u0', deleted_at: null }

async function seance(db: Db, id: string, nom: string, extra: Record<string, unknown> = {}) {
  await inserer(db, 'seances', { ...base, id, nom, is_archived: 0, created_at: 'c', ...extra })
}

async function instance(db: Db, id: string, seanceId: string, date: string, extra: Record<string, unknown> = {}) {
  await inserer(db, 'instances_seance', { ...base, id, seance_id: seanceId, date, is_completed: 0, ...extra })
}

async function serie(db: Db, id: string, inst: string, exo: string, numero: number, fait: number, extra: Record<string, unknown> = {}) {
  await inserer(db, 'series_realisees', {
    ...base, id, instance_seance_id: inst, exercice_seance_id: exo, numero_serie: numero, is_completed: fait, ...extra,
  })
}

let db: Db
beforeEach(async () => {
  db = createTestDb()
})

describe('lireInstancesPlage', () => {
  it('base vide : aucune instance, aucune exception', async () => {
    expect(await lireInstancesPlage(db, '2026-09-28', '2026-11-01')).toEqual([])
  })

  it("range par la date planifiée (jamais completed_at), bornes incluses, hors supprimées", async () => {
    await seance(db, 's1', 'Pull')
    await instance(db, 'a', 's1', '2026-10-05', { is_completed: 1, completed_at: '2026-10-20T10:00:00.000Z', duration_seconds: 3000 })
    await instance(db, 'b', 's1', '2026-09-28')
    await instance(db, 'c', 's1', '2026-11-01')
    await instance(db, 'hors', 's1', '2026-11-02')
    await instance(db, 'avant', 's1', '2026-09-27')
    await instance(db, 'sup', 's1', '2026-10-06', { deleted_at: 'x' })
    const vues = await lireInstancesPlage(db, '2026-09-28', '2026-11-01')
    expect(vues.map((v) => [v.id, v.dateIso])).toEqual([
      ['b', '2026-09-28'], ['a', '2026-10-05'], ['c', '2026-11-01'],
    ])
    expect(vues.find((v) => v.id === 'a')).toMatchObject({ etat: 'terminee', dureeSec: 3000, nom: 'Pull', seanceId: 's1' })
  })

  it('états : planifiée, en cours (démarrée non terminée), terminée', async () => {
    await seance(db, 's1', 'Pull')
    await instance(db, 'p', 's1', '2026-10-01')
    await instance(db, 'c', 's1', '2026-10-02', { started_at: '2026-10-02T08:00:00.000Z' })
    await instance(db, 't', 's1', '2026-10-03', { is_completed: 1, started_at: '2026-10-03T08:00:00.000Z', duration_seconds: 60 })
    const vues = await lireInstancesPlage(db, '2026-10-01', '2026-10-31')
    expect(vues.map((v) => v.etat)).toEqual(['planifiee', 'en_cours', 'terminee'])
    expect(vues[0].nbSeries).toBeUndefined()
  })

  it("nbSeries : séries terminées vivantes, dédoublonnées ; l'historique d'une séance supprimée garde son nom", async () => {
    await seance(db, 's1', 'Pull', { deleted_at: 'x' })
    await instance(db, 't', 's1', '2026-10-03', { is_completed: 1, duration_seconds: 60 })
    await serie(db, 'x1', 't', 'e1', 1, 1)
    await serie(db, 'x2', 't', 'e1', 2, 1)
    await serie(db, 'x3', 't', 'e1', 3, 0) // non terminée
    await serie(db, 'x4', 't', 'e1', 1, 1, { updated_at: 'u9' }) // doublon de (e1, 1)
    await serie(db, 'x5', 't', 'e1', 4, 1, { deleted_at: 'x' }) // supprimée
    const [v] = await lireInstancesPlage(db, '2026-10-01', '2026-10-31')
    expect(v.nom).toBe('Pull')
    expect(v.nbSeries).toBe(2)
  })

  it('séance jamais existée : « Séance (supprimée) »', async () => {
    await instance(db, 'o', 'fantome', '2026-10-03')
    const [v] = await lireInstancesPlage(db, '2026-10-01', '2026-10-31')
    expect(v.nom).toBe('Séance (supprimée)')
  })
})

describe('lireProchaines', () => {
  it('base vide : liste vide', async () => {
    expect(await lireProchaines(db, '2026-10-24', 10)).toEqual([])
  })

  it('date >= aujourd\'hui, non terminées, non supprimées, triées par date puis id, limitées', async () => {
    await seance(db, 's1', 'Pull')
    await instance(db, 'z', 's1', '2026-10-24')
    await instance(db, 'b', 's1', '2026-12-01')
    await instance(db, 'a', 's1', '2026-12-01')
    await instance(db, 'passee', 's1', '2026-10-23')
    await instance(db, 'faite', 's1', '2026-10-25', { is_completed: 1 })
    await instance(db, 'sup', 's1', '2026-10-26', { deleted_at: 'x' })
    await instance(db, 'cours', 's1', '2026-10-30', { started_at: '2026-10-30T08:00:00.000Z' })
    const toutes = await lireProchaines(db, '2026-10-24', 10)
    expect(toutes.map((v) => v.id)).toEqual(['z', 'cours', 'a', 'b'])
    expect(toutes[1].etat).toBe('en_cours')
    expect((await lireProchaines(db, '2026-10-24', 2)).map((v) => v.id)).toEqual(['z', 'cours'])
  })
})

describe('deplacerInstance', () => {
  beforeEach(async () => {
    await seance(db, 's1', 'Pull')
    await instance(db, 'p', 's1', '2026-10-05')
    await instance(db, 'autre', 's1', '2026-10-05')
    await instance(db, 'c', 's1', '2026-10-06', { started_at: '2026-10-06T08:00:00.000Z' })
    await instance(db, 't', 's1', '2026-10-07', { is_completed: 1 })
  })
  const lignes = () => db.getAll<{ id: string; date: string; updated_at: string }>('SELECT id, date, updated_at FROM instances_seance ORDER BY id')

  it('met à jour date et updated_at de CETTE instance uniquement', async () => {
    const avant = await lireTout()
    await deplacerInstance(db, 'p', '2026-10-12')
    const apres = await lignes()
    expect(apres.find((l) => l.id === 'p')?.date).toBe('2026-10-12')
    expect(apres.find((l) => l.id === 'p')?.updated_at).not.toBe('u0')
    expect(apres.filter((l) => l.id !== 'p')).toEqual(avant.filter((l) => l.id !== 'p'))
  })

  it('une instance en cours peut être déplacée', async () => {
    await deplacerInstance(db, 'c', '2026-10-13')
    expect((await lignes()).find((l) => l.id === 'c')?.date).toBe('2026-10-13')
  })

  it.each(['2026-02-30', '2026-13-01', 'demain', '', '5/10/2026', '2026-1-5'])(
    'date %j refusée, rien écrit',
    async (date) => {
      const avant = await lignes()
      await expect(deplacerInstance(db, 'p', date)).rejects.toThrow(/date invalide/i)
      expect(await lignes()).toEqual(avant)
    },
  )

  it('instance terminée refusée (sa date ancre les statistiques), rien écrit', async () => {
    const avant = await lignes()
    await expect(deplacerInstance(db, 't', '2026-10-20')).rejects.toThrow(/terminée/i)
    expect(await lignes()).toEqual(avant)
  })

  it('instance inconnue ou supprimée refusée, rien écrit', async () => {
    await db.execute("UPDATE instances_seance SET deleted_at = 'x' WHERE id = 'autre'")
    const avant = await lignes()
    await expect(deplacerInstance(db, 'nope', '2026-10-20')).rejects.toThrow(/introuvable/i)
    await expect(deplacerInstance(db, 'autre', '2026-10-20')).rejects.toThrow(/introuvable/i)
    expect(await lignes()).toEqual(avant)
  })

  async function lireTout() {
    return lignes()
  }
})

describe('supprimerInstance', () => {
  const TABLES = ['seances', 'instances_seance', 'blocs_seance', 'exercices_seance', 'series_realisees'] as const
  type L = { id: string; deleted_at: string | null; updated_at: string }
  const etat = async (d: Db) => {
    const sortie: Record<string, L[]> = {}
    for (const t of TABLES) sortie[t] = await d.getAll<L>(`SELECT id, deleted_at, updated_at FROM ${t} ORDER BY id`)
    return sortie
  }
  const supprimes = async (d: Db) =>
    Object.values(await etat(d)).flat().filter((l) => l.deleted_at !== null).map((l) => l.id).sort()

  async function semer(d: Db) {
    await seance(d, 's1', 'Pull')
    await inserer(d, 'blocs_seance', { ...base, id: 'bt', seance_id: 's1', instance_seance_id: null, position: 0 })
    await inserer(d, 'exercices_seance', { ...base, id: 'et', seance_id: 's1', instance_seance_id: null, position: 0 })
    for (const i of ['i1', 'i2']) {
      await instance(d, i, 's1', '2026-10-05', { is_completed: i === 'i1' ? 1 : 0 })
      await inserer(d, 'blocs_seance', { ...base, id: `${i}-b`, seance_id: 's1', instance_seance_id: i, position: 0 })
      await inserer(d, 'exercices_seance', { ...base, id: `${i}-e`, seance_id: 's1', instance_seance_id: i, position: 0 })
      await serie(d, `${i}-s`, i, `${i}-e`, 1, 1)
    }
  }
  beforeEach(async () => {
    await semer(db)
  })

  it("supprime logiquement l'instance, ses blocs/exercices et ses séries ; modèle et autre instance intacts", async () => {
    const avant = await etat(db)
    await supprimerInstance(db, 'i1')
    expect(await supprimes(db)).toEqual(['i1', 'i1-b', 'i1-e', 'i1-s'])
    const apres = await etat(db)
    for (const t of TABLES) {
      for (const l of apres[t]) {
        if (l.deleted_at === null) expect(l).toEqual(avant[t].find((x) => x.id === l.id))
        else {
          expect(l.updated_at).toBe(l.deleted_at)
          expect(l.updated_at).not.toBe('u0')
        }
      }
    }
    // Aucune ligne n'a été retirée physiquement
    for (const t of TABLES) expect(apres[t]).toHaveLength(avant[t].length)
  })

  it('ne retouche pas les lignes déjà supprimées', async () => {
    await db.execute("UPDATE series_realisees SET deleted_at = 'avant', updated_at = 'avant' WHERE id = 'i2-s'")
    await supprimerInstance(db, 'i2')
    const l = await db.get<{ deleted_at: string; updated_at: string }>('SELECT deleted_at, updated_at FROM series_realisees WHERE id = ?', ['i2-s'])
    expect(l).toEqual({ deleted_at: 'avant', updated_at: 'avant' })
  })

  it('second appel et instance inconnue : erreur française, rien écrit', async () => {
    await supprimerInstance(db, 'i1')
    const apres1 = await etat(db)
    await expect(supprimerInstance(db, 'i1')).rejects.toThrow(/introuvable/i)
    await expect(supprimerInstance(db, 'nope')).rejects.toThrow(/introuvable/i)
    expect(await etat(db)).toEqual(apres1)
  })

  it('la suppression retire la séance du calendrier mais pas du reste', async () => {
    await supprimerInstance(db, 'i1')
    expect((await lireInstancesPlage(db, '2026-10-01', '2026-10-31')).map((v) => v.id)).toEqual(['i2'])
  })

  it('atomique : un échec à la Nième écriture annule tout', async () => {
    const enrobe = (reel: Db, surEcriture: () => void): Db => ({
      ...reel,
      writeTransaction: (fn) =>
        reel.writeTransaction((tx) => {
          const piege: DbTx = {
            ...tx,
            execute: async (sql, params) => {
              surEcriture()
              return tx.execute(sql, params)
            },
          }
          return fn(piege)
        }),
    })
    const avant = await etat(db)
    const jumelle = createTestDb()
    await semer(jumelle)
    let total = 0
    await supprimerInstance(enrobe(jumelle, () => { total += 1 }), 'i1')
    expect(total).toBeGreaterThan(2)
    for (let n = 1; n <= total; n++) {
      let vues = 0
      const piege = enrobe(db, () => {
        vues += 1
        if (vues === n) throw new Error('échec simulé')
      })
      await expect(supprimerInstance(piege, 'i1')).rejects.toThrow('échec simulé')
      expect(await etat(db)).toEqual(avant)
    }
  })
})
