import { describe, expect, it } from 'vitest'
import { dateIsoValide } from '../../../core/common/dates'
import { creer } from '../../../core/db/repos/seancesCardio'
import { createTestDb } from '../../../test/sqliteDb'
import programme from './programme2027.json'

// Nombre d'entrées du fichier versionné, fixé à la génération (114 dans le HTML, moins le doublon du Ravensberg de la semaine 12).
// Si le programme change, relancer `node scripts/extraire-programme-2027.mjs` et mettre ce nombre à jour en le relisant.
const NB_ENTREES = 113

describe('programme2027.json', () => {
  it(`contient ${NB_ENTREES} entrées`, () => {
    expect(programme).toHaveLength(NB_ENTREES)
  })

  it('a des clés uniques de la forme w{semaine}|e{rang}', () => {
    const cles = programme.map((e) => e.cle)
    expect(new Set(cles).size).toBe(cles.length)
    for (const cle of cles) expect(cle, cle).toMatch(/^w\d+\|e\d+$/)
  })

  it('a des dates réelles, dans l’intervalle du 2 novembre 2026 au 6 juin 2027, en ordre croissant', () => {
    const dates = programme.map((e) => e.date)
    for (const date of dates) {
      expect(dateIsoValide(date), date).toBe(true)
      expect(date >= '2026-11-02' && date <= '2027-06-06', date).toBe(true)
    }
    expect([...dates].sort()).toEqual(dates)
  })

  it('a des genres valides', () => {
    for (const e of programme) expect(['course', 'velo'], e.cle).toContain(e.genre)
    expect(programme.filter((e) => e.genre === 'course')).toHaveLength(63)
    expect(programme.filter((e) => e.genre === 'velo')).toHaveLength(50)
  })

  it('a au plus 4 séances par semaine, et aucune en semaine 12 (le doublon du Ravensberg est retiré)', () => {
    const parSemaine = new Map<string, number>()
    for (const e of programme) {
      const semaine = e.cle.split('|')[0]
      parSemaine.set(semaine, (parSemaine.get(semaine) ?? 0) + 1)
    }
    for (const [semaine, nb] of parSemaine) expect(nb, semaine).toBeLessThanOrEqual(4)
    expect(parSemaine.has('w12')).toBe(false)
  })

  it('a exactement trois jalons : un seul Ravensberg (31 janvier 2027), Pi Marathon (14 mars) et Lille-Hardelot (6 juin, en vélo)', () => {
    expect(programme.filter((e) => e.jalon).map((e) => `${e.date}:${e.genre}:${e.jalon}`)).toEqual([
      '2027-01-31:course:Ravensberg', '2027-03-14:course:Pi Marathon', '2027-06-06:velo:Lille-Hardelot',
    ])
  })

  it('a 7 séances optionnelles', () => {
    expect(programme.filter((e) => e.optionnelle).map((e) => `${e.date} ${e.titre}`)).toEqual([
      '2026-11-07 Vélo de reprise', '2027-01-09 Vélo souple', '2027-01-16 Vélo facile', '2027-03-11 Vélo facile',
      '2027-03-18 Footing entretien', '2027-04-29 Footing entretien', '2027-05-29 Footing entretien',
    ])
  })

  it('garde le détail « durée · zone » non découpé', () => {
    const rav = programme.find((e) => e.jalon === 'Ravensberg')
    expect(rav?.detail).toBe('10 km · endurance fondamentale')
    expect(programme.every((e) => e.detail === null || e.detail.includes(' · '))).toBe(true)
  })

  it('passe la validation du module d’accès aux données : aucune entrée ne sera rejetée à l’import', async () => {
    const db = createTestDb()
    for (const e of programme) {
      await creer(db, e.genre as 'course' | 'velo', {
        id: e.cle, date: e.date, titre: e.titre, consigne: e.consigne, detail: e.detail, optionnelle: e.optionnelle, jalon: e.jalon,
      })
    }
    const lignes = await db.getAll<{ n: number }>('SELECT (SELECT count(*) FROM seances_course) + (SELECT count(*) FROM seances_velo) AS n')
    expect(lignes[0].n).toBe(NB_ENTREES)
  })
})
