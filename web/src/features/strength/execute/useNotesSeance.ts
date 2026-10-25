import { useState } from 'react'

// Commentaire de séance : texte local pendant la frappe, enregistré à la sortie du champ (blur) s'il a changé.
// Quand le texte enregistré change depuis l'extérieur (chargement), le champ est resynchronisé.
export function useNotesSeance(enregistre: string, enregistrer: (texte: string) => Promise<boolean>) {
  const [texte, setTexte] = useState(enregistre)
  const [vu, setVu] = useState(enregistre)
  if (vu !== enregistre) {
    setVu(enregistre)
    setTexte(enregistre)
  }
  return {
    texte,
    changer: setTexte,
    sortir: () => {
      if (texte !== enregistre) void enregistrer(texte)
    },
  }
}
