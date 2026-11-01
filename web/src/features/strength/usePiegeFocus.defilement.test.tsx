// @vitest-environment jsdom
import { render } from '@testing-library/react'
import { useRef } from 'react'
import { describe, expect, it } from 'vitest'
import { usePiegeFocus } from './usePiegeFocus'

function Dialogue() {
  const racine = useRef<HTMLDivElement>(null)
  usePiegeFocus(racine, () => undefined)
  return (
    <div ref={racine} tabIndex={-1}>
      <button type="button">ok</button>
    </div>
  )
}

describe('usePiegeFocus : défilement de la page', () => {
  it('verrouille le défilement de la page à l’ouverture et le restitue à la fermeture', () => {
    const { unmount } = render(<Dialogue />)
    expect(document.body.style.overflow).toBe('hidden')
    unmount()
    expect(document.body.style.overflow).toBe('')
  })
})
