import { describe, expect, it } from 'vitest'
import { inserer } from '../../test/fixtures'
import { createTestDb } from '../../test/sqliteDb'
import { ErreurSeance } from './affectation'
import { assignerDates, datesDuFormulaire, datesRecurrence, formulaireInitial, MAX_OCCURRENCES } from './planification'

const base = { user_id: 'u1', updated_at: 'u0', deleted_at: null }
async function monde() {
  const db = createTestDb()
  await inserer(db, 'seances', { ...base, id: 's1', nom: 'Pull', seance_category: 'STRENGTH', created_at: 'c', is_archived: 0 })
  await inserer(db, 'exercices_seance', { ...base, id: 'e1', seance_id: 's1', instance_seance_id: null, exercise_id: 'x', position: 0 })
  return db
}

describe('datesRecurrence', () => {
  it('N occurrences toutes les 2 semaines', () => {
    expect(datesRecurrence({ debut: '2026-10-26', pas: 2, unite: 'semaine', fin: { type: 'occurrences', n: 3 } })).toEqual([
      '2026-10-26', '2026-11-09', '2026-11-23',
    ])
  })

  it("jusqu'à une date (incluse) ; un mois vaut 30 jours, comme sur Android", () => {
    expect(datesRecurrence({ debut: '2026-10-30', pas: 1, unite: 'jour', fin: { type: 'date', date: '2026-11-02' } })).toEqual([
      '2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02',
    ])
    expect(datesRecurrence({ debut: '2026-01-01', pas: 1, unite: 'mois', fin: { type: 'occurrences', n: 2 } })).toEqual(['2026-01-01', '2026-01-31'])
  })

  it('sans fin : plafond par unité (365 jours, 52 semaines, 12 mois)', () => {
    expect(datesRecurrence({ debut: '2026-01-01', pas: 1, unite: 'jour', fin: { type: 'jamais' } })).toHaveLength(365)
    expect(datesRecurrence({ debut: '2026-01-01', pas: 1, unite: 'semaine', fin: { type: 'jamais' } })).toHaveLength(52)
    expect(datesRecurrence({ debut: '2026-01-01', pas: 1, unite: 'mois', fin: { type: 'jamais' } })).toHaveLength(12)
  })

  it('date de fin avant le début : une seule séance (le début)', () => {
    expect(datesRecurrence({ debut: '2026-10-26', pas: 1, unite: 'jour', fin: { type: 'date', date: '2026-10-01' } })).toEqual(['2026-10-26'])
  })

  it('refuse les paramètres invalides', () => {
    const f = (o: Partial<Parameters<typeof datesRecurrence>[0]>) =>
      datesRecurrence({ debut: '2026-10-26', pas: 1, unite: 'jour', fin: { type: 'occurrences', n: 2 }, ...o })
    expect(() => f({ debut: '2026-02-30' })).toThrow(ErreurSeance)
    expect(() => f({ pas: 0 })).toThrow('Répétition invalide')
    expect(() => f({ pas: 1.5 })).toThrow(ErreurSeance)
    expect(() => f({ fin: { type: 'occurrences', n: 0 } })).toThrow(ErreurSeance)
    expect(() => f({ fin: { type: 'occurrences', n: MAX_OCCURRENCES + 1 } })).toThrow(ErreurSeance)
    expect(() => f({ fin: { type: 'date', date: 'abc' } })).toThrow(ErreurSeance)
  })
})

describe('assignerDates', () => {
  it("crée une instance par date distincte, sans copier les exercices (copie à l'exécution)", async () => {
    const db = await monde()
    const ids = await assignerDates(db, 's1', ['2026-11-03', '2026-11-01', '2026-11-03'])
    expect(ids).toHaveLength(2)
    const l = await db.getAll<{ date: string; seance_id: string; is_completed: number }>(
      'SELECT date, seance_id, is_completed FROM instances_seance ORDER BY date',
    )
    expect(l).toEqual([
      { date: '2026-11-01', seance_id: 's1', is_completed: 0 },
      { date: '2026-11-03', seance_id: 's1', is_completed: 0 },
    ])
    const n = await db.get<{ n: number }>('SELECT COUNT(*) AS n FROM exercices_seance WHERE instance_seance_id IS NOT NULL')
    expect(n.n).toBe(0)
  })

  it("tout ou rien : une date invalide ou une séance introuvable n'écrit rien", async () => {
    const db = await monde()
    await expect(assignerDates(db, 's1', ['2026-11-03', '2026-02-30'])).rejects.toThrow(ErreurSeance)
    await expect(assignerDates(db, 'nope', ['2026-11-03'])).rejects.toThrow('Séance introuvable.')
    await expect(assignerDates(db, 's1', [])).rejects.toThrow('Choisissez au moins une date.')
    expect((await db.get<{ n: number }>('SELECT COUNT(*) AS n FROM instances_seance')).n).toBe(0)
  })
})

describe('datesDuFormulaire', () => {
  const f = formulaireInitial('2026-10-26')

  it('une date : la date saisie ; date invalide refusée', () => {
    expect(datesDuFormulaire({ ...f, mode: 'une', date: '2026-11-03' })).toEqual(['2026-11-03'])
    expect(() => datesDuFormulaire({ ...f, mode: 'une', date: '' })).toThrow('Date invalide')
    expect(() => datesDuFormulaire({ ...f, mode: 'une', date: '2026-02-30' })).toThrow(ErreurSeance)
  })

  it("plusieurs dates : la liste choisie (la date en cours de saisie n'en fait pas partie)", () => {
    expect(datesDuFormulaire({ ...f, mode: 'plusieurs', date: '2026-12-01', dates: ['2026-11-03', '2026-11-10'] })).toEqual([
      '2026-11-03', '2026-11-10',
    ])
    expect(() => datesDuFormulaire({ ...f, mode: 'plusieurs', dates: [] })).toThrow('Ajoutez au moins une date.')
  })

  it('répétition : valeurs par défaut = toutes les semaines, 8 séances (Android afterNCount = 8)', () => {
    expect(f).toMatchObject({ mode: 'une', date: '2026-10-26', pas: '1', unite: 'semaine', fin: 'occurrences', occurrences: '8' })
    expect(datesDuFormulaire({ ...f, mode: 'repeter' })).toHaveLength(8)
    const d = datesDuFormulaire({ ...f, mode: 'repeter', pas: '2', unite: 'jour', fin: 'date', dateFin: '2026-10-30' })
    expect(d).toEqual(['2026-10-26', '2026-10-28', '2026-10-30'])
    expect(() => datesDuFormulaire({ ...f, mode: 'repeter', pas: '' })).toThrow('Répétition invalide')
    expect(() => datesDuFormulaire({ ...f, mode: 'repeter', occurrences: 'abc' })).toThrow('Nombre de séances invalide')
  })
})
