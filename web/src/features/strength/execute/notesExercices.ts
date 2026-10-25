// Notes par exercice de l'écran d'exécution. Sur Android elles ne vivent qu'en mémoire (exerciceNotesLocal) et
// disparaissent à la fermeture ; ici elles sont gardées dans le navigateur par séance, sans colonne en base
// (le commentaire de la séance, lui, est enregistré avec l'instance). Fonctions pures.
export type NotesExercices = Record<string, string>

/** Lecture défensive du texte stocké : tout ce qui n'est pas « id -> texte » est ignoré. */
export function lireNotes(texte: string | null): NotesExercices {
  if (texte === null) return {}
  try {
    const v: unknown = JSON.parse(texte)
    if (typeof v !== 'object' || v === null || Array.isArray(v)) return {}
    return Object.fromEntries(Object.entries(v).filter((e): e is [string, string] => typeof e[1] === 'string'))
  } catch {
    return {}
  }
}

export const serialiserNotes = (notes: NotesExercices): string => JSON.stringify(notes)

/** Nouvelle table avec la note de l'exercice remplacée ; un texte vide retire la note. */
export function modifierNote(notes: NotesExercices, exerciceId: string, texte: string): NotesExercices {
  const { [exerciceId]: _ancienne, ...autres } = notes
  void _ancienne
  return texte === '' ? autres : { ...autres, [exerciceId]: texte }
}
