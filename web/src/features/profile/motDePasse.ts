export const LONGUEUR_MIN_MOT_DE_PASSE = 8

// Valide le nouveau mot de passe : renvoie le message d'erreur à afficher, ou null s'il est acceptable.
export function erreurMotDePasse(nouveau: string, confirmation: string): string | null {
  if (nouveau.length < LONGUEUR_MIN_MOT_DE_PASSE) return `Le mot de passe doit contenir au moins ${LONGUEUR_MIN_MOT_DE_PASSE} caractères.`
  if (nouveau !== confirmation) return 'Les deux mots de passe ne sont pas identiques.'
  return null
}
