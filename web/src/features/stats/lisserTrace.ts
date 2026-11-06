// Adoucit un tracé « M x,y L x,y … Z » : chaque sommet devient le point de contrôle d'une courbe passant par les milieux
// des segments voisins. Les marches d'escalier issues de la détection par pixels disparaissent, la forme reste la même.
export function lisserTrace(trace: string): string {
  return trace
    .split('M')
    .filter((s) => s.trim() !== '')
    .map((sous) => {
      const pts = [...sous.matchAll(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g)].map((m) => [Number(m[1]), Number(m[2])] as const)
      if (pts.length < 3) return `M${sous.trim()}`
      const milieu = (a: readonly [number, number], b: readonly [number, number]) => `${((a[0] + b[0]) / 2).toFixed(1)},${((a[1] + b[1]) / 2).toFixed(1)}`
      const n = pts.length
      let d = `M${milieu(pts[n - 1], pts[0])}`
      for (let i = 0; i < n; i++) d += ` Q${pts[i][0]},${pts[i][1]} ${milieu(pts[i], pts[(i + 1) % n])}`
      return `${d} Z`
    })
    .join(' ')
}
