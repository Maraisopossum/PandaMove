// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import exportV32 from '../../core/import/__fixtures__/export-v3.2.json'
import { createTestDb } from '../../test/sqliteDb'

const base = createTestDb()
vi.mock('../../core/db/client', () => ({ getDb: () => base }))
vi.mock('../../core/auth/AuthProvider', () => ({
  useAuth: () => ({ session: { user: { id: '11111111-1111-4111-8111-111111111111' } } }),
}))

import ImportScreen from './ImportScreen'

afterEach(cleanup)

const deposer = (f: File) =>
  fireEvent.change(screen.getByLabelText(/Fichier d'export/), { target: { files: [f] } })
const fichier = (texte: string) => new File([texte], 'export.json', { type: 'application/json' })

describe('ImportScreen', () => {
  it('aperçu, avertissement, confirmation puis résumé', async () => {
    render(<ImportScreen />)
    deposer(fichier(JSON.stringify(exportV32)))
    expect(await screen.findByText('2 séance(s)')).toBeTruthy()
    expect(screen.getByText(/remplace les éléments correspondants déjà présents/)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: "Confirmer l'import" }))
    expect(await screen.findByText(/importés\./)).toBeTruthy()
    expect(screen.queryByRole('button', { name: "Confirmer l'import" })).toBeNull()
    await waitFor(() => expect(document.activeElement?.className).toBe('import__resultat'))
  })

  it("affiche l'erreur dans une zone role=alert et déplace le focus", async () => {
    render(<ImportScreen />)
    deposer(fichier('{"tronque'))
    const alerte = await screen.findByRole('alert')
    expect(alerte.textContent).toBe('Fichier JSON invalide ou tronqué')
    await waitFor(() => expect(document.activeElement?.className).toBe('import__resultat'))
    expect(screen.queryByRole('button', { name: "Confirmer l'import" })).toBeNull()
  })
})
