import { describe, expect, it } from 'vitest'
import type { EvenementAgenda } from '../calendar/types'
import { construireSemaine, bornesSemaine, libelleJour, lundiDe } from './semaine'

const ev = (dateIso: string, etat: EvenementAgenda['etat'], id = dateIso + etat): EvenementAgenda => ({
  id, genre: 'renfo', dateIso, titre: 'Séance', etat,
  instance: { id, seanceId: 's', nom: 'Séance', dateIso, etat },
})

describe('lundiDe / bornesSemaine', () => {
  it.each([
    ['2026-11-05', '2026-11-02'], // jeudi
    ['2026-11-02', '2026-11-02'], // lundi
    ['2026-11-08', '2026-11-02'], // dimanche
    ['2026-03-30', '2026-03-30'], // lundi du changement d'heure
    ['2026-03-29', '2026-03-23'], // dimanche du changement d'heure
  ])('%s -> lundi %s', (date, lundi) => expect(lundiDe(date)).toBe(lundi))

  it('semaine du lundi au dimanche, à cheval sur deux mois', () => {
    expect(bornesSemaine('2026-10-29')).toEqual({ debut: '2026-10-26', fin: '2026-11-01' })
  })
})

describe('construireSemaine', () => {
  it('sept jours dans l’ordre L M M J V S D avec le jour courant marqué', () => {
    const s = construireSemaine('2026-11-05', [])
    expect(s.jours.map((j) => j.lettre).join('')).toBe('LMMJVSD')
    expect(s.jours.map((j) => j.dateIso)[0]).toBe('2026-11-02')
    expect(s.jours.filter((j) => j.estAujourdhui).map((j) => j.dateIso)).toEqual(['2026-11-05'])
    expect(s.total).toBe(0)
    expect(s.jours.every((j) => j.etat === 'repos')).toBe(true)
  })

  it('fait / prévu / manqué / repos, et le compte terminées sur total', () => {
    const s = construireSemaine('2026-11-05', [
      ev('2026-11-02', 'terminee'),
      ev('2026-11-03', 'planifiee'), // passé non fait : manqué
      ev('2026-11-05', 'planifiee'), // aujourd'hui : prévu
      ev('2026-11-06', 'en_cours'),
      ev('2026-11-16', 'planifiee'), // hors semaine : ignoré
    ])
    expect(s.jours.map((j) => j.etat)).toEqual(['fait', 'manque', 'repos', 'prevu', 'prevu', 'repos', 'repos'])
    expect(s.terminees).toBe(1)
    expect(s.total).toBe(4)
  })

  it('une séance terminée l’emporte sur une séance à faire le même jour', () => {
    const s = construireSemaine('2026-11-05', [ev('2026-11-04', 'terminee', 'a'), ev('2026-11-04', 'planifiee', 'b')])
    expect(s.jours[2].etat).toBe('fait')
    expect(s.jours[2].nombre).toBe(2)
  })
})

describe('libelleJour', () => {
  it.each([
    ['2026-11-05', 'Aujourd’hui'],
    ['2026-11-06', 'Demain'],
    ['2026-11-09', 'lundi 9 nov.'],
    ['2026-12-31', 'jeudi 31 déc.'],
  ])('%s -> %s', (date, attendu) => expect(libelleJour(date, '2026-11-05')).toBe(attendu))
})
