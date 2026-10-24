import { useId } from 'react'
import { Link, useParams } from 'react-router'
import { ChampNombreFacultatif } from '../champs'
import { useEcranExecution } from './useEcranExecution'
import { useSaisieSerie } from './useSaisieSerie'
import { texteCibles, texteSerie, type ExerciceVue, type Mesures, type SerieVue } from './vue'

// Séance en cours (spec §5) : tout est écrit en base locale d'abord, l'affichage est relu ensuite.
// Aucune logique ici : données et actions viennent de useEcranExecution.
export default function ExecuteScreen() {
  const { id = '' } = useParams()
  const e = useEcranExecution(id)

  return (
    <div className="execution">
      <header className="execution__entete">
        <h1>{e.chargement ? 'Séance' : e.nomSeance}</h1>
        <p className="execution__chrono" role="timer" aria-live="off" aria-label={e.libelleChrono}>
          {e.chrono}
        </p>
        {e.enPause && <p className="execution__etat">En pause</p>}
        {e.terminee && <p className="execution__etat">Séance terminée</p>}
        {e.texteRepos && (
          <p className="execution__repos" aria-live="off">
            {e.texteRepos}
          </p>
        )}
      </header>

      {e.erreur && (
        <p role="alert" className="import__erreur">
          {e.erreur}
        </p>
      )}

      {e.chargement ? (
        <p>Chargement…</p>
      ) : e.exercices.length === 0 ? (
        <p>Aucun exercice enregistré pour cette séance.</p>
      ) : (
        e.blocs.map((bloc) => (
          <section key={bloc.id ?? 'hors-bloc'} className="execution__bloc">
            <h2>{bloc.nom}</h2>
            {bloc.exercices.map((ex) => (
              <CarteExercice
                key={ex.id}
                exercice={ex}
                lectureSeule={e.terminee}
                onValider={(m) => void e.validerSerie(ex.id, m)}
                onCorriger={(serieId, m) => void e.corrigerSerie(serieId, m)}
              />
            ))}
          </section>
        ))
      )}

      {e.trouvee && (
        <div className="execution__actions">
          {e.terminee ? (
            <Link to={e.lienBilan} className="bouton lien-bouton bouton--principal">
              Voir le bilan
            </Link>
          ) : !e.demarre ? (
            <button type="button" className="bouton bouton--principal" onClick={() => void e.demarrer()}>
              Démarrer
            </button>
          ) : (
            <>
              {e.enPause ? (
                <button type="button" className="bouton" onClick={() => void e.reprendre()}>
                  Reprendre
                </button>
              ) : (
                <button type="button" className="bouton" onClick={() => void e.pause()}>
                  Pause
                </button>
              )}
              <button type="button" className="bouton bouton--principal" onClick={() => void e.terminerAvecConfirmation()}>
                Terminer la séance
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function CarteExercice({
  exercice: ex, lectureSeule, onValider, onCorriger,
}: {
  exercice: ExerciceVue
  lectureSeule: boolean
  onValider: (m: Mesures) => void
  onCorriger: (serieId: string, m: Mesures) => void
}) {
  const idTitre = useId()
  const derniere = ex.series.at(-1)
  return (
    <article className="execution__exercice" aria-labelledby={idTitre}>
      <h3 id={idTitre} className="execution__nom">
        {ex.nom}
      </h3>
      {ex.libelleSuperset && <span className="execution__superset">{ex.libelleSuperset}</span>}
      <p className="execution__cibles">{texteCibles(ex)}</p>

      {ex.series.length > 0 && (
        <ol className="execution__series">
          {ex.series.map((s) => (
            <li key={s.id}>
              {lectureSeule ? (
                <p>
                  Série {s.numero} : {texteSerie(s, ex.repsType)}
                </p>
              ) : (
                <LigneSerie serie={s} libelleReps={ex.libelleReps} onCorriger={(m) => onCorriger(s.id, m)} />
              )}
            </li>
          ))}
        </ol>
      )}

      {!lectureSeule && (
        <FormulaireSerie
          libelleReps={ex.libelleReps}
          initial={{ reps: derniere?.reps ?? null, chargeKg: derniere?.chargeKg ?? null, rpe: null }}
          onValider={onValider}
        />
      )}
    </article>
  )
}

function ChampsSerie({ libelleReps, saisie }: { libelleReps: string; saisie: ReturnType<typeof useSaisieSerie> }) {
  return (
    <div className="execution__champs">
      <ChampNombreFacultatif libelle={libelleReps} valeur={saisie.reps} onChange={saisie.setReps} />
      <ChampNombreFacultatif libelle="Charge (kg)" valeur={saisie.chargeKg} onChange={saisie.setChargeKg} />
      <ChampNombreFacultatif libelle="RPE (facultatif)" valeur={saisie.rpe} onChange={saisie.setRpe} />
    </div>
  )
}

function LigneSerie({ serie, libelleReps, onCorriger }: { serie: SerieVue; libelleReps: string; onCorriger: (m: Mesures) => void }) {
  const saisie = useSaisieSerie({ reps: serie.reps, chargeKg: serie.chargeKg, rpe: serie.rpe })
  return (
    <fieldset className="execution__ligne">
      <legend>Série {serie.numero}</legend>
      <ChampsSerie libelleReps={libelleReps} saisie={saisie} />
      <button type="button" className="bouton" aria-label={`Corriger la série ${serie.numero}`} onClick={() => onCorriger(saisie.mesures())}>
        Corriger
      </button>
    </fieldset>
  )
}

function FormulaireSerie({
  libelleReps, initial, onValider,
}: {
  libelleReps: string
  initial: { reps: number | null; chargeKg: number | null; rpe: number | null }
  onValider: (m: Mesures) => void
}) {
  const saisie = useSaisieSerie(initial)
  return (
    <form
      className="execution__nouvelle"
      onSubmit={(ev) => {
        ev.preventDefault()
        onValider(saisie.mesures())
      }}
    >
      <ChampsSerie libelleReps={libelleReps} saisie={saisie} />
      <button type="submit" className="bouton bouton--principal">
        Valider la série
      </button>
    </form>
  )
}
