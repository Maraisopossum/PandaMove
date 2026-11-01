import { extraireJson } from './extraire'
import { validerFichierIA, type FichierIA } from './format'

export interface AnalyseIA {
  /** null dès qu'une erreur bloque l'import. */
  donnees: FichierIA | null
  /** Erreurs bloquantes, en français, avec le chemin fautif. */
  erreurs: string[]
  /** Champs inconnus ignorés. */
  avertissements: string[]
  /** Réparations ou extractions faites sur le texte (information). */
  notes: string[]
}

/** Texte (fichier ou collage) -> JSON extrait -> fichier validé. Pur : aucune base, aucun réseau. */
export function analyserTexteIA(texte: string): AnalyseIA {
  const extrait = extraireJson(texte)
  if (!extrait.ok) return { donnees: null, erreurs: [extrait.erreur], avertissements: [], notes: [] }
  const v = validerFichierIA(extrait.valeur)
  return { donnees: v.donnees, erreurs: v.erreurs.map((e) => e.texte), avertissements: v.avertissements, notes: extrait.notes }
}
