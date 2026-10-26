import { detecterTypeExport, ImportError, type TypeExport } from './schema'

export interface FichierImport {
  type: TypeExport
  data: unknown
}

// Lit le texte d'un fichier d'import : JSON invalide ou tronqué -> ImportError en français
// (le message natif de JSON.parse, en anglais et technique, n'est pas exposé).
export function parseImportFile(texte: string): FichierImport {
  let data: unknown
  try {
    data = JSON.parse(texte)
  } catch {
    throw new ImportError('Fichier JSON invalide ou tronqué', '')
  }
  // detecterTypeExport refuse tout ce qui n'est pas un objet (tableau, nombre, null)
  return { type: detecterTypeExport(data), data }
}
