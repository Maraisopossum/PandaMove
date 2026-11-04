import { useId } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { LIMITES_RESPIRATION } from '../../core/db/repos/respiration'
import { useMethodeForm, type ChampDuree } from './useMethodeForm'

interface LigneProps {
  libelle: string
  secondes: number
  /** undefined : phase toujours active (inspiration, expiration). */
  active?: boolean
  onActiver?: (active: boolean) => void
  onChanger: (delta: number) => void
}

// Une phase : case d'activation (phases facultatives) et durée en secondes avec − / +.
function LignePhase({ libelle, secondes, active = true, onActiver, onChanger }: LigneProps) {
  const id = useId()
  return (
    <div className="respiration__phase" role="group" aria-labelledby={id}>
      {onActiver ? (
        <label className="formulaire__case">
          <input type="checkbox" checked={active} onChange={(e) => onActiver(e.target.checked)} />
          <span id={id}>{libelle}</span>
        </label>
      ) : (
        <span id={id}>{libelle}</span>
      )}
      <div className="respiration__compteur">
        <button type="button" className="bouton" aria-label={`Diminuer : ${libelle}`} disabled={!active || secondes <= 1} onClick={() => onChanger(-1)}>
          −
        </button>
        <span className="respiration__duree" aria-live="polite">
          {secondes} s
        </span>
        <button type="button" className="bouton" aria-label={`Augmenter : ${libelle}`} disabled={!active || secondes >= LIMITES_RESPIRATION.phaseSec} onClick={() => onChanger(1)}>
          +
        </button>
      </div>
    </div>
  )
}

// Création (`/breathing/new`) et modification (`/breathing/:id/edit`) d'une méthode personnalisée.
export default function MethodeFormScreen() {
  const { id } = useParams()
  const navigate = useNavigate()
  const form = useMethodeForm(id)
  const { brouillon: b } = form
  const idEmoji = useId()
  const idNom = useId()
  const duree = (champ: ChampDuree) => (delta: number) => form.changerDuree(champ, delta)

  if (form.chargement) return <p role="status">Chargement…</p>
  if (form.introuvable) {
    return (
      <div className="respiration">
        <h1 className="titre-ecran">Méthode introuvable</h1>
        <p>Cette méthode n’existe plus.</p>
        <Link to="/breathing" className="bouton">
          Retour à la respiration
        </Link>
      </div>
    )
  }

  return (
    <form
      className="respiration respiration__formulaire"
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        void form.enregistrer().then((ok) => ok && navigate('/breathing'))
      }}
    >
      <h1 className="titre-ecran">{id === undefined ? 'Nouvelle méthode' : 'Modifier la méthode'}</h1>

      <fieldset className="formulaire__groupe">
        <legend>Identité</legend>
        <div className="respiration__identite">
          <div className="formulaire__champ">
            <label htmlFor={idEmoji}>Emoji</label>
            <input id={idEmoji} type="text" value={b.emoji} maxLength={LIMITES_RESPIRATION.emoji} onChange={(e) => form.modifierChamps({ emoji: e.target.value })} />
          </div>
          <div className="formulaire__champ">
            <label htmlFor={idNom}>Nom de la méthode</label>
            <input id={idNom} type="text" value={b.nom} maxLength={LIMITES_RESPIRATION.nom} autoCapitalize="sentences" onChange={(e) => form.modifierChamps({ nom: e.target.value })} />
          </div>
        </div>
      </fieldset>

      <fieldset className="formulaire__groupe">
        <legend>Durées des phases</legend>
        <LignePhase libelle="Inspiration" secondes={b.inspireSec} onChanger={duree('inspireSec')} />
        <LignePhase
          libelle="Rétention (poumons pleins)"
          secondes={b.retentionPleineSec}
          active={b.retentionPleine}
          onActiver={(retentionPleine) => form.modifierChamps({ retentionPleine })}
          onChanger={duree('retentionPleineSec')}
        />
        <LignePhase libelle="Expiration" secondes={b.expireSec} onChanger={duree('expireSec')} />
        <LignePhase
          libelle="Rétention (poumons vides)"
          secondes={b.retentionVideSec}
          active={b.retentionVide}
          onActiver={(retentionVide) => form.modifierChamps({ retentionVide })}
          onChanger={duree('retentionVideSec')}
        />
      </fieldset>

      <fieldset className="formulaire__groupe">
        <legend>Nombre de cycles par défaut</legend>
        <div className="respiration__compteur">
          <button type="button" className="bouton" aria-label="Diminuer le nombre de cycles" disabled={b.cyclesDefaut <= 1} onClick={() => form.changerCycles(-1)}>
            −
          </button>
          <p className="respiration__valeur" role="status" aria-label={`${b.cyclesDefaut} cycles`}>
            <strong>{b.cyclesDefaut}</strong>
            <span className="aide">cycles</span>
          </p>
          <button type="button" className="bouton" aria-label="Augmenter le nombre de cycles" disabled={b.cyclesDefaut >= LIMITES_RESPIRATION.cyclesDefaut} onClick={() => form.changerCycles(1)}>
            +
          </button>
        </div>
      </fieldset>

      <p className="respiration__apercu">
        <span className="aide">Aperçu de la description</span>
        <strong>{form.apercu}</strong>
      </p>

      {form.erreur && (
        <p role="alert" className="formulaire__erreur">
          {form.erreur}
        </p>
      )}

      <div className="formulaire__ligne">
        <button type="submit" className="bouton bouton--principal" disabled={!form.peutEnregistrer}>
          {id === undefined ? 'Créer la méthode' : 'Enregistrer les modifications'}
        </button>
        <Link to="/breathing" className="bouton">
          Annuler
        </Link>
      </div>
    </form>
  )
}
