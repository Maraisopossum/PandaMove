import { describe, expect, it } from 'vitest'
import type { EvenementCardio } from '../types'
import { brouillonDepuis, brouillonVide, validerBrouillon, type BrouillonSeanceCardio } from './saisieCardio'

const brouillon = (extra: Partial<BrouillonSeanceCardio> = {}): BrouillonSeanceCardio => ({
  ...brouillonVide('2026-11-03'), titre: 'Footing facile', ...extra,
})

describe('brouillonVide', () => {
  it('commence à la date du jour choisi, en course, sans rien de rempli', () => {
    expect(brouillonVide('2026-11-03')).toEqual({
      genre: 'course', date: '2026-11-03', titre: '', consigne: '', detail: '', jalon: '', optionnelle: false, lien: '',
    })
    expect(brouillonVide('2026-11-03', 'velo').genre).toBe('velo')
  })
})

describe('brouillonDepuis', () => {
  it('reprend une séance existante, les champs absents devenant des chaînes vides', () => {
    const e: EvenementCardio = {
      id: 'c1', genre: 'velo', dateIso: '2026-11-07', titre: 'Vélo de reprise', etat: 'planifiee', consigne: null, detail: '30 min · Z1–Z2',
      optionnelle: true, jalon: null, lien: 'https://www.strava.com/activities/1',
    }
    expect(brouillonDepuis(e)).toEqual({
      genre: 'velo', date: '2026-11-07', titre: 'Vélo de reprise', consigne: '', detail: '30 min · Z1–Z2', jalon: '', optionnelle: true,
      lien: 'https://www.strava.com/activities/1',
    })
  })
})

describe('validerBrouillon — saisie valide', () => {
  it('retire les espaces, range les champs vides à null et renvoie le lien normalisé', () => {
    const r = validerBrouillon(
      brouillon({ titre: '  Footing  ', consigne: ' ', detail: ' 45 min · Z2 ', jalon: '', optionnelle: true, lien: ' HTTPS://Strava.com/a ' }),
      'creation',
    )
    expect(r).toEqual({
      ok: true,
      saisie: {
        date: '2026-11-03', titre: 'Footing', consigne: null, detail: '45 min · Z2', optionnelle: true, jalon: null, lien: 'https://strava.com/a',
      },
      champs: { titre: 'Footing', consigne: null, detail: '45 min · Z2', optionnelle: true, jalon: null, lien: 'https://strava.com/a' },
    })
  })

  it("en édition, les champs vidés sont renvoyés à null (pour effacer l'ancienne valeur) et la date n'est pas contrôlée", () => {
    const r = validerBrouillon(brouillon({ date: 'n importe quoi', consigne: '', lien: '' }), 'edition')
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.champs).toEqual({ titre: 'Footing facile', consigne: null, detail: null, optionnelle: false, jalon: null, lien: null })
  })

  it('accepte les valeurs à la limite des bornes', () => {
    const r = validerBrouillon(
      brouillon({ titre: 'x'.repeat(200), consigne: 'x'.repeat(2000), detail: 'x'.repeat(100), jalon: 'x'.repeat(100) }),
      'creation',
    )
    expect(r.ok).toBe(true)
  })
})

describe('validerBrouillon — refus, un message par champ', () => {
  it.each([
    ['titre vide', { titre: '   ' }, 'titre', /obligatoire/],
    ['titre de 201 caractères', { titre: 'x'.repeat(201) }, 'titre', /200/],
    ['consigne de 2001 caractères', { consigne: 'x'.repeat(2001) }, 'consigne', /2000/],
    ['détail de 101 caractères', { detail: 'x'.repeat(101) }, 'detail', /100/],
    ['jalon de 101 caractères', { jalon: 'x'.repeat(101) }, 'jalon', /100/],
    ['lien en http://', { lien: 'http://www.strava.com/activities/1' }, 'lien', /https/],
    ['lien avec identifiants', { lien: 'https://moi:secret@strava.com/a' }, 'lien', /identifiant/],
    ['lien avec un espace', { lien: 'https://strava.com/ a' }, 'lien', /espace/],
    ['date inexistante (30 février)', { date: '2026-02-30' }, 'date', /date/i],
    ['date vide', { date: '' }, 'date', /date/i],
  ])('%s', (_nom, extra, champ, message) => {
    const r = validerBrouillon(brouillon(extra), 'creation')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.erreurs[champ as keyof typeof r.erreurs]).toMatch(message)
  })

  it('renvoie toutes les erreurs ensemble, pas seulement la première', () => {
    const r = validerBrouillon(brouillon({ titre: '', date: '2026-02-30', lien: 'http://x.fr' }), 'creation')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(Object.keys(r.erreurs).sort()).toEqual(['date', 'lien', 'titre'])
  })

  it("ne contrôle pas la date en édition (elle se change par « Changer la date »)", () => {
    const r = validerBrouillon(brouillon({ date: '2026-02-30', titre: '' }), 'edition')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(Object.keys(r.erreurs)).toEqual(['titre'])
  })
})
