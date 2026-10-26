import { describe, expect, it } from 'vitest'
import { choisirSeanceActive, titreOnglet, type LigneActive } from './seanceActive'

const T = Date.parse('2026-10-24T12:00:00.000Z')
const ligne = (id: string, startedAt: string | null, extra: Partial<LigneActive> = {}): LigneActive => ({
  id, nom: `Séance ${id}`, started_at: startedAt, paused_json: null, ...extra,
})

describe('choisirSeanceActive : la séance démarrée et non terminée à reprendre', () => {
  it('la plus récemment démarrée', () => {
    const r = choisirSeanceActive([ligne('a', '2026-10-24T10:00:00.000Z'), ligne('b', '2026-10-24T11:00:00.000Z')], T)
    expect(r?.id).toBe('b')
  })

  it('ignore une séance jamais démarrée', () => {
    expect(choisirSeanceActive([ligne('a', null)], T)).toBeNull()
  })

  it('ignore une séance démarrée il y a plus de 24 h (oubliée)', () => {
    expect(choisirSeanceActive([ligne('a', '2026-10-23T11:59:00.000Z')], T)).toBeNull()
    expect(choisirSeanceActive([ligne('a', '2026-10-23T12:01:00.000Z')], T)?.id).toBe('a')
  })

  it('lit un horodatage synchronisé au format Postgres', () => {
    expect(choisirSeanceActive([ligne('a', '2026-10-24 10:00:00+00')], T)?.id).toBe('a')
  })

  it('expose le temps écoulé hors pauses', () => {
    const r = choisirSeanceActive([ligne('a', '2026-10-24T10:00:00.000Z', { paused_json: JSON.stringify([{ fromMs: Date.parse('2026-10-24T10:30:00.000Z'), toMs: Date.parse('2026-10-24T11:00:00.000Z') }]) })], T)
    expect(r?.horloge.pauses).toHaveLength(1)
  })

  it('liste vide : aucune', () => {
    expect(choisirSeanceActive([], T)).toBeNull()
  })
})

describe('titreOnglet : titre de l’onglet pendant la séance', () => {
  const base = { nomSeance: 'Haut du corps', chrono: '12:34', repos: null as string | null, enPause: false, termine: false, demarre: true }

  it('chrono et nom de la séance', () => {
    expect(titreOnglet(base)).toBe('12:34 · Haut du corps · PandaMove')
  })

  it('le repos en cours passe en tête', () => {
    expect(titreOnglet({ ...base, repos: '01:05' })).toBe('Repos 01:05 · 12:34 · Haut du corps · PandaMove')
  })

  it('en pause', () => {
    expect(titreOnglet({ ...base, enPause: true })).toBe('En pause · Haut du corps · PandaMove')
  })

  it('pas encore démarrée, ou terminée : le nom seul', () => {
    expect(titreOnglet({ ...base, demarre: false })).toBe('Haut du corps · PandaMove')
    expect(titreOnglet({ ...base, termine: true })).toBe('Haut du corps · PandaMove')
  })
})
