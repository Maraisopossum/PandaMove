// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Db } from '../../core/db/Db'
import { creer, definirValidation, type GenreCardio, lireParId } from '../../core/db/repos/seancesCardio'
import { inserer } from '../../test/fixtures'
import { createTestDb } from '../../test/sqliteDb'
import type { EvenementAgenda } from './types'
import { useCalendar } from './useCalendar'

const base = { user_id: 'u1', updated_at: 'u0', deleted_at: null }
const NOW = new Date(2026, 9, 24, 15, 30) // 24 octobre 2026, heure locale
const nowFn = () => NOW

async function seance(db: Db, id: string, nom: string, extra: Record<string, unknown> = {}) {
  await inserer(db, 'seances', { ...base, id, nom, is_archived: 0, created_at: 'c', ...extra })
}
async function instance(db: Db, id: string, seanceId: string, date: string, extra: Record<string, unknown> = {}) {
  await inserer(db, 'instances_seance', { ...base, id, seance_id: seanceId, date, is_completed: 0, ...extra })
}
const cardio = (db: Db, genre: GenreCardio, id: string, date: string, extra: Record<string, unknown> = {}) =>
  creer(db, genre, { id, date, titre: 'Footing facile', ...extra })

async function monter(db: Db, mois = { year: 2026, month: 10 }) {
  const rendu = renderHook(({ m }) => useCalendar(m, { db, nowFn }), { initialProps: { m: mois } })
  await waitFor(() => expect(rendu.result.current.chargement).toBe(false))
  return rendu
}

type Rendu = Awaited<ReturnType<typeof monter>>
const jour = (r: Rendu, iso: string) => r.result.current.jours.find((j) => j.dateIso === iso)
// Un événement affiché (grille ou prochaines), tel que l'écran le passe aux actions
const vue = (r: Rendu, id: string): EvenementAgenda => {
  const e = [...r.result.current.jours.flatMap((j) => j.evenements), ...r.result.current.prochaines].find((x) => x.id === id)
  if (!e) throw new Error(`événement ${id} non affiché`)
  return e
}

describe('useCalendar — lecture', () => {
  it("base vide : grille sans événement, prochaines vide, pas d'erreur", async () => {
    const r = await monter(createTestDb())
    expect(r.result.current.erreur).toBeNull()
    expect(r.result.current.jours).toHaveLength(35)
    expect(r.result.current.jours.every((j) => j.evenements.length === 0)).toBe(true)
    expect(r.result.current.prochaines).toEqual([])
    expect(jour(r, '2026-10-24')?.estAujourdhui).toBe(true)
    expect(r.result.current.filtre).toEqual({ statut: 'toutes' })
  })

  it('une instance apparaît le jour de sa date et pas le jour de completed_at', async () => {
    const db = createTestDb()
    await seance(db, 's1', 'Pull')
    await instance(db, 'a', 's1', '2026-10-05', { is_completed: 1, completed_at: '2026-10-20T09:00:00.000Z', duration_seconds: 10 })
    const r = await monter(db)
    expect(jour(r, '2026-10-05')?.evenements.map((i) => i.id)).toEqual(['a'])
    expect(jour(r, '2026-10-20')?.evenements).toEqual([])
  })

  it('les jours des mois voisins visibles portent leurs événements (dansLeMois false)', async () => {
    const db = createTestDb()
    await seance(db, 's1', 'Pull')
    await instance(db, 'a', 's1', '2026-09-30')
    await instance(db, 'b', 's1', '2026-11-01')
    const r = await monter(db)
    expect(jour(r, '2026-09-30')).toMatchObject({ dansLeMois: false })
    expect(jour(r, '2026-09-30')?.evenements.map((i) => i.id)).toEqual(['a'])
    expect(jour(r, '2026-11-01')?.evenements.map((i) => i.id)).toEqual(['b'])
  })

  it("une séance supprimée avec « garder l'historique » garde son nom sur ses instances réalisées", async () => {
    const db = createTestDb()
    await seance(db, 's1', 'Pull', { deleted_at: 'x' })
    await instance(db, 'a', 's1', '2026-10-05', { is_completed: 1 })
    const r = await monter(db)
    expect(jour(r, '2026-10-05')?.evenements[0]).toMatchObject({ titre: 'Pull', etat: 'terminee', genre: 'renfo' })
  })

  it('prochaines : croissantes, sans terminées ni supprimées, indépendantes du mois affiché', async () => {
    const db = createTestDb()
    await seance(db, 's1', 'Pull')
    await instance(db, 'b', 's1', '2026-12-10')
    await instance(db, 'a', 's1', '2026-10-25')
    await instance(db, 'faite', 's1', '2026-10-26', { is_completed: 1 })
    await instance(db, 'sup', 's1', '2026-10-27', { deleted_at: 'x' })
    await instance(db, 'passee', 's1', '2026-10-01')
    const r = await monter(db, { year: 2027, month: 6 })
    expect(r.result.current.prochaines.map((i) => i.id)).toEqual(['a', 'b'])
    expect(r.result.current.jours.every((j) => j.evenements.length === 0)).toBe(true)
  })

  it('change de mois quand le paramètre change', async () => {
    const db = createTestDb()
    await seance(db, 's1', 'Pull')
    await instance(db, 'n', 's1', '2026-11-10')
    const r = await monter(db)
    expect(jour(r, '2026-11-10')).toBeUndefined()
    r.rerender({ m: { year: 2026, month: 11 } })
    await waitFor(() => expect(jour(r, '2026-11-10')?.evenements.map((i) => i.id)).toEqual(['n']))
  })

  it('filtres planifiées / terminées appliqués à la grille mais pas aux prochaines', async () => {
    const db = createTestDb()
    await seance(db, 's1', 'Pull')
    await instance(db, 'p', 's1', '2026-10-28')
    await instance(db, 'c', 's1', '2026-10-28', { started_at: '2026-10-28T08:00:00.000Z' })
    await instance(db, 't', 's1', '2026-10-28', { is_completed: 1 })
    const r = await monter(db)
    const ids = () => jour(r, '2026-10-28')?.evenements.map((i) => i.id)
    expect(ids()).toEqual(['c', 'p', 't'])
    act(() => r.result.current.setFiltre({ statut: 'planifiees' }))
    expect(ids()).toEqual(['c', 'p']) // « planifiées » = non terminées (planifiées ou en cours)
    act(() => r.result.current.setFiltre({ statut: 'terminees' }))
    expect(ids()).toEqual(['t'])
    expect(r.result.current.filtre).toEqual({ statut: 'terminees' })
    expect(r.result.current.prochaines.map((i) => i.id)).toEqual(['c', 'p'])
  })

  it("erreur de lecture : message français, pas de rejet non géré", async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const db = createTestDb()
    const casse: Db = { ...db, getAll: () => Promise.reject(new Error('boum')) }
    const r = renderHook(() => useCalendar({ year: 2026, month: 10 }, { db: casse, nowFn }))
    await waitFor(() => expect(r.result.current.erreur).toMatch(/chargement/i))
    expect(r.result.current.chargement).toBe(false)
  })
})

describe('useCalendar — cardio dans l’agenda', () => {
  async function avecCardio() {
    const db = createTestDb()
    await seance(db, 's1', 'Pull')
    await instance(db, 'r', 's1', '2026-10-28')
    await cardio(db, 'course', 'c', '2026-10-28')
    await cardio(db, 'velo', 'v', '2026-10-28')
    await cardio(db, 'course', 'validee', '2026-10-05')
    await definirValidation(db, 'course', 'validee', true)
    return { db, r: await monter(db) }
  }

  it('les trois sources apparaissent le même jour, ordonnées renforcement, course, vélo', async () => {
    const { r } = await avecCardio()
    expect(jour(r, '2026-10-28')?.evenements.map((e) => `${e.genre}:${e.id}`)).toEqual(['renfo:r', 'course:c', 'velo:v'])
  })

  it('les prochaines séances mélangent renforcement et cardio par date, sans les séances validées', async () => {
    const { r } = await avecCardio()
    expect(r.result.current.prochaines.map((e) => e.id)).toEqual(['r', 'c', 'v'])
  })

  it('une séance de cardio validée compte comme « terminée » pour les filtres', async () => {
    const { r } = await avecCardio()
    expect(vue(r, 'validee').etat).toBe('terminee')
    act(() => r.result.current.setFiltre({ statut: 'terminees' }))
    expect(r.result.current.jours.flatMap((j) => j.evenements).map((e) => e.id)).toEqual(['validee'])
    act(() => r.result.current.setFiltre({ statut: 'planifiees' }))
    expect(r.result.current.jours.flatMap((j) => j.evenements).map((e) => e.id)).toEqual(['r', 'c', 'v'])
  })

  it('valider retire la séance des prochaines et la passe à « terminée » ; dévalider la remet', async () => {
    const { r } = await avecCardio()
    await act(() => r.result.current.validerCardio(vue(r, 'c')))
    expect(r.result.current.erreur).toBeNull()
    expect(vue(r, 'c').etat).toBe('terminee')
    expect(r.result.current.prochaines.map((e) => e.id)).toEqual(['r', 'v'])
    await act(() => r.result.current.devaliderCardio(vue(r, 'c')))
    expect(vue(r, 'c').etat).toBe('planifiee')
    expect(r.result.current.prochaines.map((e) => e.id)).toEqual(['r', 'c', 'v'])
  })

  it('déplace une séance de cardio et rafraîchit grille et prochaines', async () => {
    const { r } = await avecCardio()
    await act(() => r.result.current.deplacer(vue(r, 'c'), '2026-10-30'))
    expect(jour(r, '2026-10-28')?.evenements.map((e) => e.id)).toEqual(['r', 'v'])
    expect(jour(r, '2026-10-30')?.evenements.map((e) => e.id)).toEqual(['c'])
  })

  it('refuse de déplacer une séance validée avec le message du cardio, puis accepte après dévalidation', async () => {
    const { db, r } = await avecCardio()
    await act(() => r.result.current.deplacer(vue(r, 'validee'), '2026-10-06'))
    expect(r.result.current.erreur).toBe('Dévalidez la séance pour la déplacer.')
    expect(await lireParId(db, 'course', 'validee')).toMatchObject({ date: '2026-10-05' })
    await act(() => r.result.current.devaliderCardio(vue(r, 'validee')))
    await act(() => r.result.current.deplacer(vue(r, 'validee'), '2026-10-06'))
    expect(r.result.current.erreur).toBeNull()
    expect(jour(r, '2026-10-06')?.evenements.map((e) => e.id)).toEqual(['validee'])
  })

  it("verifierDeplacement : vrai si l'événement peut bouger ; sinon faux et le message s'affiche", async () => {
    const { r } = await avecCardio()
    let permis = false
    act(() => {
      permis = r.result.current.verifierDeplacement(vue(r, 'c'))
    })
    expect(permis).toBe(true)
    expect(r.result.current.erreur).toBeNull()
    act(() => {
      permis = r.result.current.verifierDeplacement(vue(r, 'validee'))
    })
    expect(permis).toBe(false)
    expect(r.result.current.erreur).toBe('Dévalidez la séance pour la déplacer.')
  })

  it('crée une séance de cardio, qui apparaît à sa date ; un refus de validation donne une erreur française', async () => {
    const { r } = await avecCardio()
    let reussi = false
    await act(async () => {
      reussi = await r.result.current.creerCardio('velo', { date: '2026-10-29', titre: 'Vélo endurance', detail: '45 min · Z2' })
    })
    expect(reussi).toBe(true)
    expect(jour(r, '2026-10-29')?.evenements[0]).toMatchObject({ genre: 'velo', titre: 'Vélo endurance', detail: '45 min · Z2' })
    await act(async () => {
      reussi = await r.result.current.creerCardio('course', { date: '2026-02-30', titre: 'x' })
    })
    expect(reussi).toBe(false)
    expect(r.result.current.erreur).toMatch(/date invalide/i)
  })

  it("modifie une séance de cardio (même validée) et rafraîchit l'écran", async () => {
    const { r } = await avecCardio()
    await act(() => r.result.current.modifierCardio(vue(r, 'validee'), { titre: 'Footing du dimanche', optionnelle: true }))
    expect(vue(r, 'validee')).toMatchObject({ titre: 'Footing du dimanche', optionnelle: true, etat: 'terminee' })
  })

  it('supprime une séance de cardio (validée ou non) ; une seconde suppression donne « introuvable »', async () => {
    const { r } = await avecCardio()
    const affichee = vue(r, 'validee')
    await act(() => r.result.current.supprimer(affichee))
    expect(jour(r, '2026-10-05')?.evenements).toEqual([])
    await act(() => r.result.current.supprimer(affichee))
    expect(r.result.current.erreur).toMatch(/introuvable/i)
    await act(() => r.result.current.supprimer(vue(r, 'c')))
    expect(jour(r, '2026-10-28')?.evenements.map((e) => e.id)).toEqual(['r', 'v'])
  })

  it('une séance de cardio ne se valide pas depuis une instance de renforcement', async () => {
    const { r } = await avecCardio()
    await act(() => r.result.current.validerCardio(vue(r, 'r')))
    expect(r.result.current.erreur).toMatch(/renforcement/i)
  })
})

describe('useCalendar — actions', () => {
  async function avecDonnees() {
    const db = createTestDb()
    await seance(db, 's1', 'Pull')
    await instance(db, 'p', 's1', '2026-10-28')
    await instance(db, 't', 's1', '2026-10-05', { is_completed: 1 })
    return { db, r: await monter(db) }
  }

  it('deplacer met à jour la date et rafraîchit grille et prochaines', async () => {
    const { r } = await avecDonnees()
    await act(() => r.result.current.deplacer(vue(r, 'p'), '2026-10-30'))
    expect(jour(r, '2026-10-28')?.evenements).toEqual([])
    expect(jour(r, '2026-10-30')?.evenements.map((i) => i.id)).toEqual(['p'])
    expect(r.result.current.prochaines[0].dateIso).toBe('2026-10-30')
    expect(r.result.current.erreur).toBeNull()
  })

  it("deplacer vers une date impossible : erreur française dans `erreur`, pas de rejet, rien d'écrit", async () => {
    const { db, r } = await avecDonnees()
    await act(() => r.result.current.deplacer(vue(r, 'p'), '2026-02-30'))
    expect(r.result.current.erreur).toMatch(/date invalide/i)
    expect((await db.get<{ date: string }>("SELECT date FROM instances_seance WHERE id = 'p'")).date).toBe('2026-10-28')
  })

  it('deplacer une terminée : erreur', async () => {
    const { r } = await avecDonnees()
    await act(() => r.result.current.deplacer(vue(r, 't'), '2026-10-06'))
    expect(r.result.current.erreur).toMatch(/terminée/i)
    expect(jour(r, '2026-10-05')?.evenements.map((i) => i.id)).toEqual(['t'])
  })

  it("verifierDeplacement d'un renforcement terminé : faux, avec le message historique", async () => {
    const { r } = await avecDonnees()
    let permis = true
    act(() => {
      permis = r.result.current.verifierDeplacement(vue(r, 't'))
    })
    expect(permis).toBe(false)
    expect(r.result.current.erreur).toMatch(/terminée.*statistiques/)
  })

  it("une action réussie efface l'erreur précédente", async () => {
    const { r } = await avecDonnees()
    await act(() => r.result.current.deplacer(vue(r, 'p'), 'nope'))
    expect(r.result.current.erreur).not.toBeNull()
    await act(() => r.result.current.deplacer(vue(r, 'p'), '2026-10-29'))
    expect(r.result.current.erreur).toBeNull()
  })

  it('supprimer retire la séance de la grille et des prochaines', async () => {
    const { r } = await avecDonnees()
    const planifiee = vue(r, 'p')
    const terminee = vue(r, 't')
    await act(() => r.result.current.supprimer(planifiee))
    expect(jour(r, '2026-10-28')?.evenements).toEqual([])
    expect(r.result.current.prochaines).toEqual([])
    await act(() => r.result.current.supprimer(terminee))
    expect(jour(r, '2026-10-05')?.evenements).toEqual([])
    await act(() => r.result.current.supprimer(terminee))
    expect(r.result.current.erreur).toMatch(/introuvable/i)
  })

  it("échec technique d'écriture : message générique français", async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { db } = await avecDonnees()
    const casse: Db = { ...db, writeTransaction: () => Promise.reject(new Error('boum')) }
    const r = renderHook(() => useCalendar({ year: 2026, month: 10 }, { db: casse, nowFn }))
    await waitFor(() => expect(r.result.current.chargement).toBe(false))
    await act(() => r.result.current.supprimer(vue(r, 'p')))
    expect(r.result.current.erreur).toMatch(/échoué/i)
  })
})
