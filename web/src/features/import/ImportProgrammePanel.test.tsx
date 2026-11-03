// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Db } from '../../core/db/Db'
import programme from '../calendar/seancesCardio/programme2027.json'
import type { SyncState } from '../../core/sync/useSyncStatus'
import type { SourceSynchro } from '../calendar/seancesCardio/useSourceSynchro'
import { createTestDb } from '../../test/sqliteDb'
import ImportProgrammePanel from './ImportProgrammePanel'

let db: Db
beforeEach(() => {
  db = createTestDb()
})
afterEach(cleanup)

// Synchronisation simulée : première synchro faite, en ligne, file vide, sauf indication contraire
const synchro = (o: { etat?: SyncState; file?: number } = {}): SourceSynchro => ({
  etat: o.etat ?? 'online',
  attendrePremiereSynchro: () => Promise.resolve(),
  compterFileEnvoi: () => Promise.resolve(o.file ?? 0),
})

const rendre = (userId: string | null = 'u1', source: SourceSynchro = synchro()) =>
  render(
    <MemoryRouter>
      <ImportProgrammePanel db={db} userId={userId ?? undefined} synchro={source} />
    </MemoryRouter>,
  )

const bouton = (nom: string | RegExp = 'Importer le programme 2027') => screen.getByRole('button', { name: nom }) as HTMLButtonElement

const compter = async () => {
  const l = await db.getAll<{ n: number }>('SELECT (SELECT count(*) FROM seances_course) + (SELECT count(*) FROM seances_velo) AS n')
  return l[0].n
}

describe('ImportProgrammePanel', () => {
  it('annonce le contenu du programme et ce que l’import ne fait pas', () => {
    rendre()
    expect(screen.getByText(new RegExp(`${programme.length} séances`))).toBeTruthy()
    expect(screen.getByText(/3 jalons/)).toBeTruthy()
    expect(screen.getByText(/ne modifie pas/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Importer le programme 2027' })).toBeTruthy()
  })

  it('bloque le bouton et dit pourquoi tant que la synchronisation n’est pas prête', async () => {
    rendre('u1', synchro({ etat: 'offline' }))
    await screen.findByText(/hors ligne/i)
    expect(bouton().disabled).toBe(true)
    expect(bouton().getAttribute('aria-describedby')).toBe(screen.getByText(/hors ligne/i).id)
    fireEvent.click(bouton())
    expect(await compter()).toBe(0)
  })

  it('bloque le bouton quand des écritures de cet appareil ne sont pas envoyées', async () => {
    rendre('u1', synchro({ file: 3 }))
    await screen.findByText(/pas encore envoyées/i)
    expect(bouton().disabled).toBe(true)
  })

  it('débloque le bouton quand tout est synchronisé', async () => {
    rendre()
    await waitFor(() => expect(bouton().disabled).toBe(false))
    expect(screen.queryByText(/première synchronisation|hors ligne|pas encore envoyées/i)).toBeNull()
  })

  it('importe au clic, annonce le résultat et rend le focus à la zone de résultat', async () => {
    rendre()
    await waitFor(() => expect(bouton().disabled).toBe(false))
    fireEvent.click(bouton())
    expect((await screen.findByRole('status')).textContent).toContain(`${programme.length} séances ajoutées`)
    expect(await compter()).toBe(programme.length)
    await waitFor(() => expect(document.activeElement?.className).toBe('import__resultat'))
    expect(screen.getByRole('link', { name: "Voir l'agenda" }).getAttribute('href')).toBe('/calendar')
  })

  it('rejouer l’import n’ajoute rien et le dit', async () => {
    rendre()
    await waitFor(() => expect(bouton().disabled).toBe(false))
    fireEvent.click(bouton())
    await screen.findByRole('status')
    await waitFor(() => expect(bouton('Importer à nouveau').disabled).toBe(false))
    fireEvent.click(bouton('Importer à nouveau'))
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Aucune séance ajoutée'))
    expect(screen.getByRole('status').textContent).toContain(`${programme.length} déjà présentes`)
    expect(await compter()).toBe(programme.length)
  })

  it('désactive le bouton pendant l’import', async () => {
    rendre()
    await waitFor(() => expect(bouton().disabled).toBe(false))
    fireEvent.click(bouton())
    await waitFor(() => expect(bouton(/Import en cours/).disabled).toBe(true))
    await screen.findByRole('status')
  })

  it('sans utilisateur connecté : alerte, rien d’écrit', async () => {
    rendre(null)
    await waitFor(() => expect(bouton().disabled).toBe(false))
    fireEvent.click(bouton())
    expect((await screen.findByRole('alert')).textContent).toMatch(/connect/i)
    expect(await compter()).toBe(0)
  })
})
