import { beforeEach, describe, expect, it } from 'vitest'
import type { Db, DbTx } from '../../core/db/Db'
import { creer, definirValidation, type GenreCardio, lireParId } from '../../core/db/repos/seancesCardio'
import { inserer } from '../../test/fixtures'
import { createTestDb } from '../../test/sqliteDb'
import {
  creerSeanceCardio, deplacerEvenement, deplacerInstance, ErreurCalendrier, lireEvenementsPlage, lireEvenementsProchains,
  lireInstancesPlage, lireProchaines, modifierSeanceCardio, supprimerEvenement, supprimerInstance, validerEvenement,
} from './calendrier'
import type { EvenementAgenda } from './types'

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

// ── Agenda à trois sources : renforcement, course, vélo ──
describe('agenda à trois sources', () => {
  const seanceCardio = (genre: GenreCardio, date: string, id?: string, titre = 'Footing facile') => creer(db, genre, { id, date, titre })
  const evenement = async (plage: [string, string], id: string): Promise<EvenementAgenda> => {
    const trouve = (await lireEvenementsPlage(db, plage[0], plage[1])).find((e) => e.id === id)
    if (!trouve) throw new Error(`événement ${id} absent`)
    return trouve
  }
  const NOVEMBRE: [string, string] = ['2026-11-01', '2026-11-30']

  describe('lireEvenementsPlage', () => {
    it('fusionne les trois sources, triées par jour puis genre (renforcement, course, vélo) puis identifiant', async () => {
      await seance(db, 's1', 'Pull')
      await instance(db, 'r2', 's1', '2026-11-03')
      await instance(db, 'r1', 's1', '2026-11-03')
      await seanceCardio('velo', '2026-11-03', 'v1')
      await seanceCardio('course', '2026-11-03', 'c2')
      await seanceCardio('course', '2026-11-03', 'c1')
      await seanceCardio('course', '2026-11-02', 'c0')
      const lus = await lireEvenementsPlage(db, '2026-11-01', '2026-11-30')
      expect(lus.map((e) => `${e.dateIso}:${e.genre}:${e.id}`)).toEqual([
        '2026-11-02:course:c0', '2026-11-03:renfo:r1', '2026-11-03:renfo:r2', '2026-11-03:course:c1', '2026-11-03:course:c2',
        '2026-11-03:velo:v1',
      ])
    })

    it('ne garde que la plage (bornes comprises), hors séances supprimées, validées comprises', async () => {
      await seanceCardio('course', '2026-10-31', 'avant')
      await seanceCardio('course', '2026-11-01', 'debut')
      await seanceCardio('velo', '2026-11-30', 'fin')
      await seanceCardio('velo', '2026-12-01', 'apres')
      await seanceCardio('course', '2026-11-10', 'sup')
      await seanceCardio('velo', '2026-11-11', 'val')
      await db.execute("UPDATE seances_course SET deleted_at = 'x' WHERE id = 'sup'")
      await definirValidation(db, 'velo', 'val', true)
      const lus = await lireEvenementsPlage(db, '2026-11-01', '2026-11-30')
      expect(lus.map((e) => e.id)).toEqual(['debut', 'val', 'fin'])
      expect(lus.find((e) => e.id === 'val')?.etat).toBe('terminee')
    })

    it("le renforcement garde tous ses champs (instance d'origine)", async () => {
      await seance(db, 's1', 'Pull')
      await instance(db, 'a', 's1', '2026-11-03', { is_completed: 1, duration_seconds: 3000 })
      const [e] = await lireEvenementsPlage(db, '2026-11-01', '2026-11-30')
      expect(e).toMatchObject({ genre: 'renfo', titre: 'Pull', etat: 'terminee' })
      expect(e.genre === 'renfo' && e.instance).toMatchObject({ id: 'a', seanceId: 's1', dureeSec: 3000 })
    })

    it('base vide : aucune exception', async () => {
      expect(await lireEvenementsPlage(db, '2026-11-01', '2026-11-30')).toEqual([])
    })
  })

  describe('lireEvenementsProchains', () => {
    it('limite après fusion : 10 de chaque source suffisent pour obtenir les 10 premiers au total', async () => {
      await seance(db, 's1', 'Pull')
      for (let i = 0; i < 10; i++) await instance(db, `r${String(i).padStart(2, '0')}`, 's1', `2026-12-${String(10 + i).padStart(2, '0')}`)
      for (let i = 0; i < 10; i++) await seanceCardio('course', `2026-11-${String(10 + i).padStart(2, '0')}`, `c${String(i).padStart(2, '0')}`)
      for (let i = 0; i < 10; i++) await seanceCardio('velo', `2026-11-${String(10 + i).padStart(2, '0')}`, `v${String(i).padStart(2, '0')}`)
      const prochaines = await lireEvenementsProchains(db, '2026-11-01', 10)
      expect(prochaines).toHaveLength(10)
      expect(prochaines.every((e) => e.genre !== 'renfo')).toBe(true)
      expect(prochaines.map((e) => `${e.dateIso}:${e.genre}`).slice(0, 4)).toEqual([
        '2026-11-10:course', '2026-11-10:velo', '2026-11-11:course', '2026-11-11:velo',
      ])
    })

    it('exclut les séances terminées et validées, garde le renforcement en cours', async () => {
      await seance(db, 's1', 'Pull')
      await instance(db, 'cours', 's1', '2026-11-05', { started_at: '2026-11-05T08:00:00.000Z' })
      await instance(db, 'faite', 's1', '2026-11-06', { is_completed: 1 })
      await seanceCardio('course', '2026-11-07', 'validee')
      await definirValidation(db, 'course', 'validee', true)
      await seanceCardio('velo', '2026-11-08', 'ouverte')
      const prochaines = await lireEvenementsProchains(db, '2026-11-01', 10)
      expect(prochaines.map((e) => e.id)).toEqual(['cours', 'ouverte'])
      expect(prochaines[0]).toMatchObject({ genre: 'renfo', etat: 'en_cours' })
    })

    it("commence à aujourd'hui (compris)", async () => {
      await seanceCardio('course', '2026-10-31', 'hier')
      await seanceCardio('course', '2026-11-01', 'auj')
      expect((await lireEvenementsProchains(db, '2026-11-01', 10)).map((e) => e.id)).toEqual(['auj'])
    })
  })

  describe('deplacerEvenement', () => {
    it('déplace une séance de cardio', async () => {
      await seanceCardio('course', '2026-11-03', 'c1')
      await deplacerEvenement(db, await evenement(NOVEMBRE, 'c1'), '2026-11-05')
      expect(await lireParId(db, 'course', 'c1')).toMatchObject({ date: '2026-11-05' })
    })

    it('déplace une instance de renforcement (comportement inchangé)', async () => {
      await seance(db, 's1', 'Pull')
      await instance(db, 'p', 's1', '2026-11-03')
      await deplacerEvenement(db, await evenement(NOVEMBRE, 'p'), '2026-11-04')
      expect((await db.get<{ date: string }>("SELECT date FROM instances_seance WHERE id = 'p'")).date).toBe('2026-11-04')
    })

    it('refuse une séance validée avec le message du cardio, sans rien écrire', async () => {
      await seanceCardio('velo', '2026-11-03', 'v1')
      await definirValidation(db, 'velo', 'v1', true)
      const vue = await evenement(NOVEMBRE, 'v1')
      await expect(deplacerEvenement(db, vue, '2026-11-05')).rejects.toThrow('Dévalidez la séance pour la déplacer.')
      expect(await lireParId(db, 'velo', 'v1')).toMatchObject({ date: '2026-11-03', isValidated: true })
    })

    it("une validation arrivée entre l'affichage et le déplacement est détectée à l'écriture", async () => {
      await seanceCardio('course', '2026-11-03', 'c1')
      const affichee = await evenement(NOVEMBRE, 'c1') // vue « non validée »
      await db.execute("UPDATE seances_course SET is_validated = 1 WHERE id = 'c1'") // validée sur un autre appareil
      const erreur = await deplacerEvenement(db, affichee, '2026-11-05').then(() => null, (e: unknown) => e)
      expect(erreur).toBeInstanceOf(ErreurCalendrier)
      expect((erreur as Error).message).toBe('Dévalidez la séance pour la déplacer.')
    })

    it('après dévalidation, le déplacement est accepté', async () => {
      await seanceCardio('course', '2026-11-03', 'c1')
      await definirValidation(db, 'course', 'c1', true)
      await definirValidation(db, 'course', 'c1', false)
      await deplacerEvenement(db, await evenement(NOVEMBRE, 'c1'), '2026-11-05')
      expect(await lireParId(db, 'course', 'c1')).toMatchObject({ date: '2026-11-05' })
    })

    it.each(['2026-02-30', 'demain', ''])("date %j refusée pour le cardio, en erreur d'écran", async (date) => {
      await seanceCardio('course', '2026-11-03', 'c1')
      const vue = await evenement(NOVEMBRE, 'c1')
      await expect(deplacerEvenement(db, vue, date)).rejects.toBeInstanceOf(ErreurCalendrier)
      await expect(deplacerEvenement(db, vue, date)).rejects.toThrow(/date invalide/i)
      expect(await lireParId(db, 'course', 'c1')).toMatchObject({ date: '2026-11-03' })
    })

    it('une séance de cardio supprimée entre-temps : « introuvable »', async () => {
      await seanceCardio('course', '2026-11-03', 'c1')
      const vue = await evenement(NOVEMBRE, 'c1')
      await db.execute("UPDATE seances_course SET deleted_at = 'x' WHERE id = 'c1'")
      await expect(deplacerEvenement(db, vue, '2026-11-05')).rejects.toThrow(/introuvable/i)
    })

    it('une instance de renforcement terminée garde son message historique', async () => {
      await seance(db, 's1', 'Pull')
      await instance(db, 't', 's1', '2026-11-03', { is_completed: 1 })
      const vue = await evenement(NOVEMBRE, 't')
      await expect(deplacerEvenement(db, vue, '2026-11-05')).rejects.toThrow(/terminée.*statistiques/)
    })
  })

  describe('supprimerEvenement', () => {
    it('supprime logiquement une séance de cardio, validée ou non, sans toucher aux autres sources', async () => {
      await seance(db, 's1', 'Pull')
      await instance(db, 'p', 's1', '2026-11-03')
      await seanceCardio('course', '2026-11-03', 'c1')
      await seanceCardio('velo', '2026-11-03', 'v1')
      await definirValidation(db, 'velo', 'v1', true)
      await supprimerEvenement(db, await evenement(NOVEMBRE, 'c1'))
      await supprimerEvenement(db, await evenement(NOVEMBRE, 'v1'))
      expect((await lireEvenementsPlage(db, '2026-11-01', '2026-11-30')).map((e) => e.id)).toEqual(['p'])
      expect(await lireParId(db, 'course', 'c1')).toMatchObject({ supprimee: true })
    })

    it('supprime une instance de renforcement (comportement inchangé) et refuse une seconde suppression', async () => {
      await seance(db, 's1', 'Pull')
      await instance(db, 'p', 's1', '2026-11-03')
      const vue = await evenement(NOVEMBRE, 'p')
      await supprimerEvenement(db, vue)
      await expect(supprimerEvenement(db, vue)).rejects.toThrow(/introuvable/i)
    })

    it("une séance de cardio déjà supprimée : erreur d'écran « introuvable »", async () => {
      await seanceCardio('course', '2026-11-03', 'c1')
      const vue = await evenement(NOVEMBRE, 'c1')
      await supprimerEvenement(db, vue)
      await expect(supprimerEvenement(db, vue)).rejects.toBeInstanceOf(ErreurCalendrier)
    })
  })

  describe('validerEvenement', () => {
    it('valide puis dévalide une séance de cardio ; la validée passe à « terminée »', async () => {
      await seanceCardio('course', '2026-11-03', 'c1')
      const vue = await evenement(NOVEMBRE, 'c1')
      await validerEvenement(db, vue, true)
      expect((await evenement(NOVEMBRE, 'c1')).etat).toBe('terminee')
      await validerEvenement(db, vue, false)
      expect((await evenement(NOVEMBRE, 'c1')).etat).toBe('planifiee')
    })

    it("refuse une instance de renforcement (elle se termine en exécutant la séance)", async () => {
      await seance(db, 's1', 'Pull')
      await instance(db, 'p', 's1', '2026-11-03')
      const vue = await evenement(NOVEMBRE, 'p')
      await expect(validerEvenement(db, vue, true)).rejects.toBeInstanceOf(ErreurCalendrier)
    })

    it("une séance supprimée entre-temps : erreur d'écran « introuvable »", async () => {
      await seanceCardio('course', '2026-11-03', 'c1')
      const vue = await evenement(NOVEMBRE, 'c1')
      await db.execute("UPDATE seances_course SET deleted_at = 'x' WHERE id = 'c1'")
      await expect(validerEvenement(db, vue, true)).rejects.toThrow(/introuvable/i)
    })
  })

  describe('creerSeanceCardio et modifierSeanceCardio', () => {
    it('crée une séance et renvoie son identifiant', async () => {
      const id = await creerSeanceCardio(db, 'velo', { date: '2026-11-07', titre: 'Vélo de reprise', detail: '30 min · Z1–Z2' })
      expect(await lireParId(db, 'velo', id)).toMatchObject({ titre: 'Vélo de reprise', detail: '30 min · Z1–Z2', date: '2026-11-07' })
    })

    it("convertit les refus de validation en erreurs d'écran (message français), sans rien écrire", async () => {
      await expect(creerSeanceCardio(db, 'course', { date: '2026-02-30', titre: 'x' })).rejects.toBeInstanceOf(ErreurCalendrier)
      await expect(creerSeanceCardio(db, 'course', { date: '2026-11-03', titre: '  ' })).rejects.toThrow(/titre est obligatoire/i)
      expect(await lireEvenementsPlage(db, '2026-01-01', '2026-12-31')).toEqual([])
    })

    it("modifie les champs d'une séance de cardio et convertit « introuvable »", async () => {
      await seanceCardio('course', '2026-11-03', 'c1')
      const vue = await evenement(NOVEMBRE, 'c1')
      await modifierSeanceCardio(db, vue, { titre: 'Footing souple', optionnelle: true })
      expect(await lireParId(db, 'course', 'c1')).toMatchObject({ titre: 'Footing souple', optionnelle: true })
      await db.execute("UPDATE seances_course SET deleted_at = 'x' WHERE id = 'c1'")
      await expect(modifierSeanceCardio(db, vue, { titre: 'x' })).rejects.toBeInstanceOf(ErreurCalendrier)
    })

    it('refuse de modifier une instance de renforcement par cette voie', async () => {
      await seance(db, 's1', 'Pull')
      await instance(db, 'p', 's1', '2026-11-03')
      const vue = await evenement(NOVEMBRE, 'p')
      await expect(modifierSeanceCardio(db, vue, { titre: 'x' })).rejects.toBeInstanceOf(ErreurCalendrier)
    })
  })
})
