import { v4, v5 } from 'uuid'

// Identifiant aléatoire d'une nouvelle ligne.
export function newId(): string {
  return v4()
}

// UUID v5 : même (namespace, name) => même id sur tous les appareils.
// Le namespace libre (ex. id utilisateur) est d'abord dérivé en UUID v5 sous un espace fixe,
// car v5 exige un namespace UUID.
const ESPACE_PANDAMOVE = 'b3c1c8a4-6f0e-4b7a-9d57-2f5e8a1d4c10'

export function deterministicId(namespace: string, name: string): string {
  return v5(name, v5(namespace, ESPACE_PANDAMOVE))
}
