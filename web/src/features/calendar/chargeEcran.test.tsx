// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Db } from '../../core/db/Db'
import { inserer } from '../../test/fixtures'
import { createTestDb } from '../../test/sqliteDb'

let base: Db
vi.mock('../../core/db/client', () => ({ getDb: () => base }))
vi.mock('../../core/auth/AuthProvider', () => ({ useAuth: () => ({ session: { user: { id: 'u1' } } }) }))

import CalendarScreen from './CalendarScreen'

const texte = (el: Element) => (el.textContent ?? '').replace(/\s/g, ' ')
const b = { user_id: 'u1', updated_at: 'u0', deleted_at: null }
let n = 0

const cardio = (table: 'seances_course' | 'seances_velo', date: string, titre: string, detail: string, valide = 0) =>
  inserer(base, table, { ...b, id: `c${++n}`, titre, consigne: '', detail, date, optionnelle: 0, jalon: '', lien: '', is_validated: valide, created_at: 'c' })

// Samedi 14 novembre 2026 : la semaine du 16 au 22 est chargée (5 séances, 5 h 15) contre des semaines habituelles de 3 h
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 14, 15, 0))
  base = createTestDb()
  await inserer(base, 'seances', { ...b, id: 's1', nom: 'Pull', is_archived: 0, created_at: 'c', duree_estimee_min: 55 })
  await inserer(base, 'seances', { ...b, id: 's2', nom: 'Push', is_archived: 0, created_at: 'c', duree_estimee_min: 55 })
  await inserer(base, 'instances_seance', { ...b, id: 'r1', seance_id: 's1', date: '2026-11-17', is_completed: 0 })
  await inserer(base, 'instances_seance', { ...b, id: 'r2', seance_id: 's2', date: '2026-11-19', is_completed: 0 })
  await cardio('seances_course', '2026-11-17', 'Footing facile', '45 min · zone 2')
  await cardio('seances_velo', '2026-11-18', 'Sortie tempo', '1 h 30')
  await cardio('seances_course', '2026-11-21', 'Sortie longue', '1 h 10')
  // Historique : deux sorties de 1 h 30 par semaine sur les quatre semaines précédentes
  for (const lundi of ['2026-10-19', '2026-10-26', '2026-11-02', '2026-11-09']) {
    await cardio('seances_course', lundi, 'Course', '1 h 30', 1)
    await cardio('seances_velo', lundi, 'Vélo', '1 h 30', 1)
  }
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const monter = () =>
  render(
    <MemoryRouter>
      <CalendarScreen />
    </MemoryRouter>,
  )

async function versSemaineChargee() {
  monter()
  await screen.findByRole('heading', { name: 'novembre 2026' })
  fireEvent.click(screen.getByRole('button', { name: 'mardi 17 novembre 2026, 2 séances dont Course : Footing facile' }))
}

describe('calendrier : charge du mois', () => {
  it('une barre de charge par semaine, avec son niveau dit en toutes lettres', async () => {
    monter()
    await screen.findByRole('heading', { name: 'novembre 2026' })
    await waitFor(() => expect(screen.getByRole('img', { name: /Semaine du 16 au 22 novembre : charge élevée, 5 h 15 prévues/ })).toBeTruthy())
    expect(screen.getByRole('img', { name: /Semaine du 9 au 15 novembre : charge .*, 3 h prévues/ })).toBeTruthy()
    expect(document.querySelectorAll('.calendrier__charge')).toHaveLength(6) // novembre 2026 commence un dimanche : six semaines dans la grille
    expect(document.querySelectorAll('.calendrier__jour')).toHaveLength(42)
  })

  it('alerte indicative sur la semaine du jour choisi : jours d’affilée, écart, jour libre', async () => {
    await versSemaineChargee()
    const alerte = await screen.findByRole('region', { name: 'Semaine du 16 au 22 novembre chargée' })
    expect(texte(alerte)).toContain('5 séances prévues dont 3 jours d’affilée (mardi à jeudi) : charge estimée 75 % au-dessus de votre moyenne. Déplacez une séance vers vendredi, jour libre.')
    expect(texte(alerte)).toContain('Indicatif')
    // Une semaine habituelle ne déclenche rien
    fireEvent.click(screen.getByRole('button', { name: /lundi 9 novembre 2026/ }))
    expect(screen.queryByRole('region', { name: /chargée/ })).toBeNull()
  })
})

describe('calendrier : vue semaine', () => {
  async function ouvrirSemaine() {
    await versSemaineChargee()
    fireEvent.click(screen.getByRole('button', { name: 'Semaine' }))
    return screen.findByRole('region', { name: 'Répartition de la semaine' })
  }

  it('titre de la semaine, répartition du temps prévu, jour libre conseillé', async () => {
    const repartition = await ouvrirSemaine()
    expect(screen.getByRole('heading', { name: '16 au 22 novembre' })).toBeTruthy()
    expect(within(repartition).getByRole('list', { name: 'Temps prévu par jour : mardi 1 h 40, mercredi 1 h 30, jeudi 55 min, samedi 1 h 10' })).toBeTruthy()
    expect(texte(repartition)).toContain('Charge estimée : élevée.')
    const jours = Array.from(document.querySelectorAll('.calendrier__jour-semaine')).map((l) => texte(l.querySelector('.calendrier__jour-semaine-tete')!))
    expect(jours).toEqual(['Lundi 16Repos', 'Mardi 171 h 40 · chargé', 'Mercredi 181 h 30 · chargé', 'Jeudi 1955 min', 'Vendredi 20Jour libre conseillé', 'Samedi 211 h 10', 'Dimanche 22Repos'])
  })

  it('navigation de semaine en semaine, au-delà du mois', async () => {
    await ouvrirSemaine()
    fireEvent.click(screen.getByRole('button', { name: 'Semaine suivante' }))
    expect(screen.getByRole('heading', { name: '23 au 29 novembre' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Semaine suivante' }))
    await waitFor(() => expect(screen.getByRole('heading', { name: '30 novembre au 6 décembre' })).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'Semaine précédente' }))
    fireEvent.click(screen.getByRole('button', { name: 'Semaine précédente' }))
    fireEvent.click(screen.getByRole('button', { name: 'Semaine précédente' }))
    expect(screen.getByRole('heading', { name: '9 au 15 novembre' })).toBeTruthy()
  })

  it('« Déplacer » : choix d’un jour de la semaine, annonce, annulation', async () => {
    await ouvrirSemaine()
    fireEvent.click(screen.getByRole('button', { name: 'Déplacer Pull' }))
    const choix = screen.getByRole('group', { name: 'Déplacer Pull vers' })
    expect(within(choix).getAllByRole('button').map((x) => texte(x))).toEqual([
      'Lundi 16 · repos', 'Mercredi 18 · 1 h 30', 'Jeudi 19 · 55 min', 'Vendredi 20 · repos', 'Samedi 21 · 1 h 10', 'Dimanche 22 · repos', 'Autre date…',
    ])
    fireEvent.click(within(choix).getByRole('button', { name: /Vendredi 20/ }))
    const annonce = await screen.findByRole('status')
    expect(texte(annonce)).toContain('« Pull » déplacée de mardi 17 à vendredi 20.')
    expect((await base.get<{ date: string }>("SELECT date FROM instances_seance WHERE id = 'r1'")).date).toBe('2026-11-20')
    // Le jour libre est maintenant pris : la charge se répartit autrement
    await waitFor(() => expect(screen.getByRole('list', { name: /vendredi 55 min/ })).toBeTruthy())
    fireEvent.click(within(annonce).getByRole('button', { name: 'Annuler' }))
    await waitFor(async () => expect((await base.get<{ date: string }>("SELECT date FROM instances_seance WHERE id = 'r1'")).date).toBe('2026-11-17'))
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('glisser une séance sur un jour (ordinateur) la déplace ; sur son propre jour, rien', async () => {
    await ouvrirSemaine()
    const jour = (nom: string) => Array.from(document.querySelectorAll('.calendrier__jour-semaine')).find((l) => l.textContent?.startsWith(nom))!
    const dataTransfer = { getData: () => 'r2', setData: vi.fn() }
    fireEvent.dragStart(jour('Jeudi 19').querySelector('li')!, { dataTransfer })
    expect(dataTransfer.setData).toHaveBeenCalledWith('text/plain', 'r2')
    fireEvent.drop(jour('Jeudi 19'), { dataTransfer })
    expect((await base.get<{ date: string }>("SELECT date FROM instances_seance WHERE id = 'r2'")).date).toBe('2026-11-19')
    fireEvent.drop(jour('Lundi 16'), { dataTransfer })
    await waitFor(async () => expect((await base.get<{ date: string }>("SELECT date FROM instances_seance WHERE id = 'r2'")).date).toBe('2026-11-16'))
    expect(texte(await screen.findByRole('status'))).toContain('« Push » déplacée de jeudi 19 à lundi 16.')
  })

  it('une séance terminée ne se déplace pas ; « Autre date… » ouvre le dialogue de date', async () => {
    await base.execute("UPDATE instances_seance SET is_completed = 1, duration_seconds = 3000 WHERE id = 'r2'")
    await ouvrirSemaine()
    expect(screen.queryByRole('button', { name: 'Déplacer Push' })).toBeNull()
    expect(texte(Array.from(document.querySelectorAll('.calendrier__jour-semaine')).find((l) => l.textContent?.startsWith('Jeudi 19'))!)).toContain('terminée')
    fireEvent.click(screen.getByRole('button', { name: 'Déplacer Pull' }))
    fireEvent.click(within(screen.getByRole('group', { name: 'Déplacer Pull vers' })).getByRole('button', { name: 'Autre date…' }))
    expect(await screen.findByRole('dialog')).toBeTruthy()
  })
})
