// Portage de String.normalizeSearch() (core/common, StringUtils.kt) : décomposition NFD, retrait
// des diacritiques, minuscules, trim. Ajout web : les espaces internes sont fusionnés, pour que
// « Développé  couché » et « developpe couche » désignent le même exercice.
export function normalizeSearch(texte: string): string {
  return texte
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}
