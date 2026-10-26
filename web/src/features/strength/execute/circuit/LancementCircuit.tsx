import type { Lancement } from './plan'
import { ReglagesRetours } from './ReglagesRetours'

interface Props {
  lancement: Lancement
  /** Rappel des réglages du circuit (vide pour le minuteur seul) */
  recap: string
  erreur: string | null
  onLancer: () => void
}

// Encart de lancement dans le bloc : rappel des réglages, aide d'une ligne, gros bouton.
// Circuit : « Démarrer / Reprendre le circuit » ; exercice en durée hors circuit : « Démarrer le minuteur »
// (libellé distinct du « Démarrer » de la séance, pour ne pas confondre les deux boutons).
export function LancementCircuit({ lancement, recap, erreur, onLancer }: Props) {
  const circuit = lancement.type === 'circuit'
  return (
    <section className="circuit-lancement" aria-label={circuit ? 'Circuit automatique' : 'Minuteur de l’exercice'}>
      {circuit && <p className="circuit-lancement__recap">{recap}</p>}
      <p className="aide">
        {circuit
          ? 'Les exercices s’enchaînent tout seuls : décompte 3-2-1, minuteur, série enregistrée automatiquement, puis repos. Durées : colonne « Temps » ci-dessous ; repos : réglages du circuit.'
          : 'Décompte 3-2-1, puis le minuteur chronomètre la prochaine série et l’enregistre tout seul. Durée : colonne « Temps » ci-dessous.'}
      </p>
      <button type="button" className="bouton bouton--principal circuit-lancement__bouton" onClick={onLancer}>
        <span aria-hidden="true">▶ </span>
        {circuit ? (lancement.reprise ? 'Reprendre le circuit' : 'Démarrer le circuit') : 'Démarrer le minuteur'}
      </button>
      <details className="plus-options">
        <summary>Son, vibration, voix</summary>
        <ReglagesRetours />
      </details>
      {erreur && (
        <p role="alert" className="import__erreur">
          {erreur}
        </p>
      )}
    </section>
  )
}
