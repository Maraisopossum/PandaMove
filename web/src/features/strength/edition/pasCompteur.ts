// Calcul des boutons − / + d'un compteur numérique (steppers Android) : un pas, jamais sous le minimum,
// sans dérive de flottant (0,1 + 0,2).
export function avancerCompteur(valeur: number, sens: -1 | 1, pas: number, min: number): number {
  const base = Number.isFinite(valeur) ? valeur : min
  const suivant = Math.round((base + sens * pas) * 100) / 100
  return Math.max(min, suivant)
}
