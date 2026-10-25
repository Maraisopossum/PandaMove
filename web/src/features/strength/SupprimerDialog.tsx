import { useId, useRef } from 'react'
import { usePiegeFocus } from './usePiegeFocus'
import { texteHistorique, type Historique, type ModeSuppression } from './suppression'

interface Props {
  nomSeance: string
  historique: Historique
  enCours: boolean
  onChoisir: (mode: ModeSuppression) => void
  onFermer: () => void
}

// Dialogue modal de suppression (coins arrondis 28 px). Avec de l'historique : deux choix expliqués ;
// sans historique : une seule confirmation. Focus piégé, Échap ferme, le focus revient au bouton d'origine.
export function SupprimerDialog({ nomSeance, historique, enCours, onChoisir, onFermer }: Props) {
  const racine = useRef<HTMLDivElement>(null)
  const boutonAnnuler = useRef<HTMLButtonElement>(null)
  const idTitre = useId()
  const idGarder = useId()
  const idTout = useId()
  usePiegeFocus(racine, onFermer, boutonAnnuler) // focus initial non destructif
  const aHistorique = historique.planifiees + historique.realisees > 0

  return (
    <div className="dialogue__voile">
      <div ref={racine} className="dialogue" role="dialog" aria-modal="true" aria-labelledby={idTitre} tabIndex={-1}>
        <h2 id={idTitre}>Supprimer cette séance ?</h2>
        <p>« {nomSeance} »</p>
        {aHistorique && <p>{texteHistorique(historique)}</p>}
        <p>
          <strong>Cette action est définitive.</strong>
        </p>
        {aHistorique ? (
          <div className="dialogue__choix">
            <button type="button" className="bouton" disabled={enCours} aria-describedby={idGarder} onClick={() => onChoisir('garder_historique')}>
              Garder l'historique
            </button>
            <p id={idGarder} className="dialogue__aide">
              Supprime la séance type et les séances programmées, conserve les séances déjà terminées (calendrier, statistiques).
            </p>
            <button type="button" className="bouton" disabled={enCours} aria-describedby={idTout} onClick={() => onChoisir('tout')}>
              Tout supprimer
            </button>
            <p id={idTout} className="dialogue__aide">
              Supprime aussi les séances terminées et leurs séries.
            </p>
          </div>
        ) : (
          <div className="formulaire__ligne">
            <button type="button" className="bouton" disabled={enCours} onClick={() => onChoisir('tout')}>
              Supprimer
            </button>
          </div>
        )}
        <div className="formulaire__ligne">
          <button ref={boutonAnnuler} type="button" className="bouton" onClick={onFermer}>
            Annuler
          </button>
        </div>
      </div>
    </div>
  )
}
