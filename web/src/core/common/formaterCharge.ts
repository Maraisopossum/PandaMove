// Affichage d'une charge en kg : arrondi à 0,01 (absorbe le bruit float32 comme 17.69999885559082
// ou 0.1 + 0.2), virgule décimale française, sans zéros inutiles.
export function formaterCharge(kg: number): string {
  if (!Number.isFinite(kg)) return '—'
  const arrondi = Number(kg.toFixed(2))
  // Number(-0.001.toFixed(2)) vaut -0 : on l'affiche « 0 »
  return String(arrondi === 0 ? 0 : arrondi).replace('.', ',')
}
