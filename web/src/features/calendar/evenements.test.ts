import { describe, expect, it } from 'vitest'
import { createTestDb } from '../../test/sqliteDb'
import { creer, definirValidation, deplacer, ErreurSeanceCardio, type SeanceCardio } from '../../core/db/repos/seancesCardio'
import {
  comparerEvenements, depuisCardio, depuisInstance, exhaustif, messageRefusDeplacement, ORDRE_GENRES, peutDeplacer, trierEvenements,
} from './evenements'
import type { EvenementAgenda, InstanceVue } from './types'

const instance = (extra: Partial<InstanceVue> = {}): InstanceVue => ({
  id: 'i1', seanceId: 's1', nom: 'Pull', dateIso: '2026-11-03', etat: 'planifiee', ...extra,
})

const cardio = (extra: Partial<SeanceCardio> = {}): SeanceCardio => ({
  id: 'c1', genre: 'course', date: '2026-11-03', titre: 'Footing facile', consigne: 'Aisance respiratoire.', detail: '40–45 min · Z1–Z2',
  optionnelle: false, jalon: null, lien: null, isValidated: false, supprimee: false, createdAt: '2026-11-01T10:00:00.000Z', ...extra,
})

describe('depuisInstance', () => {
  it("garde l'instance d'origine (inchangée) et reprend titre, date et état", () => {
    const i = instance({ etat: 'en_cours', nbSeries: 2 })
    const e = depuisInstance(i)
    expect(e).toEqual({ id: 'i1', genre: 'renfo', dateIso: '2026-11-03', titre: 'Pull', etat: 'en_cours', instance: i })
    expect(e.instance).toBe(i)
  })
})

describe('depuisCardio', () => {
  it('une séance non validée est « planifiée », une séance validée est « terminée » (filtres et pastilles réutilisés)', () => {
    expect(depuisCardio(cardio()).etat).toBe('planifiee')
    expect(depuisCardio(cardio({ isValidated: true })).etat).toBe('terminee')
  })

  it('reprend le genre et les champs propres au cardio', () => {
    const e = depuisCardio(cardio({ genre: 'velo', jalon: 'Lille-Hardelot', optionnelle: true, lien: 'https://www.strava.com/activities/1' }))
    expect(e).toEqual({
      id: 'c1', genre: 'velo', dateIso: '2026-11-03', titre: 'Footing facile', etat: 'planifiee', consigne: 'Aisance respiratoire.',
      detail: '40–45 min · Z1–Z2', optionnelle: true, jalon: 'Lille-Hardelot', lien: 'https://www.strava.com/activities/1',
    })
  })
})

describe('tri', () => {
  const evenement = (id: string, genre: EvenementAgenda['genre'], dateIso: string): EvenementAgenda =>
    genre === 'renfo' ? depuisInstance(instance({ id, dateIso })) : depuisCardio(cardio({ id, genre, date: dateIso }))

  it("ordonne par jour, puis par genre (renforcement, course, vélo), puis par identifiant", () => {
    const tries = trierEvenements([
      evenement('z', 'velo', '2026-11-03'),
      evenement('b', 'course', '2026-11-03'),
      evenement('a', 'course', '2026-11-03'),
      evenement('y', 'renfo', '2026-11-03'),
      evenement('x', 'renfo', '2026-11-02'),
      evenement('w', 'velo', '2026-11-04'),
    ])
    expect(tries.map((e) => `${e.dateIso}:${e.genre}:${e.id}`)).toEqual([
      '2026-11-02:renfo:x', '2026-11-03:renfo:y', '2026-11-03:course:a', '2026-11-03:course:b', '2026-11-03:velo:z', '2026-11-04:velo:w',
    ])
  })

  it("ne modifie pas la liste d'origine", () => {
    const liste = [evenement('b', 'velo', '2026-11-03'), evenement('a', 'renfo', '2026-11-03')]
    trierEvenements(liste)
    expect(liste.map((e) => e.id)).toEqual(['b', 'a'])
  })

  it("l'ordre des genres est le même partout", () => {
    expect(ORDRE_GENRES).toEqual(['renfo', 'course', 'velo'])
    expect(comparerEvenements(evenement('a', 'renfo', '2026-11-03'), evenement('a', 'course', '2026-11-03'))).toBeLessThan(0)
  })
})

describe('peutDeplacer et messageRefusDeplacement', () => {
  it('renforcement : planifiée et en cours se déplacent, terminée non (sa date sert aux statistiques)', () => {
    expect(peutDeplacer(depuisInstance(instance({ etat: 'planifiee' })))).toBe(true)
    expect(peutDeplacer(depuisInstance(instance({ etat: 'en_cours' })))).toBe(true)
    const terminee = depuisInstance(instance({ etat: 'terminee' }))
    expect(peutDeplacer(terminee)).toBe(false)
    expect(messageRefusDeplacement(terminee)).toMatch(/terminée.*statistiques/)
  })

  it.each(['course', 'velo'] as const)('%s : une séance validée ne se déplace pas, message propre au cardio', (genre) => {
    expect(peutDeplacer(depuisCardio(cardio({ genre })))).toBe(true)
    const validee = depuisCardio(cardio({ genre, isValidated: true }))
    expect(peutDeplacer(validee)).toBe(false)
    expect(messageRefusDeplacement(validee)).toBe('Dévalidez la séance pour la déplacer.')
    expect(messageRefusDeplacement(validee)).not.toMatch(/statistiques/)
  })

  it('le message du cardio est celui du module d\'accès aux données (même texte à l\'écran avant et après la relecture)', async () => {
    const db = createTestDb()
    const id = await creer(db, 'course', { date: '2026-11-03', titre: 'x' })
    await definirValidation(db, 'course', id, true)
    const erreur = await deplacer(db, 'course', id, '2026-11-04').then(() => null, (e: unknown) => e)
    expect(erreur).toBeInstanceOf(ErreurSeanceCardio)
    expect((erreur as ErreurSeanceCardio).message).toBe(messageRefusDeplacement(depuisCardio(cardio({ isValidated: true }))))
  })
})

describe('exhaustif', () => {
  it('lève une erreur si un genre non géré arrive à l\'exécution', () => {
    expect(() => exhaustif('natation' as never)).toThrow(/natation/)
  })
})
