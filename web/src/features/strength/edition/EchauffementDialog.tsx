import { useId, useRef } from 'react'
import { usePiegeFocus } from '../usePiegeFocus'
import type { ModeleEchauffement } from './echauffement'

interface Props {
  /** null : chargement en cours */
  modeles: ModeleEchauffement[] | null
  erreur: string | null
  onChoisir: (id: string) => void
  onFermer: () => void
}

// Choix d'un modèle d'échauffement à recopier en tête de séance (Android WarmupPickerSheet).
export function EchauffementDialog({ modeles, erreur, onChoisir, onFermer }: Props) {
  const racine = useRef<HTMLDivElement>(null)
  const idTitre = useId()
  usePiegeFocus(racine, onFermer)
  return (
    <div className="dialogue__voile">
      <div ref={racine} className="dialogue" role="dialog" aria-modal="true" aria-labelledby={idTitre} tabIndex={-1}>
        <h2 id={idTitre}>Choisir un échauffement</h2>
        {erreur && <p role="alert">{erreur}</p>}
        {modeles === null ? (
          <p>Chargement…</p>
        ) : modeles.length === 0 ? (
          <p>Aucun échauffement disponible.</p>
        ) : (
          <ul className="selecteur__liste">
            {modeles.map((m) => (
              <li key={m.id}>
                <button type="button" className="bouton selecteur__choix" onClick={() => onChoisir(m.id)}>
                  <strong>{m.nom}</strong>
                  {m.notes.trim() !== '' && <span className="aide"> {m.notes}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="formulaire__ligne">
          <button type="button" className="bouton" onClick={onFermer}>
            Fermer
          </button>
        </div>
      </div>
    </div>
  )
}
