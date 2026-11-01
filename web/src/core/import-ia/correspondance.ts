import { normalizeSearch } from '../common/normalizeSearch'

// Correspondance entre le nom écrit par l'IA et le catalogue. Jamais de substitution silencieuse :
//  - égalité après normalizeSearch (accents, casse, espaces) : « exact » ;
//  - alias simples (pluriels, tirets, parenthèses) quand UN SEUL exercice correspond : « alias » ;
//  - sinon « inconnu » : l'exercice sera créé, avec le nom le plus proche en simple suggestion (≤ 2 éditions).

export interface ExerciceNomme {
  id: string
  name: string
}

export type Correspondance<T extends ExerciceNomme> =
  | { type: 'exact'; exercice: T }
  | { type: 'alias'; exercice: T }
  | { type: 'inconnu'; proche: { id: string; name: string; distance: number } | null }

export const DISTANCE_MAX_SUGGESTION = 2

/** Distance de Levenshtein (nombre d'éditions d'un caractère). */
export function distanceEdition(a: string, b: string): number {
  if (a === b) return 0
  let precedente = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const courante = [i]
    for (let j = 1; j <= b.length; j++) {
      courante[j] = Math.min(precedente[j] + 1, courante[j - 1] + 1, precedente[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
    precedente = courante
  }
  return precedente[b.length]
}

// Singulier approximatif d'un mot (« haltères » -> « haltere », « tractions » -> « traction »).
const singulier = (mot: string) => (mot.length > 3 && /[sx]$/.test(mot) ? mot.slice(0, -1) : mot)

function cleAlias(nom: string, parentheses: 'ignorees' | 'depliees'): string {
  const sansParentheses = parentheses === 'ignorees' ? nom.replace(/\([^)]*\)/g, ' ') : nom.replace(/[()]/g, ' ')
  return normalizeSearch(sansParentheses)
    .replace(/[-–—'’.,;:/]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map(singulier)
    .join(' ')
}

export function trouverExercice<T extends ExerciceNomme>(nom: string, catalogue: readonly T[]): Correspondance<T> {
  const cle = normalizeSearch(nom)
  const exact = catalogue.find((e) => normalizeSearch(e.name) === cle)
  if (exact) return { type: 'exact', exercice: exact }

  for (const mode of ['depliees', 'ignorees'] as const) {
    const voulue = cleAlias(nom, mode)
    if (voulue === '') continue
    const trouves = catalogue.filter((e) => cleAlias(e.name, 'depliees') === voulue)
    if (trouves.length === 1) return { type: 'alias', exercice: trouves[0] }
  }

  let proche: { id: string; name: string; distance: number } | null = null
  for (const e of catalogue) {
    const distance = distanceEdition(cle, normalizeSearch(e.name))
    if (distance <= DISTANCE_MAX_SUGGESTION && (proche === null || distance < proche.distance)) {
      proche = { id: e.id, name: e.name, distance }
    }
  }
  return { type: 'inconnu', proche }
}
