// Calcul de contraste WCAG (luminance relative) et fond du badge de synchro.
type Rgb = [number, number, number]

function versRgb(hex: string): Rgb {
  const h = hex.replace('#', '')
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as Rgb
}

function luminance([r, g, b]: Rgb): number {
  const [R, G, B] = [r, g, b].map((c) => {
    const v = c / 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * R + 0.7152 * G + 0.0722 * B
}

export function ratioContraste(a: string, b: string): number {
  const [la, lb] = [luminance(versRgb(a)), luminance(versRgb(b))]
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

// Voile noir semi-transparent posé sous le texte du badge, sur la couleur de module de la barre.
export const FOND_BADGE_SYNC = { couleur: '#000000', alpha: 0.4 }

// Couleur opaque obtenue en posant `voile` sur `fond` (hex).
export function composer(voile: { couleur: string; alpha: number }, fond: string): string {
  const v = versRgb(voile.couleur)
  const f = versRgb(fond)
  return (
    '#' +
    f
      .map((c, i) => Math.round(v[i] * voile.alpha + c * (1 - voile.alpha)))
      .map((c) => c.toString(16).padStart(2, '0'))
      .join('')
  )
}

export const cssFondBadgeSync = `rgb(0 0 0 / ${FOND_BADGE_SYNC.alpha})`
