// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { LIBELLES_SYNCHRO } from './libellesSynchro'
import { SyncBadge } from './SyncIndicator'
import type { SyncState } from './useSyncStatus'

afterEach(cleanup)

describe('indicateur de synchro', () => {
  it('utilise les libellés attendus par le test e2e', () => {
    expect(LIBELLES_SYNCHRO).toEqual({
      offline: 'hors ligne',
      syncing: 'synchronisation…',
      online: 'en ligne',
    })
  })

  it.each<[SyncState, string]>([
    ['offline', 'hors ligne'],
    ['syncing', 'synchronisation…'],
    ['online', 'en ligne'],
  ])('affiche « %s » comme « %s »', (etat, libelle) => {
    render(<SyncBadge state={etat} />)
    expect(screen.getByTestId('sync-state').textContent).toBe(libelle)
  })
})
