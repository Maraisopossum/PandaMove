import { Link } from 'react-router'
import { PandaIllustration } from '../../core/images/PandaIllustration'
import { DateDialog } from './DateDialog'
import { exhaustif, LIBELLE_GENRE } from './evenements'
import { JOURS_SEMAINE, formaterJourCourt, formaterJourLong } from './grille'
import { FeuilleSeanceCardio } from './seancesCardio/FeuilleSeanceCardio'
import { LigneCardio } from './seancesCardio/LigneCardio'
import { SupprimerInstanceDialog } from './SupprimerInstanceDialog'
import type { EvenementAgenda, InstanceVue, StatutFiltre } from './types'
import { useEcranCalendrier } from './useEcranCalendrier'

const FILTRES: { statut: StatutFiltre; libelle: string }[] = [
  { statut: 'toutes', libelle: 'Toutes' },
  { statut: 'planifiees', libelle: 'Programmées' },
  { statut: 'terminees', libelle: 'Terminées' },
]

const LIBELLE_ETAT = { planifiee: 'Programmée', en_cours: 'En cours', terminee: 'Terminée' } as const

const libelleSeances = (n: number) => (n === 0 ? 'aucune séance' : `${n} séance${n > 1 ? 's' : ''}`)

// Nom accessible d'un jour : sa date, le nombre de séances et, pour le cardio, leur genre et leur titre
// (les points de couleur de la grille ne disent rien aux lecteurs d'écran).
function nomDuJour(dateIso: string, evenements: EvenementAgenda[]): string {
  const base = `${formaterJourLong(dateIso)}, ${libelleSeances(evenements.length)}`
  const cardio = evenements.flatMap((e) => (e.genre === 'renfo' ? [] : [`${LIBELLE_GENRE[e.genre]} : ${e.titre}`]))
  return cardio.length === 0 ? base : `${base} dont ${cardio.join(', ')}`
}
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
  onDate: () => void
  onSupprimer: () => void
}

// Une séance et ses actions. Pas d'affectation (📅) ici : elle n'existe que sur la liste des séances.
function LigneSeance({ seance, avecDate, onDate, onSupprimer }: LigneProps) {
  const quand = formaterJourLong(seance.dateIso)
  const terminee = seance.etat === 'terminee'
  return (
    <li className="seance__carte calendrier__seance">
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
          className="bouton bouton--principal lien-bouton"
          aria-label={`Ouvrir ${seance.nom}, ${quand}`}
        >
          Ouvrir
        </Link>
        {!terminee && (
          <button type="button" className="bouton" aria-label={`Changer la date de ${seance.nom}, ${quand}`} onClick={onDate}>
            Changer la date
          </button>
        )}
        <button type="button" className="bouton" aria-label={`Supprimer ${seance.nom}, ${quand}`} onClick={onSupprimer}>
          Supprimer
        </button>
      </div>
    </li>
  )
}

interface LigneEvenementProps {
  evenement: EvenementAgenda
  avecDate?: boolean
  actions: Pick<ReturnType<typeof useEcranCalendrier>, 'ouvrirDate' | 'ouvrirSuppression' | 'ouvrirEdition' | 'validerCardio' | 'devaliderCardio'>
}

// Une ligne par événement : le `switch` est exhaustif sur le genre (un genre oublié ne compile plus).
function LigneEvenement({ evenement, avecDate, actions }: LigneEvenementProps) {
  switch (evenement.genre) {
    case 'renfo':
      return (
        <LigneSeance
          seance={evenement.instance}
          avecDate={avecDate}
          onDate={() => actions.ouvrirDate(evenement)}
          onSupprimer={() => actions.ouvrirSuppression(evenement)}
        />
      )
    case 'course':
    case 'velo':
      return (
        <LigneCardio
          evenement={evenement}
          avecDate={avecDate}
          onValider={() => void actions.validerCardio(evenement)}
          onDevalider={() => void actions.devaliderCardio(evenement)}
          onModifier={() => actions.ouvrirEdition(evenement)}
          onDate={() => actions.ouvrirDate(evenement)}
          onSupprimer={() => actions.ouvrirSuppression(evenement)}
        />
      )
    default:
      return exhaustif(evenement)
  }
}

// Calendrier : grille du mois, filtre, séances du jour choisi et prochaines séances.
export default function CalendarScreen() {
  const c = useEcranCalendrier()

  return (
    <>
      <h1 className="titre-ecran">Calendrier</h1>

      <div className="calendrier__entete">
        <button type="button" className="bouton calendrier__nav" aria-label="Mois précédent" onClick={c.precedent}>
          <span aria-hidden="true">‹</span>
        </button>
        <h2 className="calendrier__mois" aria-live="polite">
          {c.titreMois}
        </h2>
        <button type="button" className="bouton calendrier__nav" aria-label="Mois suivant" onClick={c.suivant}>
          <span aria-hidden="true">›</span>
        </button>
        <button type="button" className="bouton calendrier__auj" onClick={c.auj}>
          Aujourd'hui
        </button>
      </div>

      <div role="group" aria-label="Filtrer par statut" className="segmente">
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

      {c.erreur && !c.saisie && (
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
                aria-label={nomDuJour(j.dateIso, j.evenements)}
                aria-pressed={j.dateIso === c.jourSelectionne}
                aria-current={j.estAujourdhui ? 'date' : undefined}
                onClick={() => c.choisirJour(j.dateIso)}
              >
                <span aria-hidden="true">{j.jourDuMois}</span>
                {j.evenements.length > 0 && (
                  <span className="calendrier__points" aria-hidden="true">
                    {j.evenements.slice(0, 3).map((e) => (
                      <span key={e.id} className={`calendrier__point calendrier__point--${e.etat} calendrier__point--${e.genre}`} />
                    ))}
                    {j.evenements.length > 3 && <span className="calendrier__plus">+{j.evenements.length - 3}</span>}
                  </span>
                )}
              </button>
            ))}
          </div>

          <ul className="calendrier__legende" aria-hidden="true">
            <li>
              <span className="calendrier__point calendrier__point--renfo" />
              Renforcement
            </li>
            <li>
              <span className="calendrier__point calendrier__point--course" />
              Course
            </li>
            <li>
              <span className="calendrier__point calendrier__point--velo" />
              Vélo
            </li>
            <li>
              <span className="calendrier__point calendrier__point--renfo calendrier__point--terminee" />
              Terminée
            </li>
          </ul>

          {c.aucuneSeanceCeMois && (
            <div className="calendrier__vide">
              <PandaIllustration image={c.pandaRepos} sizes="96px" decoratif className="calendrier__panda" />
              <p>Aucune séance ce mois-ci.</p>
            </div>
          )}

          {c.detail && (
            <section aria-labelledby="calendrier-detail" className="calendrier__section">
              <h2 id="calendrier-detail">{c.titreDetail}</h2>
              {c.detail.evenements.length === 0 ? (
                <div className="calendrier__jour-vide">
                  <p>Aucune séance ce jour-là.</p>
                  <p className="aide">Programmez-en une depuis vos séances (icône calendrier).</p>
                  <Link to="/strength" className="bouton lien-bouton">
                    Voir mes séances
                  </Link>
                </div>
              ) : (
                <ul className="seances__liste">
                  {c.detail.evenements.map((e) => (
                    <LigneEvenement key={e.id} evenement={e} actions={c} />
                  ))}
                </ul>
              )}
              <button type="button" className="bouton calendrier__ajout" aria-label={`Ajouter une séance de cardio, ${c.titreDetail}`} onClick={c.ouvrirAjout}>
                Ajouter une séance de cardio
              </button>
            </section>
          )}

          <section aria-labelledby="calendrier-prochaines" className="calendrier__section">
            <h2 id="calendrier-prochaines">Prochaines séances</h2>
            {c.prochaines.length === 0 ? (
              <p className="calendrier__avenir-vide">Aucune séance à venir.</p>
            ) : (
              <ul className="seances__liste">
                {c.prochaines.map((e) => (
                  <LigneEvenement key={e.id} evenement={e} avecDate actions={c} />
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      {c.cibleDate && (
        <DateDialog
          nomSeance={c.cibleDate.titre}
          date={c.dateSaisie}
          enCours={c.enCours}
          onDate={c.setDateSaisie}
          onConfirmer={() => void c.confirmerDate()}
          onFermer={c.fermerDate}
        />
      )}

      {c.saisie && (
        <FeuilleSeanceCardio
          mode={c.saisie.mode}
          brouillon={c.saisie.brouillon}
          erreurs={c.saisie.erreurs}
          erreurGenerale={c.erreur}
          enCours={c.enCours}
          onChange={c.changerBrouillon}
          onEnregistrer={() => void c.enregistrer()}
          onFermer={c.fermerSaisie}
        />
      )}

      {c.cibleSuppression && (
        <SupprimerInstanceDialog
          nomSeance={c.cibleSuppression.titre}
          enCours={c.enCours}
          onConfirmer={() => void c.confirmerSuppression()}
          onFermer={c.fermerSuppression}
        />
      )}
    </>
  )
}
