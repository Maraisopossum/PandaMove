// Présentation des durées de la mobilité. 600 -> « 10 min » ; 615 -> « 10 min 15 s » ; 45 -> « 45 s ».
export function formaterMinutes(secondes: number): string {
  const total = Math.max(0, Math.round(secondes))
  const m = Math.floor(total / 60)
  const s = total % 60
  if (m === 0) return `${s} s`
  return s === 0 ? `${m} min` : `${m} min ${s} s`
}

// Chronomètre : 75 -> « 1:15 », 9 -> « 0:09 ».
export function formaterChrono(secondes: number): string {
  const total = Math.max(0, Math.round(secondes))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

// Illustration d'un exercice (le panda qui exécute le mouvement) : public/mobilite/<id>-<variante>.webp, 384 px, fond transparent.
export const urlExercice = (id: string, variante: 'male' | 'female') => `/mobilite/${id}-${variante}.webp`
