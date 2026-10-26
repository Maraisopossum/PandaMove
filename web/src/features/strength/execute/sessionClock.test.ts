import { describe, expect, it, vi } from 'vitest'
import { clockFromRow, clockToRow, elapsedMs, type SessionClock } from './sessionClock'

const T0 = Date.parse('2026-10-24T10:00:00.000Z')
const min = (n: number) => n * 60_000

describe('elapsedMs', () => {
  it('vaut 0 tant que la séance n\'est pas démarrée', () => {
    expect(elapsedMs({ startedAtMs: null, pauses: [] }, T0)).toBe(0)
  })

  it('compte le temps depuis le démarrage sans pause', () => {
    expect(elapsedMs({ startedAtMs: T0, pauses: [] }, T0 + min(12))).toBe(min(12))
  })

  it('exclut une pause fermée', () => {
    const c: SessionClock = { startedAtMs: T0, pauses: [{ fromMs: T0 + min(5), toMs: T0 + min(8) }] }
    expect(elapsedMs(c, T0 + min(20))).toBe(min(17))
  })

  it('exclut une pause encore ouverte jusqu\'à maintenant (le temps est figé)', () => {
    const c: SessionClock = { startedAtMs: T0, pauses: [{ fromMs: T0 + min(10), toMs: null }] }
    expect(elapsedMs(c, T0 + min(15))).toBe(min(10))
    expect(elapsedMs(c, T0 + min(40))).toBe(min(10))
  })

  it('exclut plusieurs pauses (fermées et ouverte)', () => {
    const c: SessionClock = {
      startedAtMs: T0,
      pauses: [
        { fromMs: T0 + min(2), toMs: T0 + min(3) },
        { fromMs: T0 + min(10), toMs: T0 + min(14) },
        { fromMs: T0 + min(30), toMs: null },
      ],
    }
    // 30 min de séance - 1 - 4 = 25, puis figé
    expect(elapsedMs(c, T0 + min(45))).toBe(min(25))
  })

  it('ne compte pas deux fois des pauses qui se chevauchent', () => {
    const c: SessionClock = {
      startedAtMs: T0,
      pauses: [
        { fromMs: T0 + min(5), toMs: T0 + min(10) },
        { fromMs: T0 + min(8), toMs: T0 + min(12) },
      ],
    }
    expect(elapsedMs(c, T0 + min(20))).toBe(min(13))
  })

  it('ne devient jamais négatif si l\'horloge recule avant le démarrage', () => {
    expect(elapsedMs({ startedAtMs: T0, pauses: [] }, T0 - min(5))).toBe(0)
  })

  it('reste cohérent si une pause est datée dans le futur (horloge reculée)', () => {
    const c: SessionClock = { startedAtMs: T0, pauses: [{ fromMs: T0 + min(30), toMs: null }] }
    // Maintenant (10 min) est avant le début de la pause : la pause ne retire rien
    expect(elapsedMs(c, T0 + min(10))).toBe(min(10))
    // Pause fermée avant son début (incohérente) : ignorée
    expect(elapsedMs({ startedAtMs: T0, pauses: [{ fromMs: T0 + min(5), toMs: T0 + min(2) }] }, T0 + min(10))).toBe(min(10))
  })
})

describe('clockFromRow / clockToRow', () => {
  it('convertit ISO <-> epoch ms et relit les pauses', () => {
    const c: SessionClock = { startedAtMs: T0, pauses: [{ fromMs: T0 + 1000, toMs: T0 + 5000 }, { fromMs: T0 + 9000, toMs: null }] }
    const ligne = clockToRow(c)
    expect(ligne.started_at).toBe('2026-10-24T10:00:00.000Z')
    expect(JSON.parse(ligne.paused_json)).toEqual(c.pauses)
    expect(clockFromRow(ligne)).toEqual(c)
  })

  it('une séance non démarrée donne started_at null', () => {
    expect(clockToRow({ startedAtMs: null, pauses: [] })).toEqual({ started_at: null, paused_json: '[]' })
    expect(clockFromRow({ started_at: null, paused_json: null })).toEqual({ startedAtMs: null, pauses: [] })
  })

  it('un JSON de pauses malformé est lu comme « aucune pause », sans exception', () => {
    expect(clockFromRow({ started_at: '2026-10-24T10:00:00.000Z', paused_json: '{pas du json' })).toEqual({
      startedAtMs: T0,
      pauses: [],
    })
    expect(clockFromRow({ started_at: null, paused_json: '{"fromMs":1}' }).pauses).toEqual([])
    // Éléments invalides écartés, valides conservés
    expect(
      clockFromRow({ started_at: null, paused_json: '[{"fromMs":1,"toMs":2},{"fromMs":"x"},null,{"fromMs":3,"toMs":null}]' }).pauses,
    ).toEqual([{ fromMs: 1, toMs: 2 }, { fromMs: 3, toMs: null }])
  })

  it('une date de démarrage illisible est traitée comme non démarrée', () => {
    expect(clockFromRow({ started_at: 'n importe quoi', paused_json: '[]' }).startedAtMs).toBeNull()
  })

  it("lit started_at au format Postgres / PowerSync même quand Date.parse échoue (Safari / iOS)", () => {
    const safari = vi.spyOn(Date, 'parse').mockReturnValue(Number.NaN)
    try {
      expect(clockFromRow({ started_at: '2026-10-24 10:00:00.123456+00', paused_json: null }).startedAtMs).toBe(
        Date.UTC(2026, 9, 24, 10, 0, 0, 123),
      )
    } finally {
      safari.mockRestore()
    }
  })
})
