import { useId, useRef } from 'react'
import type { GenreCardio } from '../../../core/db/repos/seancesCardio'
import { usePiegeFocus } from '../../../core/ui/usePiegeFocus'
import { LIBELLE_GENRE } from '../evenements'
import type { BrouillonSeanceCardio, ChampBrouillon, ErreursSaisie } from './saisieCardio'

interface Props {
  mode: 'creation' | 'edition'
  brouillon: BrouillonSeanceCardio
  /** Un message par champ invalide (validation faite par le hook de l'écran). */
  erreurs: ErreursSaisie
  /** Échec de l'enregistrement lui-même (message déjà en français). */
  erreurGenerale: string | null
  enCours: boolean
  onChange: (partiel: Partial<BrouillonSeanceCardio>) => void
  onEnregistrer: () => void
  onFermer: () => void
}

const GENRES: GenreCardio[] = ['course', 'velo']

// Dialogue modal (coins arrondis 28 px) de création et d'édition d'une séance de cardio. Même modèle que le dialogue
// « Changer la date » : focus piégé, Échap ferme, le focus revient au bouton d'origine. Le composant n'a ni état ni règle
// métier : le brouillon et sa validation viennent du hook de l'écran.
export function FeuilleSeanceCardio({ mode, brouillon, erreurs, erreurGenerale, enCours, onChange, onEnregistrer, onFermer }: Props) {
  const racine = useRef<HTMLDivElement>(null)
  const champTitre = useRef<HTMLInputElement>(null)
  const id = useId()
  usePiegeFocus(racine, onFermer, champTitre)

  const idChamp = (champ: ChampBrouillon) => `${id}-${champ}`
  const idErreur = (champ: ChampBrouillon) => `${id}-${champ}-erreur`
  // Attributs d'un champ : invalide si une erreur existe, et relié à son message (et à son aide éventuelle)
  const liaison = (champ: ChampBrouillon, aide?: string) => {
    const decrit = [aide, erreurs[champ] ? idErreur(champ) : undefined].filter(Boolean).join(' ')
    return {
      id: idChamp(champ),
      'aria-invalid': erreurs[champ] ? (true as const) : undefined,
      'aria-describedby': decrit || undefined,
    }
  }
  const message = (champ: ChampBrouillon) =>
    erreurs[champ] && (
      <p id={idErreur(champ)} className="formulaire__erreur">
        {erreurs[champ]}
      </p>
    )

  const idTitre = `${id}-titre-dialogue`
  const idAideLien = `${id}-lien-aide`
  const creation = mode === 'creation'

  return (
    <div className="dialogue__voile">
      <div ref={racine} className="dialogue" role="dialog" aria-modal="true" aria-labelledby={idTitre} tabIndex={-1}>
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            onEnregistrer()
          }}
        >
          <h2 id={idTitre}>{creation ? 'Ajouter une séance de cardio' : `Modifier « ${brouillon.titre} »`}</h2>

          {creation ? (
            <fieldset className="formulaire__groupe">
              <legend>Type de séance</legend>
              {GENRES.map((genre) => (
                <label key={genre} className="formulaire__case">
                  <input type="radio" name={`${id}-genre`} checked={brouillon.genre === genre} onChange={() => onChange({ genre })} />
                  {LIBELLE_GENRE[genre]}
                </label>
              ))}
            </fieldset>
          ) : (
            <p className="dialogue__aide">
              Séance de <strong>{LIBELLE_GENRE[brouillon.genre]}</strong>
            </p>
          )}

          <div className="formulaire__champ">
            <label htmlFor={idChamp('titre')}>Titre</label>
            <input ref={champTitre} type="text" value={brouillon.titre} onChange={(e) => onChange({ titre: e.target.value })} {...liaison('titre')} />
            {message('titre')}
          </div>

          {creation && (
            <div className="formulaire__champ">
              <label htmlFor={idChamp('date')}>Date</label>
              <input type="date" value={brouillon.date} onChange={(e) => onChange({ date: e.target.value })} {...liaison('date')} />
              {message('date')}
            </div>
          )}

          <div className="formulaire__champ">
            <label htmlFor={idChamp('consigne')}>Consigne</label>
            <textarea rows={3} value={brouillon.consigne} onChange={(e) => onChange({ consigne: e.target.value })} {...liaison('consigne')} />
            {message('consigne')}
          </div>

          <div className="formulaire__champ">
            <label htmlFor={idChamp('detail')}>Détail</label>
            <input type="text" placeholder="45 min · Z2" value={brouillon.detail} onChange={(e) => onChange({ detail: e.target.value })} {...liaison('detail')} />
            {message('detail')}
          </div>

          <div className="formulaire__champ">
            <label htmlFor={idChamp('jalon')}>Jalon</label>
            <input type="text" value={brouillon.jalon} onChange={(e) => onChange({ jalon: e.target.value })} {...liaison('jalon')} />
            {message('jalon')}
          </div>

          <label className="formulaire__case">
            <input type="checkbox" checked={brouillon.optionnelle} onChange={(e) => onChange({ optionnelle: e.target.checked })} />
            Optionnelle
          </label>

          <div className="formulaire__champ">
            <label htmlFor={idChamp('lien')}>Lien vers les statistiques (Strava, Suunto, MyWoosh)</label>
            <input
              type="url"
              inputMode="url"
              placeholder="https://"
              value={brouillon.lien}
              onChange={(e) => onChange({ lien: e.target.value })}
              {...liaison('lien', idAideLien)}
            />
            <p id={idAideLien} className="dialogue__aide">
              Adresse en https:// de la page de la séance, ouverte dans un nouvel onglet.
            </p>
            {message('lien')}
          </div>

          {erreurGenerale && (
            <p role="alert" className="import__erreur">
              {erreurGenerale}
            </p>
          )}

          <div className="formulaire__ligne">
            <button type="submit" className="bouton bouton--principal" disabled={enCours}>
              {creation ? 'Ajouter' : 'Enregistrer'}
            </button>
            <button type="button" className="bouton" onClick={onFermer}>
              Annuler
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
