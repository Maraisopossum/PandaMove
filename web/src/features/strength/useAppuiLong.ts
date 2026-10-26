import { useCallback, useEffect, useRef, type MouseEvent, type PointerEvent } from 'react'

const DELAI_MS = 500
const TOLERANCE_PX = 10

// Appui long (Android : combinedClickable onLongClick) : après 500 ms sans relâcher ni bouger, `surAppuiLong` est
// appelé une fois et le clic qui suit le relâchement est ignoré. Un déplacement du doigt (défilement) l'annule.
// À étaler (`{...appui}`) sur l'élément concerné.
export function useAppuiLong(surAppuiLong: () => void) {
  const minuterie = useRef<ReturnType<typeof setTimeout> | null>(null)
  const depart = useRef<{ x: number; y: number } | null>(null)
  const declenche = useRef(false)
  const action = useRef(surAppuiLong)
  useEffect(() => {
    action.current = surAppuiLong
  })

  const annuler = useCallback(() => {
    if (minuterie.current !== null) clearTimeout(minuterie.current)
    minuterie.current = null
    depart.current = null
  }, [])
  useEffect(() => annuler, [annuler])

  const surPointerDown = useCallback(
    (e: PointerEvent) => {
      if (e.button !== undefined && e.button > 0) return
      declenche.current = false
      depart.current = { x: e.clientX, y: e.clientY }
      minuterie.current = setTimeout(() => {
        minuterie.current = null
        declenche.current = true
        action.current()
      }, DELAI_MS)
    },
    [],
  )
  const surPointerMove = useCallback(
    (e: PointerEvent) => {
      const d = depart.current
      if (d && Math.hypot(e.clientX - d.x, e.clientY - d.y) > TOLERANCE_PX) annuler()
    },
    [annuler],
  )
  // Clic en phase de capture : après un appui long il est avalé une fois, puis tout revient à la normale
  const surClicCapture = useCallback((e: MouseEvent) => {
    if (declenche.current) {
      declenche.current = false
      e.preventDefault()
      e.stopPropagation()
    }
  }, [])

  return {
    onPointerDown: surPointerDown,
    onPointerMove: surPointerMove,
    onPointerUp: annuler,
    onPointerLeave: annuler,
    onPointerCancel: annuler,
    onClickCapture: surClicCapture,
    // Le menu contextuel du navigateur (appui long tactile) ne doit pas s'ouvrir par-dessus la sélection
    onContextMenu: (e: MouseEvent) => {
      if (declenche.current) e.preventDefault()
    },
  }
}
