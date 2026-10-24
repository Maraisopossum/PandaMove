import { describe, expect, it } from 'vitest'
import { verdictPrerequis } from './prerequis.ts'

// Tests Vitest (pas Playwright) de la décision « lancer / sauter / échouer » des e2e.
describe('verdictPrerequis', () => {
  it('toutes les variables présentes : on lance', () => {
    expect(verdictPrerequis({ E2E_EMAIL: 'a', E2E_PASSWORD: 'b' }, ['E2E_EMAIL', 'E2E_PASSWORD'])).toEqual({ action: 'lancer' })
  })

  it('variable absente ou vide sans E2E_REQUIRED : on saute, en nommant les variables manquantes', () => {
    expect(verdictPrerequis({ E2E_EMAIL: 'a', E2E_PASSWORD: '' }, ['E2E_EMAIL', 'E2E_PASSWORD'])).toEqual({
      action: 'sauter',
      message: 'Variables requises absentes : E2E_PASSWORD (définir E2E_REQUIRED=1 pour faire échouer au lieu de sauter)',
    })
  })

  it('variable absente avec E2E_REQUIRED=1 : on échoue', () => {
    expect(verdictPrerequis({ E2E_REQUIRED: '1' }, ['E2E_EMAIL2', 'E2E_PASSWORD2'])).toEqual({
      action: 'echouer',
      message: 'E2E_REQUIRED=1 : variables requises absentes : E2E_EMAIL2, E2E_PASSWORD2',
    })
  })
})
