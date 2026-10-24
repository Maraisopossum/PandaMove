import { Link } from 'react-router'
import { PandaIllustration } from '../../core/images/PandaIllustration'
import { DateDialog } from './DateDialog'
import { JOURS_SEMAINE, formaterJourCourt, formaterJourLong } from './grille'
import { SupprimerInstanceDialog } from './SupprimerInstanceDialog'
import type { InstanceVue, StatutFiltre } from './types'
import { useEcranCalendrier } from './useEcranCalendrier'

const FILTRES: { statut: StatutFiltre; libelle: string }[] = [
  { statut: 'toutes', libelle: 'Toutes' },
  { statut: 'planifiees', libelle: 'Planifiées' },
  { statut: 'terminees', libelle: 'Terminées' },
]

const LIBELLE_ETAT = { planifiee: 'Planifiée', en_cours: 'En cours', terminee: 'Terminée' } as const

const libelleSeances = (n: number) => (n === 0 ? 'aucune séance' : `${n} séance${n > 1 ? 's' : ''}`)

function resume(i: InstanceVue): string {
  const morceaux: string[] = [LIBELLE_ETAT[i.etat]]
  if (i.dureeSec) morceaux.push(`${Math.round(i.dureeSec / 60)} min`)
  if (i.nbSeries !== undefined) morceaux.push(`${i.nbSeries} série${i.nbSeries > 1 ? 's' : ''}`)
  return morceaux.join(' · ')
}

interface LigneProps {
  seance: InstanceVue
  /** Affiche la date (liste des prochaines séances) */
  avecDate?: boolean
  onDate: (i: InstanceVue) => void
  onSupprimer: (i: InstanceVue) => void
}

// Une séance et ses actions. Pas d'affectation (📅) ici : elle n'existe que sur la liste des séances.
function LigneSeance({ seance, avecDate, onDate, onSupprimer }: LigneProps) {
  const quand = formaterJourLong(seance.dateIso)
  const terminee = seance.etat === 'terminee'
  return (
    <li className="calendrier__seance">
      <div className="seance__texte">
        <h3 className="seance__nom">{seance.nom}</h3>
        <p className="seance__details">
          {avecDate && <>{formaterJourCourt(seance.dateIso)} · </>}
          {resume(seance)}
        </p>
      </div>
      <div className="seance__actions">
        <Link
          to={terminee ? `/strength/instance/${seance.id}/report` : `/strength/instance/${seance.id}`}
          className="bouton lien-bouton"
          aria-label={`Ouvrir ${seance.nom}, ${quand}`}
        >
          Ouvrir
        </Link>
        {!terminee && (
          <button type="button" className="bouton" aria-label={`Changer la date de ${seance.nom}, ${quand}`} onClick={() => onDate(seance)}>
            Changer la date
          </button>
        )}
        <button type="button" className="bouton" aria-label={`Supprimer ${seance.nom}, ${quand}`} onClick={() => onSupprimer(seance)}>
          Supprimer
        </button>
      </div>
    </li>
  )
}

// Calendrier : grille du mois, filtre, séances du jour choisi et prochaines séances.
export default function CalendarScreen() {
  const c = useEcranCalendrier()

  return (
    <>
      <h1>Calendrier</h1>

      <div className="calendrier__entete">
        <button type="button" className="bouton" aria-label="Mois précédent" onClick={c.precedent}>
          <span aria-hidden="true">‹</span>
        </button>
        <h2 className="calendrier__mois" aria-live="polite">
          {c.titreMois}
        </h2>
        <button type="button" className="bouton" aria-label="Mois suivant" onClick={c.suivant}>
          <span aria-hidden="true">›</span>
        </button>
        <button type="button" className="bouton" onClick={c.auj}>
          Aujourd'hui
        </button>
      </div>

      <div role="group" aria-label="Filtrer par statut" className="formulaire__ligne">
        {FILTRES.map((f) => (
          <button
            key={f.statut}
            type="button"
            className="bouton"
            aria-pressed={c.filtre.statut === f.statut}
            onClick={() => c.setFiltre({ statut: f.statut })}
          >
            {f.libelle}
          </button>
        ))}
      </div>

      {c.erreur && (
        <p role="alert" className="import__erreur">
          {c.erreur}
        </p>
      )}

      {c.chargement ? (
        <p>Chargement…</p>
      ) : (
        <>
          <div className="calendrier__grille" aria-label={`Jours de ${c.titreMois}`}>
            {JOURS_SEMAINE.map((j) => (
              <span key={j} className="calendrier__semaine" aria-hidden="true">
                {j}
              </span>
            ))}
            {c.jours.map((j) => (
              <button
                key={j.dateIso}
                type="button"
                className={[
                  'calendrier__jour',
                  j.dansLeMois ? '' : 'calendrier__jour--hors',
                  j.estAujourdhui ? 'calendrier__jour--auj' : '',
                ].join(' ')}
                aria-label={`${formaterJourLong(j.dateIso)}, ${libelleSeances(j.instances.length)}`}
                aria-pressed={j.dateIso === c.jourSelectionne}
                aria-current={j.estAujourdhui ? 'date' : undefined}
                onClick={() => c.choisirJour(j.dateIso)}
              >
                <span aria-hidden="true">{j.jourDuMois}</span>
                {j.instances.length > 0 && (
                  <span className="calendrier__points" aria-hidden="true">
                    {j.instances.slice(0, 3).map((i) => (
                      <span key={i.id} className={`calendrier__point calendrier__point--${i.etat}`} />
                    ))}
                    {j.instances.length > 3 && <span className="calendrier__plus">+{j.instances.length - 3}</span>}
                  </span>
                )}
              </button>
            ))}
          </div>

          {c.aucuneSeanceCeMois && (
            <div className="calendrier__vide">
              <PandaIllustration image={c.pandaRepos} sizes="96px" decoratif className="calendrier__panda" />
              <p>Aucune séance ce mois-ci.</p>
            </div>
          )}

          {c.detail && (
            <section aria-labelledby="calendrier-detail" className="calendrier__section">
              <h2 id="calendrier-detail">{c.titreDetail}</h2>
              {c.detail.instances.length === 0 ? (
                <p>Aucune séance ce jour-là.</p>
              ) : (
                <ul className="seances__liste">
                  {c.detail.instances.map((i) => (
                    <LigneSeance key={i.id} seance={i} onDate={c.ouvrirDate} onSupprimer={c.ouvrirSuppression} />
                  ))}
                </ul>
              )}
            </section>
          )}

          <section aria-labelledby="calendrier-prochaines" className="calendrier__section">
            <h2 id="calendrier-prochaines">Prochaines séances</h2>
            {c.prochaines.length === 0 ? (
              <p>Aucune séance à venir.</p>
            ) : (
              <ul className="seances__liste">
                {c.prochaines.map((i) => (
                  <LigneSeance key={i.id} seance={i} avecDate onDate={c.ouvrirDate} onSupprimer={c.ouvrirSuppression} />
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      {c.cibleDate && (
        <DateDialog
          nomSeance={c.cibleDate.nom}
          date={c.dateSaisie}
          enCours={c.enCours}
          onDate={c.setDateSaisie}
          onConfirmer={() => void c.confirmerDate()}
          onFermer={c.fermerDate}
        />
      )}

      {c.cibleSuppression && (
        <SupprimerInstanceDialog
          nomSeance={c.cibleSuppression.nom}
          enCours={c.enCours}
          onConfirmer={() => void c.confirmerSuppression()}
          onFermer={c.fermerSuppression}
        />
      )}
    </>
  )
}
