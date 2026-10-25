import { beforeEach, describe, expect, it } from 'vitest'
import type { Db, DbTx } from '../../core/db/Db'
import { lireNomSeance } from '../../core/db/repos/seances'
import { inserer } from '../../test/fixtures'
import { createTestDb } from '../../test/sqliteDb'
import { compterHistorique, supprimerSeance, texteHistorique } from './suppression'

const TABLES = [
  'seances', 'blocs_seance', 'exercices_seance', 'objectifs_progression', 'instances_seance', 'series_realisees',
] as const
const base = { user_id: 'u1', updated_at: 'u0', deleted_at: null }

// Jeu de données : une séance (modèle + instance planifiée + instance réalisée + objectif).
async function semer(db: Db, p: string, nom: string) {
  await inserer(db, 'seances', { ...base, id: p, nom, is_archived: 0, created_at: 'c' })
  await inserer(db, 'blocs_seance', { ...base, id: `${p}-bt`, seance_id: p, instance_seance_id: null, position: 0 })
  await inserer(db, 'exercices_seance', { ...base, id: `${p}-et`, seance_id: p, instance_seance_id: null, position: 0 })
  await inserer(db, 'objectifs_progression', { ...base, id: `${p}-o`, seance_id: p, exercise_id: 'x' })
  for (const [suffixe, fait] of [['ip', 0], ['ic', 1]] as const) {
    const inst = `${p}-${suffixe}`
    await inserer(db, 'instances_seance', { ...base, id: inst, seance_id: p, date: '2026-10-01', is_completed: fait })
    await inserer(db, 'blocs_seance', { ...base, id: `${inst}-b`, seance_id: p, instance_seance_id: inst, position: 0 })
    await inserer(db, 'exercices_seance', { ...base, id: `${inst}-e`, seance_id: p, instance_seance_id: inst, position: 0 })
    await inserer(db, 'series_realisees', {
      ...base, id: `${inst}-s`, instance_seance_id: inst, exercice_seance_id: `${inst}-e`, numero_serie: 1, is_completed: fait,
    })
  }
}

type LigneEtat = { id: string; deleted_at: string | null; updated_at: string }
type Etat = Record<string, LigneEtat[]>
async function etat(db: Db): Promise<Etat> {
  const sortie: Etat = {}
  for (const t of TABLES) {
    sortie[t] = await db.getAll<LigneEtat>(`SELECT id, deleted_at, updated_at FROM ${t} ORDER BY id`)
  }
  return sortie
}
const supprimes = async (db: Db) =>
  Object.values(await etat(db)).flat().filter((l) => l.deleted_at !== null).map((l) => l.id).sort()

const PLANIFIE = ['s1', 's1-bt', 's1-et', 's1-o', 's1-ip', 's1-ip-b', 's1-ip-e', 's1-ip-s']
const REALISE = ['s1-ic', 's1-ic-b', 's1-ic-e', 's1-ic-s']

// Enrobe une base : appelle `surEcriture` avant chaque execute de la transaction.
function enrobe(reel: Db, surEcriture: () => void): Db {
  return {
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
  }
}

let db: Db
beforeEach(async () => {
  db = createTestDb()
  await semer(db, 's1', 'Pull')
  await semer(db, 's2', 'Push')
})

async function secondeIntacte(avant: Etat) {
  const apres = await etat(db)
  for (const t of TABLES) {
    expect(apres[t].filter((l) => l.id.startsWith('s2'))).toEqual(avant[t].filter((l) => l.id.startsWith('s2')))
  }
}

describe('compterHistorique', () => {
  it('compte les instances vivantes planifiées et réalisées de la séance', async () => {
    expect(await compterHistorique(db, 's1')).toEqual({ planifiees: 1, realisees: 1 })
    await inserer(db, 'instances_seance', { ...base, id: 'i3', seance_id: 's1', date: 'd', is_completed: 0 })
    await inserer(db, 'instances_seance', { ...base, id: 'i4', seance_id: 's1', date: 'd', is_completed: 1, deleted_at: 'x' })
    expect(await compterHistorique(db, 's1')).toEqual({ planifiees: 2, realisees: 1 })
    expect(await compterHistorique(db, 'inconnue')).toEqual({ planifiees: 0, realisees: 0 })
  })
})

describe('texteHistorique', () => {
  it('accorde le pluriel', () => {
    expect(texteHistorique({ planifiees: 1, realisees: 2 })).toBe(
      '1 séance programmée et 2 séances terminées liées à cette séance type',
    )
    expect(texteHistorique({ planifiees: 0, realisees: 1 })).toBe(
      '0 séance programmée et 1 séance terminée liées à cette séance type',
    )
  })
})

describe('supprimerSeance — garder_historique', () => {
  it("supprime logiquement modèle, objectifs, instances planifiées et leurs lignes ; garde l'historique", async () => {
    const avant = await etat(db)
    await supprimerSeance(db, 's1', 'garder_historique')
    expect(await supprimes(db)).toEqual([...PLANIFIE].sort())
    const apres = await etat(db)
    for (const t of TABLES) {
      for (const ligne of apres[t]) {
        if (ligne.deleted_at === null) {
          // lignes conservées : strictement inchangées (updated_at compris)
          expect(ligne).toEqual(avant[t].find((l) => l.id === ligne.id))
        } else {
          // tombstone à synchroniser : updated_at rafraîchi
          expect(ligne.updated_at).toBe(ligne.deleted_at)
          expect(ligne.updated_at).not.toBe('u0')
        }
      }
    }
  })

  it('laisse la seconde séance intacte', async () => {
    const avant = await etat(db)
    await supprimerSeance(db, 's1', 'garder_historique')
    await secondeIntacte(avant)
  })
})

describe('supprimerSeance — tout', () => {
  it('supprime aussi les instances réalisées, leurs lignes et leurs séries', async () => {
    await supprimerSeance(db, 's1', 'tout')
    expect(await supprimes(db)).toEqual([...PLANIFIE, ...REALISE].sort())
  })

  it('laisse la seconde séance intacte', async () => {
    const avant = await etat(db)
    await supprimerSeance(db, 's1', 'tout')
    await secondeIntacte(avant)
  })
})

describe('supprimerSeance — robustesse', () => {
  it('ne rafraîchit pas updated_at des lignes déjà supprimées', async () => {
    await db.execute("UPDATE blocs_seance SET deleted_at = 'avant', updated_at = 'avant' WHERE id = 's1-bt'")
    await supprimerSeance(db, 's1', 'tout')
    const l = await db.get<{ deleted_at: string; updated_at: string }>(
      'SELECT deleted_at, updated_at FROM blocs_seance WHERE id = ?', ['s1-bt'],
    )
    expect(l).toEqual({ deleted_at: 'avant', updated_at: 'avant' })
  })

  it.each(['garder_historique', 'tout'] as const)(
    'mode %s : un second appel est refusé (séance déjà supprimée) et ne change rien',
    async (mode) => {
      await supprimerSeance(db, 's1', mode)
      const apres1 = await etat(db)
      await expect(supprimerSeance(db, 's1', mode)).rejects.toThrow(/introuvable/i)
      expect(await etat(db)).toEqual(apres1)
    },
  )

  it("séance inconnue : erreur française et rien d'écrit", async () => {
    const avant = await etat(db)
    await expect(supprimerSeance(db, 'nope', 'tout')).rejects.toThrow(/introuvable/i)
    expect(await etat(db)).toEqual(avant)
  })

  it.each(['garder_historique', 'tout'] as const)(
    'mode %s atomique : un échec à la Nième écriture annule tout',
    async (mode) => {
      const avant = await etat(db)
      // Nombre d'écritures d'un passage réussi, mesuré sur une base jumelle
      const jumelle = createTestDb()
      await semer(jumelle, 's1', 'Pull')
      let total = 0
      await supprimerSeance(enrobe(jumelle, () => { total += 1 }), 's1', mode)
      expect(total).toBeGreaterThan(3)

      for (let n = 1; n <= total; n++) {
        let vues = 0
        const piege = enrobe(db, () => {
          vues += 1
          if (vues === n) throw new Error('échec simulé')
        })
        await expect(supprimerSeance(piege, 's1', mode)).rejects.toThrow('échec simulé')
        expect(await etat(db)).toEqual(avant)
      }
    },
  )
})

describe('lireNomSeance', () => {
  it("renvoie le nom même si la séance est supprimée, null si elle n'a jamais existé", async () => {
    expect(await lireNomSeance(db, 's1')).toBe('Pull')
    await supprimerSeance(db, 's1', 'garder_historique')
    expect(await lireNomSeance(db, 's1')).toBe('Pull')
    expect(await lireNomSeance(db, 'jamais')).toBeNull()
  })
})
