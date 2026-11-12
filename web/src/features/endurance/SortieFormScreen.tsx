import { useId, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { LIMITES_SORTIE, type Sport } from '../../core/db/repos/sorties'
import { CHEMIN_SPORT } from './chemins'
import { formaterDate } from './presentation'
import type { ChampSortie } from './saisieSortie'
import { useFormulaireSortie } from './useFormulaireSortie'

interface ChampProps {
  libelle: string
  erreur?: string
  aide?: string
  children: (props: { id: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean }) => ReactNode
}

// Libellé, champ, aide et erreur reliés par aria-describedby.
function Champ({ libelle, erreur, aide, children }: ChampProps) {
  const id = useId()
  const idMessage = `${id}-msg`
  return (
    <div className="formulaire__champ">
      <label htmlFor={id}>{libelle}</label>
      {children({ id, 'aria-describedby': erreur || aide ? idMessage : undefined, 'aria-invalid': erreur ? true : undefined })}
      {erreur ? (
        <p id={idMessage} role="alert" className="formulaire__erreur">
          {erreur}
        </p>
      ) : (
        aide && (
          <p id={idMessage} className="aide">
            {aide}
          </p>
        )
      )}
    </div>
  )
}

// Création (`/running/new`, `/cycling/new`) et modification (`…/:id/edit`) d'une sortie.
export default function SortieFormScreen({ sport }: { sport: Sport }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const chemin = CHEMIN_SPORT[sport]
  const form = useFormulaireSortie(sport, id)
  const { brouillon: b, erreurs } = form
  const champ = (nom: ChampSortie) => ({
    value: String(b[nom]),
    onChange: (e: { target: { value: string } }) => form.modifierChamps({ [nom]: e.target.value }),
  })

  if (form.chargement) return <p role="status">Chargement…</p>
  if (form.introuvable) {
    return (
      <div className={`sorties sorties--${sport}`}>
        <h1 className="titre-ecran">Sortie introuvable</h1>
        <p>Cette sortie n’existe plus.</p>
        <Link to={chemin} className="bouton">
          Retour aux sorties
        </Link>
      </div>
    )
  }

  return (
    <form
      className={`sorties sorties--${sport} sorties__formulaire`}
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        void form.enregistrer().then((ok) => ok && navigate(chemin))
      }}
    >
      <h1 className="titre-ecran">{id === undefined ? 'Nouvelle sortie' : 'Modifier la sortie'}</h1>

      <div className="sorties__date-titre">
        <Champ libelle="Date">{(p) => <input {...p} type="date" required value={b.date} onChange={(e) => form.modifierChamps({ date: e.target.value, seanceId: '' })} />}</Champ>
        <Champ libelle="Titre" aide={`Facultatif (« ${sport === 'course' ? 'Course' : 'Sortie vélo'} » par défaut).`}>
          {(p) => <input {...p} type="text" maxLength={LIMITES_SORTIE.titre} autoCapitalize="sentences" {...champ('titre')} />}
        </Champ>
      </div>

      {form.seances.length > 0 && (
        <Champ libelle="Séance planifiée" aide="Elle sera validée avec la sortie.">
          {(p) => (
            <select {...p} value={b.seanceId} onChange={(e) => form.modifierChamps({ seanceId: e.target.value })}>
              <option value="">Aucune</option>
              {form.seances.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.titre} ({formaterDate(s.date)})
                </option>
              ))}
            </select>
          )}
        </Champ>
      )}

      <fieldset className="sorties__section">
        <legend>Volume</legend>
        <div className="sorties__paire">
          <Champ libelle="Durée" erreur={erreurs.duree} aide="h:mm:ss ou mm:ss">
            {(p) => <input {...p} type="text" inputMode="numeric" placeholder="52:30" autoComplete="off" {...champ('duree')} />}
          </Champ>
          <Champ libelle="Distance (km)" erreur={erreurs.distanceKm}>
            {(p) => <input {...p} type="text" inputMode="decimal" placeholder="10,5" autoComplete="off" {...champ('distanceKm')} />}
          </Champ>
        </div>
        <Champ libelle="Dénivelé positif (m)" erreur={erreurs.denivele}>
          {(p) => <input {...p} type="text" inputMode="decimal" autoComplete="off" {...champ('denivele')} />}
        </Champ>
      </fieldset>

      <fieldset className="sorties__section">
        <legend>Intensité</legend>
        <div className="sorties__trio">
          <Champ libelle="FC moy." erreur={erreurs.fcMoy}>
            {(p) => <input {...p} type="text" inputMode="numeric" autoComplete="off" {...champ('fcMoy')} />}
          </Champ>
          <Champ libelle="FC max." erreur={erreurs.fcMax}>
            {(p) => <input {...p} type="text" inputMode="numeric" autoComplete="off" {...champ('fcMax')} />}
          </Champ>
          <Champ libelle="RPE" erreur={erreurs.rpe} aide="1 à 10">
            {(p) => <input {...p} type="text" inputMode="numeric" autoComplete="off" {...champ('rpe')} />}
          </Champ>
        </div>
      </fieldset>

      {sport === 'velo' && (
        <label className="formulaire__case">
          <input type="checkbox" checked={b.enSalle} onChange={(e) => form.modifierChamps({ enSalle: e.target.checked })} />
          Sortie en salle (home-trainer)
        </label>
      )}

      <Champ libelle="Notes">
        {(p) => <textarea {...p} rows={3} maxLength={LIMITES_SORTIE.notes} value={b.notes} onChange={(e) => form.modifierChamps({ notes: e.target.value })} />}
      </Champ>

      <Champ libelle="Lien vers l’activité" erreur={erreurs.lien} aide="Adresse https:// de la page Suunto ou MyWoosh (facultatif).">
        {(p) => <input {...p} type="url" inputMode="url" autoComplete="off" {...champ('lien')} />}
      </Champ>

      {form.erreur && (
        <p role="alert" className="formulaire__erreur">
          {form.erreur}
        </p>
      )}

      <div className="sorties__actions-bas">
        <Link to={chemin} className="sorties__retour">
          Annuler
        </Link>
        <button type="submit" className="sorties__principal-bouton" disabled={!form.peutEnregistrer}>
          {id === undefined ? 'Enregistrer' : 'Enregistrer les modifications'}
        </button>
      </div>
    </form>
  )
}
