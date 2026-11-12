import { describe, expect, it } from 'vitest'
import { dateIsoValide } from '../../../core/common/dates'
import { creer } from '../../../core/db/repos/seancesCardio'
import { createTestDb } from '../../../test/sqliteDb'
import programme from './programme2027.json'

// Programme v2 (intervals.icu, 124 séances, semaines 1 à 31), généré depuis INDEX_seances.csv et les fichiers .txt de
// PandaMove_seances_Intervals_icu_v2 : le fichier ne donne que le lundi de chaque semaine, les jours sont posés ainsi
// (course mardi / jeudi / samedi, vélo mercredi / samedi / vendredi, sortie longue et jalon le dimanche).
const NB_ENTREES = 124

describe('programme2027.json (version 2)', () => {
  it(`contient ${NB_ENTREES} entrées`, () => {
    expect(programme).toHaveLength(NB_ENTREES)
  })

  it('a des clés uniques de la forme v2|s{semaine}|e{rang}, distinctes de celles du premier programme (w{semaine}|e{rang})', () => {
    const cles = programme.map((e) => e.cle)
    expect(new Set(cles).size).toBe(cles.length)
    for (const cle of cles) expect(cle, cle).toMatch(/^v2\|s\d+\|e\d+$/)
  })

  it('a des dates réelles, dans l’intervalle du 3 novembre 2026 au 6 juin 2027, en ordre croissant', () => {
    const dates = programme.map((e) => e.date)
    for (const date of dates) {
      expect(dateIsoValide(date), date).toBe(true)
      expect(date >= '2026-11-03' && date <= '2027-06-06', date).toBe(true)
    }
    expect([...dates].sort()).toEqual(dates)
  })

  it('a des genres valides, 60 courses et 64 vélos', () => {
    for (const e of programme) expect(['course', 'velo'], e.cle).toContain(e.genre)
    expect(programme.filter((e) => e.genre === 'course')).toHaveLength(60)
    expect(programme.filter((e) => e.genre === 'velo')).toHaveLength(64)
  })

  it('ne met jamais deux séances du même sport le même jour', () => {
    const vus = new Set<string>()
    for (const e of programme) {
      const cle = `${e.date}|${e.genre}`
      expect(vus.has(cle), cle).toBe(false)
      vus.add(cle)
    }
  })

  it('a exactement trois jalons, tous le dimanche : Ravensberg (31 janvier 2027), Pi Marathon (14 mars) et Lille-Hardelot (6 juin, en vélo)', () => {
    expect(programme.filter((e) => e.jalon).map((e) => `${e.date}:${e.genre}:${e.jalon}`)).toEqual([
      '2027-01-31:course:Ravensberg', '2027-03-14:course:Pi Marathon', '2027-06-06:velo:Lille-Hardelot',
    ])
    for (const e of programme.filter((x) => x.jalon)) expect(new Date(`${e.date}T00:00:00Z`).getUTCDay(), e.cle).toBe(0)
  })

  it('a 4 séances optionnelles, retirées du titre', () => {
    expect(programme.filter((e) => e.optionnelle)).toHaveLength(4)
    for (const e of programme) expect(e.titre, e.cle).not.toContain('(option)')
  })

  it('porte les étapes intervals.icu dans la consigne, dans la limite de 2000 caractères, et la durée annoncée en détail', () => {
    for (const e of programme) {
      expect(e.consigne, e.cle).toContain('Étapes (intervals.icu) :')
      expect((e.consigne as string).length, e.cle).toBeLessThanOrEqual(2000)
      expect(e.detail, e.cle).toMatch(/^\d+ min$/)
    }
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
