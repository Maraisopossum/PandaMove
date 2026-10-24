// Conversions des champs de formulaire. Une saisie vide donne NaN (champ obligatoire, refusé par la
// validation) ou null (champ facultatif) ; jamais 0 silencieux.
export function versNombre(texte: string): number {
  return texte.trim() === '' ? Number.NaN : Number(texte.replace(',', '.'))
}

export function versNombreOuNull(texte: string): number | null {
  return texte.trim() === '' ? null : Number(texte.replace(',', '.'))
}

// Valeur affichable d'un champ numérique (NaN et null -> champ vide).
export function texteNombre(n: number | null): string {
  return n === null || Number.isNaN(n) ? '' : String(n)
}

// Date du jour au format yyyy-MM-dd, en heure LOCALE (toISOString donnerait la date UTC).
export function aujourdhuiIso(maintenant: Date = new Date()): string {
  const deux = (n: number) => String(n).padStart(2, '0')
  return `${maintenant.getFullYear()}-${deux(maintenant.getMonth() + 1)}-${deux(maintenant.getDate())}`
}
