import { useId, useRef } from 'react'
import { formaterCharge } from '../../../core/common/formaterCharge'
import { ChampNombreFacultatif } from '../champs'
import { usePiegeFocus } from '../usePiegeFocus'
import type { ChoixRecap } from './useReport'
import { useChoixRecap } from './useChoixRecap'
import type { LigneRecap } from './useEcranBilan'

interface Props {
  lignes: LigneRecap[]
  sousTitre: string
  erreur: string | null
  enCours: boolean
  onValider: (choix: ChoixRecap[]) => void
  onFermer: () => void
}

const CHOIX: { valeur: ChoixRecap['choix']; libelle: string }[] = [
  { valeur: 'oui', libelle: 'Oui' },
  { valeur: 'non', libelle: 'Non, garder' },
  { valeur: 'ajuster', libelle: 'Ajuster' },
]

// Récap de progression (miroir de ProgressionRecapDialog Android) : une carte par exercice, Oui / Non, garder /
// Ajuster (Oui présélectionné), puis un seul « Valider ». Rien n'est écrit avant « Valider » et un deload n'est
// jamais appliqué sans ce geste explicite. « Plus tard » ferme sans rien écrire (le récap se rouvre depuis le
// rapport) ; c'est l'action qui reçoit le focus à l'ouverture. Dialogue modal à coins de 28 px, focus piégé,
// Échap ferme, le focus revient à l'élément d'origine.
export function ProgressionRecapDialog({ lignes, sousTitre, erreur, enCours, onValider, onFermer }: Props) {
  const racine = useRef<HTMLDivElement>(null)
  const plusTard = useRef<HTMLButtonElement>(null)
  const idTitre = useId()
  const idAide = useId()
  const choix = useChoixRecap(lignes)
  usePiegeFocus(racine, onFermer, plusTard)
  const aDecider = choix.lot().length > 0

  return (
    <div className="dialogue__voile">
      <div ref={racine} className="dialogue recap" role="dialog" aria-modal="true" aria-labelledby={idTitre} tabIndex={-1}>
        <h2 id={idTitre}>Progression</h2>
        {sousTitre && <p className="recap__sous-titre">{sousTitre}</p>}
        {erreur && (
          <p role="alert" className="import__erreur">
            {erreur}
          </p>
        )}
        <ul className="recap__liste">
          {lignes.map((l) => {
            const modifiable = l.actionnable && l.etat === 'en_attente'
            const proche = choix.conseilDe(l.exerciceId)
            return (
              <li key={l.exerciceId} className="recap__ligne">
                {modifiable ? (
                  <fieldset className="recap__groupe">
                    <legend className="recap__nom">{l.nom}</legend>
                    {l.explication && (
                      <p className={l.deload ? 'recap__explication recap__explication--deload' : 'recap__explication'}>{l.explication}</p>
                    )}
                    {l.texte && <p className="recap__texte">{l.texte}</p>}
                    <div className="recap__choix">
                      {CHOIX.map((c) => (
                        <label key={c.valeur} className="recap__option">
                          <input
                            type="radio"
                            name={`choix-${l.exerciceId}`}
                            checked={choix.choixDe(l.exerciceId) === c.valeur}
                            onChange={() => choix.choisir(l.exerciceId, c.valeur)}
                          />
                          <span>{c.libelle}</span>
                        </label>
                      ))}
                    </div>
                    {choix.choixDe(l.exerciceId) === 'ajuster' && (
                      <div className="recap__ajustement">
                        <ChampNombreFacultatif
                          libelle="Nouvelle charge (kg)"
                          valeur={choix.chargeDe(l.exerciceId)}
                          onChange={(kg) => choix.saisirCharge(l.exerciceId, kg)}
                        />
                        <p className="recap__aide" id={`${idAide}-${l.exerciceId}`}>
                          Ajuster : vous choisissez vous-même la charge visée à la prochaine séance ; elle remplace la charge proposée.
                        </p>
                        {proche !== null && (
                          <p className="recap__conseil">
                            Pas composable avec votre matériel : la charge la plus proche est {formaterCharge(proche)} kg.{' '}
                            <button type="button" className="bouton" onClick={() => choix.arrondir(l.exerciceId)}>
                              {`Arrondir à ${formaterCharge(proche)} kg`}
                            </button>
                          </p>
                        )}
                      </div>
                    )}
                  </fieldset>
                ) : (
                  <>
                    <p className="recap__nom">{l.nom}</p>
                    {l.explication && (
                      <p className={l.deload ? 'recap__explication recap__explication--deload' : 'recap__explication'}>{l.explication}</p>
                    )}
                    {l.texte && <p className="recap__texte">{l.texte}</p>}
                    <p className="recap__etat">{l.libelleEtat}</p>
                  </>
                )}
              </li>
            )
          })}
        </ul>
        <div className="formulaire__ligne">
          <button ref={plusTard} type="button" className="bouton" onClick={onFermer}>
            {aDecider ? 'Plus tard' : 'Fermer'}
          </button>
          {aDecider && (
            <button type="button" className="bouton bouton--principal" disabled={enCours} onClick={() => onValider(choix.lot())}>
              Valider
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
