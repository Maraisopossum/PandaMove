// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Db } from '../../core/db/Db'
import { creer, definirValidation, lireParId } from '../../core/db/repos/seancesCardio'
import { inserer } from '../../test/fixtures'
import { createTestDb } from '../../test/sqliteDb'
import type { EvenementAgenda } from './types'

vi.mock('../../core/auth/AuthProvider', () => ({ useAuth: () => ({ session: { user: { id: 'u1' } } }) }))

import { useEcranCalendrier } from './useEcranCalendrier'

const NOW = new Date(2026, 9, 24, 15, 0) // samedi 24 octobre 2026
const nowFn = () => NOW
const b = { user_id: 'u1', updated_at: 'u0', deleted_at: null }

async function monter(db: Db) {
  const rendu = renderHook(() => useEcranCalendrier({ db, nowFn }))
  await waitFor(() => expect(rendu.result.current.chargement).toBe(false))
  return rendu
}
type Rendu = Awaited<ReturnType<typeof monter>>

const evenement = (r: Rendu, id: string): EvenementAgenda => {
  const e = r.result.current.jours.flatMap((j) => j.evenements).find((x) => x.id === id)
  if (!e) throw new Error(`événement ${id} non affiché`)
  return e
}

describe('useEcranCalendrier — saisie d’une séance de cardio', () => {
  it('ouvrirAjout ouvre la création à la date du jour sélectionné (aujourd’hui par défaut, puis le jour choisi)', async () => {
    const r = await monter(createTestDb())
    expect(r.result.current.saisie).toBeNull()
    act(() => r.result.current.ouvrirAjout())
    expect(r.result.current.saisie).toMatchObject({ mode: 'creation', erreurs: {} })
    expect(r.result.current.saisie?.brouillon).toMatchObject({ genre: 'course', date: '2026-10-24', titre: '' })
    act(() => r.result.current.fermerSaisie())
    expect(r.result.current.saisie).toBeNull()
    act(() => r.result.current.choisirJour('2026-10-29'))
    act(() => r.result.current.ouvrirAjout())
    expect(r.result.current.saisie?.brouillon.date).toBe('2026-10-29')
  })

  it("changerBrouillon fusionne le champ modifié et efface l'erreur de ce champ seulement", async () => {
    const r = await monter(createTestDb())
    act(() => r.result.current.ouvrirAjout())
    await act(() => r.result.current.enregistrer())
    expect(Object.keys(r.result.current.saisie!.erreurs)).toEqual(['titre'])
    act(() => r.result.current.changerBrouillon({ detail: '45 min · Z2' }))
    expect(r.result.current.saisie!.brouillon.detail).toBe('45 min · Z2')
    expect(r.result.current.saisie!.erreurs.titre).toBeDefined()
    act(() => r.result.current.changerBrouillon({ titre: 'Footing' }))
    expect(r.result.current.saisie!.brouillon).toMatchObject({ titre: 'Footing', detail: '45 min · Z2' })
    expect(r.result.current.saisie!.erreurs).toEqual({})
  })

  it('enregistrer avec une saisie invalide affiche les erreurs, garde le dialogue ouvert et n’écrit rien', async () => {
    const db = createTestDb()
    const r = await monter(db)
    act(() => r.result.current.ouvrirAjout())
    act(() => r.result.current.changerBrouillon({ titre: '', date: '2026-02-30', lien: 'http://x.fr' }))
    await act(() => r.result.current.enregistrer())
    expect(r.result.current.saisie).not.toBeNull()
    expect(Object.keys(r.result.current.saisie!.erreurs).sort()).toEqual(['date', 'lien', 'titre'])
    expect(await db.getAll('SELECT id FROM seances_course')).toEqual([])
  })

  it('enregistrer une création écrit la séance, ferme le dialogue et l’affiche à sa date', async () => {
    const db = createTestDb()
    const r = await monter(db)
    act(() => r.result.current.ouvrirAjout())
    act(() => r.result.current.changerBrouillon({ genre: 'velo', titre: ' Vélo endurance ', detail: '45 min · Z2', lien: 'HTTPS://Strava.com/a' }))
    await act(() => r.result.current.enregistrer())
    expect(r.result.current.saisie).toBeNull()
    expect(r.result.current.erreur).toBeNull()
    const jour = r.result.current.jours.find((j) => j.dateIso === '2026-10-24')!
    expect(jour.evenements).toHaveLength(1)
    expect(jour.evenements[0]).toMatchObject({ genre: 'velo', titre: 'Vélo endurance', detail: '45 min · Z2', lien: 'https://strava.com/a' })
    expect(r.result.current.jourSelectionne).toBe('2026-10-24')
  })

  it('une création à une date d’un autre mois affiche ce mois et sélectionne le jour', async () => {
    const r = await monter(createTestDb())
    act(() => r.result.current.ouvrirAjout())
    act(() => r.result.current.changerBrouillon({ titre: 'Sortie vélo longue', date: '2026-12-13' }))
    await act(() => r.result.current.enregistrer())
    await waitFor(() => expect(r.result.current.titreMois).toMatch(/décembre 2026/))
    expect(r.result.current.jourSelectionne).toBe('2026-12-13')
    await waitFor(() => expect(r.result.current.detail?.evenements.map((e) => e.titre)).toEqual(['Sortie vélo longue']))
  })

  it('ouvrirEdition reprend la séance ; enregistrer la modifie sans toucher à sa date ni à son état', async () => {
    const db = createTestDb()
    await creer(db, 'course', { id: 'c1', date: '2026-10-26', titre: 'Footing', consigne: 'Facile', lien: 'https://strava.com/a' })
    await definirValidation(db, 'course', 'c1', true)
    const r = await monter(db)
    act(() => r.result.current.ouvrirEdition(evenement(r, 'c1')))
    expect(r.result.current.saisie).toMatchObject({ mode: 'edition' })
    expect(r.result.current.saisie!.brouillon).toMatchObject({ genre: 'course', titre: 'Footing', consigne: 'Facile', lien: 'https://strava.com/a' })
    act(() => r.result.current.changerBrouillon({ titre: 'Footing souple', consigne: '', lien: '', optionnelle: true }))
    await act(() => r.result.current.enregistrer())
    expect(r.result.current.saisie).toBeNull()
    expect(await lireParId(db, 'course', 'c1')).toMatchObject({
      titre: 'Footing souple', consigne: null, lien: null, optionnelle: true, date: '2026-10-26', isValidated: true,
    })
  })

  it("ouvrirEdition ignore une séance de renforcement (elle se modifie depuis ses séances)", async () => {
    const db = createTestDb()
    await inserer(db, 'seances', { ...b, id: 's1', nom: 'Pull', is_archived: 0, created_at: 'c' })
    await inserer(db, 'instances_seance', { ...b, id: 'p', seance_id: 's1', date: '2026-10-26', is_completed: 0 })
    const r = await monter(db)
    act(() => r.result.current.ouvrirEdition(evenement(r, 'p')))
    expect(r.result.current.saisie).toBeNull()
  })

  it('un échec d’écriture garde le dialogue ouvert et expose le message', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const db = createTestDb()
    const casse: Db = { ...db, execute: () => Promise.reject(new Error('boum')) }
    const r = await monter(casse)
    act(() => r.result.current.ouvrirAjout())
    act(() => r.result.current.changerBrouillon({ titre: 'Footing' }))
    await act(() => r.result.current.enregistrer())
    expect(r.result.current.saisie).not.toBeNull()
    expect(r.result.current.erreur).toBe("L'ajout de la séance a échoué.")
  })

  it('ouvrir un dialogue efface le message d’une action précédente', async () => {
    const db = createTestDb()
    await creer(db, 'course', { id: 'c1', date: '2026-10-26', titre: 'Footing' })
    await definirValidation(db, 'course', 'c1', true)
    const r = await monter(db)
    act(() => r.result.current.ouvrirDate(evenement(r, 'c1'))) // refusé : séance validée
    expect(r.result.current.erreur).toBe('Dévalidez la séance pour la déplacer.')
    act(() => r.result.current.ouvrirAjout())
    expect(r.result.current.erreur).toBeNull()
  })

  it('enCours bloque un second enregistrement pendant le premier', async () => {
    const db = createTestDb()
    const r = await monter(db)
    act(() => r.result.current.ouvrirAjout())
    act(() => r.result.current.changerBrouillon({ titre: 'Footing' }))
    await act(async () => {
      await Promise.all([r.result.current.enregistrer(), r.result.current.enregistrer()])
    })
    expect(await db.getAll('SELECT id FROM seances_course')).toHaveLength(1)
  })
})
