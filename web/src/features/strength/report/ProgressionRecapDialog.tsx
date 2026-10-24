import { useId, useRef } from 'react'
import { ChampNombreFacultatif } from '../champs'
import { usePiegeFocus } from '../usePiegeFocus'
import { useAjustement } from './useAjustement'
import type { LigneRecap } from './useEcranBilan'

interface Props {
  lignes: LigneRecap[]
  erreur: string | null
  onAccepter: (exerciceId: string) => void
  onRefuser: (exerciceId: string) => void
  onAjuster: (exerciceId: string, chargeKg: number) => void
  onFermer: () => void
}

// Récap de progression (miroir de ProgressionRecapDialog Android) : une ligne par exercice évalué,
// Oui / Non, garder / Ajuster pour les propositions à valider. Rien n'est imposé : un deload n'est
// écrit qu'après « Oui » ou « Ajuster ». Dialogue modal à coins de 28 px, focus piégé, Échap ferme,
// le focus revient à l'élément d'origine.
export function ProgressionRecapDialog({ lignes, erreur, onAccepter, onRefuser, onAjuster, onFermer }: Props) {
  const racine = useRef<HTMLDivElement>(null)
  const idTitre = useId()
  const ajustement = useAjustement()
  usePiegeFocus(racine, onFermer)

  return (
    <div className="dialogue__voile">
      <div ref={racine} className="dialogue recap" role="dialog" aria-modal="true" aria-labelledby={idTitre} tabIndex={-1}>
        <h2 id={idTitre}>Progression</h2>
        {erreur && (
          <p role="alert" className="import__erreur">
            {erreur}
          </p>
        )}
        <ul className="recap__liste">
          {lignes.map((l) => (
            <li key={l.exerciceId} className="recap__ligne">
              <p className="recap__nom">{l.nom}</p>
              {l.texte && <p className="recap__texte">{l.texte}</p>}
              {l.explication && (
                <p className={l.deload ? 'recap__explication recap__explication--deload' : 'recap__explication'}>{l.explication}</p>
              )}
              {l.actionnable && l.etat === 'en_attente' ? (
                <>
                  <div className="recap__choix" role="group" aria-label={`Choix pour ${l.nom}`}>
                    <button type="button" className="bouton bouton--principal" onClick={() => onAccepter(l.exerciceId)}>
                      Oui
                    </button>
                    <button type="button" className="bouton" onClick={() => onRefuser(l.exerciceId)}>
                      Non, garder
                    </button>
                    <button
                      type="button"
                      className="bouton"
                      aria-pressed={ajustement.exerciceId === l.exerciceId}
                      onClick={() => ajustement.ouvrir(l.exerciceId, l.chargeProposee)}
                    >
                      Ajuster
                    </button>
                  </div>
                  {ajustement.exerciceId === l.exerciceId && (
                    <form
                      className="recap__ajustement"
                      onSubmit={(e) => {
                        e.preventDefault()
                        onAjuster(l.exerciceId, ajustement.valeur())
                      }}
                    >
                      <ChampNombreFacultatif libelle="Nouvelle charge (kg)" valeur={ajustement.chargeKg} onChange={ajustement.setChargeKg} />
                      <button type="submit" className="bouton">
                        Valider la charge
                      </button>
                    </form>
                  )}
                </>
              ) : (
                <p className="recap__etat">{l.libelleEtat}</p>
              )}
            </li>
          ))}
        </ul>
        <div className="formulaire__ligne">
          <button type="button" className="bouton" onClick={onFermer}>
            Fermer
          </button>
        </div>
      </div>
    </div>
  )
}
