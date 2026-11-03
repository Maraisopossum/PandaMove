import { LIBELLE_GENRE } from '../evenements'
import { formaterJourCourt, formaterJourLong } from '../grille'
import type { EvenementCardio } from '../types'
import { lienValide } from './lienValide'

interface Props {
  evenement: EvenementCardio
  /** Affiche la date (liste des prochaines séances) */
  avecDate?: boolean
  onValider: () => void
  onDevalider: () => void
  onModifier: () => void
  onDate: () => void
  onSupprimer: () => void
}

// Lien vers les statistiques de la séance (Strava, Suunto, MyWoosh). La valeur peut venir d'un autre appareil par la
// synchronisation : elle est revalidée à l'affichage. Un lien non valide reste du texte, jamais un lien cliquable.
function LienStatistiques({ lien }: { lien: string }) {
  const resultat = lienValide(lien)
  if (resultat.ok && resultat.valeur !== null) {
    return (
      <p className="calendrier__lien">
        <a href={resultat.valeur} target="_blank" rel="noopener noreferrer">
          Statistiques<span className="visuellement-cache"> (s'ouvre dans un nouvel onglet)</span>
        </a>
      </p>
    )
  }
  return <p className="calendrier__lien calendrier__lien--invalide">Lien non valide : {lien}</p>
}

// Une séance de cardio de l'agenda. Pas d'écran d'exécution : on la pose, on la déplace, on la valide, on la supprime.
// Le composant n'a ni état ni règle métier : les actions viennent du hook de l'écran.
export function LigneCardio({ evenement, avecDate, onValider, onDevalider, onModifier, onDate, onSupprimer }: Props) {
  const quand = formaterJourLong(evenement.dateIso)
  const validee = evenement.etat === 'terminee'
  return (
    <li className="seance__carte calendrier__seance calendrier__seance--cardio">
      <div className="seance__texte">
        <h3 className="seance__nom">{evenement.titre}</h3>
        <p className="seance__details">
          {avecDate && <>{formaterJourCourt(evenement.dateIso)} · </>}
          <span className="calendrier__genre">{LIBELLE_GENRE[evenement.genre]}</span>
          {evenement.detail && <> · {evenement.detail}</>}
        </p>
        {evenement.consigne && <p className="seance__details">{evenement.consigne}</p>}
        {(evenement.jalon || evenement.optionnelle || validee) && (
          <p className="calendrier__marques">
            {evenement.jalon && (
              <span className="calendrier__jalon">
                <span aria-hidden="true">⚑</span> Jalon : {evenement.jalon}
              </span>
            )}
            {evenement.optionnelle && <span className="calendrier__pastille">Optionnelle</span>}
            {validee && <span className="calendrier__pastille calendrier__pastille--validee">Validée</span>}
          </p>
        )}
        {evenement.lien && <LienStatistiques lien={evenement.lien} />}
      </div>
      <div className="seance__actions">
        {validee ? (
          <button type="button" className="bouton" aria-label={`Dévalider ${evenement.titre}, ${quand}`} onClick={onDevalider}>
            Dévalider
          </button>
        ) : (
          <button type="button" className="bouton bouton--principal" aria-label={`Valider ${evenement.titre}, ${quand}`} onClick={onValider}>
            Valider
          </button>
        )}
        <button type="button" className="bouton" aria-label={`Modifier ${evenement.titre}, ${quand}`} onClick={onModifier}>
          Modifier
        </button>
        <button type="button" className="bouton" aria-label={`Changer la date de ${evenement.titre}, ${quand}`} onClick={onDate}>
          Changer la date
        </button>
        <button type="button" className="bouton" aria-label={`Supprimer ${evenement.titre}, ${quand}`} onClick={onSupprimer}>
          Supprimer
        </button>
      </div>
    </li>
  )
}
