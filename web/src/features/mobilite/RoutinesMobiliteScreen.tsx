import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { formaterDate } from '../endurance/presentation'
import { duree } from '../home/bilanSemaine'
import { detailRoutine, etiquettes } from './routines'
import { useRoutinesMobilite } from './useRoutinesMobilite'

const JOURS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche']

// Routines de mobilité : régularité, suggestion du jour et gestion des routines. La logique est dans useRoutinesMobilite.
export default function RoutinesMobiliteScreen() {
  const navigate = useNavigate()
  const r = useRoutinesMobilite()
  // Routine en cours de modification (nom proposé) et routine dont la suppression attend sa confirmation
  const [edition, setEdition] = useState<{ id: string; nom: string } | null>(null)
  const [aSupprimer, setASupprimer] = useState<string | null>(null)
  const lancer = (choix: Parameters<typeof r.lancer>[0]) => {
    r.lancer(choix)
    navigate('/mobility/apercu')
  }

  return (
    <div className="mobilite">
      <header>
        <p className="mobilite__retour">
          <Link to="/mobility" className="mobilite__lien">
            ← Mobilité
          </Link>
        </p>
        <h1 className="titre-ecran">Routines</h1>
      </header>

      <section aria-labelledby="mob-regularite" className="mobilite__carte">
        <div className="mobilite__section-tete">
          <h2 id="mob-regularite">Régularité</h2>
          <span className="aide">4 semaines</span>
        </div>
        <div className="mobilite__regularite">
          <p className="mobilite__serie">
            <strong>{r.regularite.serie} j</strong>
            <span>de suite</span>
          </p>
          <p>
            {r.regularite.totaux.seances === 0
              ? 'Aucune séance de mobilité ces quatre semaines.'
              : `Vous avez fait ${r.regularite.totaux.seances} séance${r.regularite.totaux.seances > 1 ? 's' : ''} en 4 semaines, soit ${duree(r.regularite.totaux.minutes * 60)} de mobilité.`}
          </p>
        </div>
        <ol className="mobilite__grille" aria-label="Séances de mobilité des quatre dernières semaines">
          {r.regularite.grille.map((j, i) => (
            <li key={j.dateIso} className={`mobilite__jour${j.fait ? ' mobilite__jour--fait' : ''}${j.avenir ? ' mobilite__jour--avenir' : ''}`}>
              <span className="visuellement-cache">
                {JOURS[i % 7]} {formaterDate(j.dateIso)} : {j.avenir ? 'à venir' : j.fait ? 'séance faite' : 'aucune séance'}
              </span>
            </li>
          ))}
        </ol>
        <p className="mobilite__legende" aria-hidden="true">
          <span className="mobilite__pastille mobilite__pastille--fait" /> séance faite <span className="mobilite__pastille" /> aucune
        </p>
      </section>

      {r.suggestion && (
        <section aria-labelledby="mob-suggestion" className="mobilite__suggestion">
          <h2 id="mob-suggestion">Suggestion du jour</h2>
          <p>{r.suggestion.texte}</p>
          <button type="button" className="bouton bouton--principal" onClick={() => lancer(r.suggestion!.choix)}>
            {r.suggestion.libelleAction}
          </button>
        </section>
      )}

      <section aria-labelledby="mob-mes-routines" className="mobilite__section">
        <h2 id="mob-mes-routines">Mes routines</h2>
        {r.routines.length === 0 ? (
          <p className="aide">
            Aucune routine pour l’instant. Réglez une séance dans <Link to="/mobility">Mobilité</Link>, puis touchez « Enregistrer ».
          </p>
        ) : (
          <ul className="mobilite__routines-liste">
            {r.routines.map((x) => (
              <li key={x.id} className="mobilite__carte">
                {edition?.id === x.id ? (
                  <form
                    className="mobilite__enregistrer"
                    onSubmit={(e) => {
                      e.preventDefault()
                      if (edition.nom.trim() === '') return
                      r.renommer(x.id, edition.nom)
                      setEdition(null)
                    }}
                  >
                    <label>
                      Nom de la routine
                      <input value={edition.nom} maxLength={40} autoFocus onChange={(e) => setEdition({ id: x.id, nom: e.target.value })} />
                    </label>
                    <div className="mobilite__commandes">
                      <button type="button" className="bouton" onClick={() => setEdition(null)}>
                        Annuler
                      </button>
                      <button type="submit" className="bouton bouton--principal" disabled={edition.nom.trim() === ''}>
                        Enregistrer
                      </button>
                    </div>
                    {aSupprimer === x.id ? (
                      <div className="mobilite__commandes">
                        <button type="button" className="bouton" onClick={() => setASupprimer(null)}>
                          Garder
                        </button>
                        <button
                          type="button"
                          className="bouton bouton--alerte"
                          onClick={() => {
                            r.supprimer(x.id)
                            setASupprimer(null)
                            setEdition(null)
                          }}
                        >
                          Confirmer la suppression
                        </button>
                      </div>
                    ) : (
                      <button type="button" className="bouton bouton--alerte" onClick={() => setASupprimer(x.id)}>
                        Supprimer la routine
                      </button>
                    )}
                  </form>
                ) : (
                  <>
                    <p className="mobilite__routine-nom">{x.nom}</p>
                    <p className="mobilite__routine-detail">{detailRoutine(x.choix)}</p>
                    <ul className="mobilite__etiquettes" aria-label="Contenu de la routine">
                      {etiquettes(x.choix).map((e) => (
                        <li key={e}>{e}</li>
                      ))}
                    </ul>
                    <div className="mobilite__commandes">
                      <button type="button" className="bouton bouton--principal" aria-label={`Lancer la routine ${x.nom}`} onClick={() => lancer(x.choix)}>
                        Lancer
                      </button>
                      <button type="button" className="bouton" aria-label={`Modifier la routine ${x.nom}`} onClick={() => setEdition({ id: x.id, nom: x.nom })}>
                        Modifier
                      </button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
