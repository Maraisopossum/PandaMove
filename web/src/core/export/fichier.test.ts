// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { nomFichierExport, telechargerJson } from './fichier'

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('nomFichierExport', () => {
  it('pandamove-export-AAAA-MM-JJ.json, date locale complétée de zéros', () => {
    expect(nomFichierExport(new Date(2026, 0, 5, 23, 59))).toBe('pandamove-export-2026-01-05.json')
    expect(nomFichierExport(new Date(2026, 9, 25, 0, 1))).toBe('pandamove-export-2026-10-25.json')
  })
})

describe('telechargerJson', () => {
  it("déclenche le téléchargement d'un Blob JSON via un lien <a download>, puis libère l'URL", async () => {
    vi.useFakeTimers()
    const creer = vi.fn((blob: Blob) => {
      void blob
      return 'blob:pandamove/1'
    })
    const liberer = vi.fn()
    Object.assign(URL, { createObjectURL: creer, revokeObjectURL: liberer })
    const clics: HTMLAnchorElement[] = []
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clics.push(this)
    })

    telechargerJson('pandamove-export-2026-10-25.json', '{"version":"3.2"}')

    expect(clics).toHaveLength(1)
    expect(clics[0].download).toBe('pandamove-export-2026-10-25.json')
    expect(clics[0].href).toBe('blob:pandamove/1')
    const blob = creer.mock.calls[0][0]
    expect(blob.type).toBe('application/json')
    expect(await blob.text()).toBe('{"version":"3.2"}')
    // Le lien temporaire ne reste pas dans la page
    expect(document.querySelector('a[download]')).toBeNull()
    vi.runAllTimers()
    expect(liberer).toHaveBeenCalledWith('blob:pandamove/1')
  })
})
