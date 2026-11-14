// Écart entre deux valeurs, avec son sens (accueil : bilan de la semaine ; statistiques : tendances de période).

export type SensEcart = 'hausse' | 'baisse' | 'stable'

export interface Ecart {
  texte: string
  sens: SensEcart
}

/** « +6,2 km », « −35 min » ou « = » : écart entre deux valeurs, mis en forme par `formater` (valeur absolue). */
export function ecart(courant: number, precedent: number, formater: (valeurAbsolue: number) => string): Ecart {
  const d = courant - precedent
  if (Math.abs(d) < 1e-9) return { texte: 'Identique', sens: 'stable' }
  return { texte: `${d > 0 ? '+' : '−'}${formater(Math.abs(d))}`, sens: d > 0 ? 'hausse' : 'baisse' }
}
