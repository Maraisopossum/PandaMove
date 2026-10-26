// Conversions des champs de formulaire. Une saisie vide donne NaN (champ obligatoire, refusé par la
// validation) ou null (champ facultatif) ; jamais 0 silencieux.
export function versNombre(texte: string): number {
  return texte.trim() === '' ? Number.NaN : Number(texte.replace(',', '.'))
}

export function versNombreOuNull(texte: string): number | null {
  return texte.trim() === '' ? null : Number(texte.replace(',', '.'))
}

// Analyse d'une frappe dans un champ numérique (point ou virgule décimale). Exposants (1e3), lettres
// et signes parasites sont refusés : `accepte` vaut false et la saisie est ignorée par le champ.
// Texte vide -> NaN (obligatoire) ou null (facultatif). « 2. » vaut 2 ; les saisies incomplètes
// (« - », « . », « , ») valent NaN, ce que la validation signale en français.
export function analyserSaisie(texte: string, facultatif: boolean): { accepte: boolean; valeur: number | null } {
  if (!/^-?\d*[.,]?\d*$/.test(texte)) return { accepte: false, valeur: null }
  if (texte === '') return { accepte: true, valeur: facultatif ? null : Number.NaN }
  if (!/\d/.test(texte)) return { accepte: true, valeur: Number.NaN }
  return { accepte: true, valeur: Number(texte.replace(',', '.')) }
}

// Valeur affichable d'un champ numérique (NaN et null -> champ vide), avec la virgule décimale
// française ; analyserSaisie relit indifféremment virgule et point.
export function texteNombre(n: number | null): string {
  return n === null || Number.isNaN(n) ? '' : String(n).replace('.', ',')
}

// Date du jour au format yyyy-MM-dd, en heure LOCALE (toISOString donnerait la date UTC).
export function aujourdhuiIso(maintenant: Date = new Date()): string {
  const deux = (n: number) => String(n).padStart(2, '0')
  return `${maintenant.getFullYear()}-${deux(maintenant.getMonth() + 1)}-${deux(maintenant.getDate())}`
}
