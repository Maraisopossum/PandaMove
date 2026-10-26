import { CarteSelectionnable } from './CarteSelectionnable'
import type { LigneInstance } from './useEcranListeInstances'
import type { useSelection } from './useSelection'

interface Props {
  ligne: LigneInstance
  selection: ReturnType<typeof useSelection>
  onChangerDate: (l: LigneInstance) => void
  onSupprimer: (l: LigneInstance) => void
}

// Carte d'une séance jouée (programmée ou terminée), commune à l'écran Séances (sections) et aux vues complètes
// « Séances programmées » / « Séances terminées ». Pas d'affectation 📅 ici (séances types uniquement).
export function CarteInstance({ ligne: l, selection: sel, onChangerDate, onSupprimer }: Props) {
  return (
    <CarteSelectionnable
      lien={l.lien}
      designation={l.designation}
      mode={sel.mode}
      choisie={sel.estSelectionne(l.id)}
      onBasculer={() => sel.basculer(l.id)}
      onAppuiLong={() => sel.entrer(l.id)}
      actions={
        <>
          {l.peutChangerDate && (
            <button type="button" className="bouton" aria-label={`Changer la date de ${l.designation}`} onClick={() => onChangerDate(l)}>
              Changer la date
            </button>
          )}
          <button type="button" className="bouton" aria-label={`Supprimer ${l.designation}`} onClick={() => onSupprimer(l)}>
            Supprimer
          </button>
        </>
      }
    >
      <span className="seance__nom">
        {l.nom}
        {l.enCours && <span className="instances__badge">En cours</span>}
      </span>
      <span className="seance__details">
        {l.date}
        {l.details && <> · {l.details}</>}
      </span>
    </CarteSelectionnable>
  )
}
