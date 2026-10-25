import { useCallback, useState } from 'react'
import { lireNotes, modifierNote, serialiserNotes, type NotesExercices } from './notesExercices'
import { ecrireStockage, lireStockage } from './stockageNavigateur'

const cleStockage = (instanceId: string) => `pandamove.notes-exercices.${instanceId}`

// Note de chaque exercice de la séance en cours, enregistrée à chaque frappe dans le navigateur.
export function useNotesExercices(instanceId: string) {
  const [notes, setNotes] = useState<NotesExercices>(() => lireNotes(lireStockage(cleStockage(instanceId))))
  const changer = useCallback(
    (exerciceId: string, texte: string) =>
      setNotes((n) => {
        const suivantes = modifierNote(n, exerciceId, texte)
        ecrireStockage(cleStockage(instanceId), serialiserNotes(suivantes))
        return suivantes
      }),
    [instanceId],
  )
  return { note: (exerciceId: string) => notes[exerciceId] ?? '', changer }
}
