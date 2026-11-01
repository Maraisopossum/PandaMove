import { CelluleStepper } from './CelluleStepper'
import { PAS_REPOS_SEC, valeurSuivante } from './pasSteppers'
import type { LigneAffichee, useTableauSeries } from './useTableauSeries'

type Tableau = ReturnType<typeof useTableauSeries>

interface Props {
  nomExercice: string
  tableau: Tableau
  lectureSeule: boolean
  historique: string[]
  /** Charge après un appui sur − / + (pas du matériel de l'exercice) ; pas de 2,5 kg par défaut */
  chargeSuivante?: (valeur: number | null, sens: -1 | 1) => number
}

const CHARGE_PAR_DEFAUT = (valeur: number | null, sens: -1 | 1) => valeurSuivante(valeur, sens, 2.5, 0)
const REPS_SUIVANTES = (valeur: number | null, sens: -1 | 1) => valeurSuivante(valeur, sens, 1, 1)
const REPOS_SUIVANT = (valeur: number | null, sens: -1 | 1) => valeurSuivante(valeur, sens, PAS_REPOS_SEC, 0)

// Tableau de séries à steppers (maquette Stitch) : en-tête, une ligne par série prévue (pré-remplie, grisée tant
// qu'elle n'est pas saisie), cellules [−] valeur [+], puces RPE sous la série courante, boutons Supprimer / Ajouter, historique.
// Présentation seule : tout vient de useTableauSeries.
export function TableauSeries({ nomExercice, tableau: t, lectureSeule, historique, chargeSuivante = CHARGE_PAR_DEFAUT }: Props) {
  const colonnes = t.rpeVisible ? 'tableau-series--rpe' : ''
  return (
    <div className="tableau-series-zone">
      <div role="table" aria-label={`Séries de ${nomExercice}`} className={`tableau-series ${colonnes}`}>
        <div role="row" className="tableau-series__ligne tableau-series__entete">
          <span role="columnheader">#</span>
          <span role="columnheader">{t.enDuree ? 'Temps' : 'Reps'}</span>
          <span role="columnheader">kg</span>
          <span role="columnheader">Repos</span>
          {t.rpeVisible && <span role="columnheader">RPE</span>}
          <span role="columnheader" className="visuellement-cache">
            Validation
          </span>
        </div>
        {t.lignes.map((l) => (
          <div role="rowgroup" key={l.numero}>
            <LigneSerie ligne={l} t={t} lectureSeule={lectureSeule} chargeSuivante={chargeSuivante} />
            {t.rpeVisible && l.courante && !l.terminee && !lectureSeule && <PucesRpe ligne={l} t={t} />}
          </div>
        ))}
      </div>

      {!lectureSeule && (
        <div className="tableau-series__actions">
          <button type="button" className="bouton bouton--alerte" disabled={t.enCours} onClick={() => void t.supprimer()}>
            Supprimer
          </button>
          <button type="button" className="bouton bouton--alerte" disabled={t.enCours} onClick={() => void t.ajouter()}>
            <span aria-hidden="true">＋ </span>Ajouter
          </button>
        </div>
      )}

      {historique.length > 0 && (
        <section className="tableau-series__historique" aria-label="Historique de l'exercice">
          <h4>Historique</h4>
          <ul>
            {historique.map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function LigneSerie({
  ligne: l, t, lectureSeule, chargeSuivante,
}: {
  ligne: LigneAffichee
  t: Tableau
  lectureSeule: boolean
  chargeSuivante: (valeur: number | null, sens: -1 | 1) => number
}) {
  const classes = ['tableau-series__ligne', l.courante && !l.terminee ? 'tableau-series__ligne--courante' : '', l.terminee ? 'tableau-series__ligne--faite' : '']
  const figee = l.terminee || lectureSeule
  return (
    <div role="row" className={classes.filter(Boolean).join(' ')} aria-current={l.courante && !l.terminee ? 'true' : undefined}>
      <span role="cell" className="tableau-series__numero">
        {l.libelle}
      </span>
      <span role="cell">
        <CelluleStepper
          libelle={`Série ${l.libelle}, ${t.enDuree ? 'durée en secondes' : 'répétitions'}`}
          cible={`${t.enDuree ? 'la durée' : 'les répétitions'}, série ${l.libelle}`}
          valeur={l.reps}
          facultatif={false}
          grisee={l.repsGrisees}
          figee={figee}
          min={1}
          suivante={REPS_SUIVANTES}
          onCommit={(v) => t.setReps(l.numero, v)}
        />
      </span>
      <span role="cell">
        <CelluleStepper
          libelle={`Série ${l.libelle}, charge en kilogrammes`}
          cible={`la charge, série ${l.libelle}`}
          valeur={l.chargeKg}
          facultatif
          grisee={l.chargeGrisee}
          figee={figee}
          min={0}
          suivante={chargeSuivante}
          onCommit={(v) => t.setCharge(l.numero, v)}
        />
      </span>
      <span role="cell">
        <CelluleStepper
          libelle={`Série ${l.libelle}, repos en secondes`}
          cible={`le repos de ${PAS_REPOS_SEC} secondes, série ${l.libelle}`}
          valeur={l.reposAffiche}
          facultatif
          grisee={l.reposGrise}
          figee={figee}
          glyphes={{ moins: `−${PAS_REPOS_SEC}`, plus: `+${PAS_REPOS_SEC}` }}
          min={0}
          suivante={REPOS_SUIVANT}
          onCommit={(v) => t.setRepos(l.numero, v)}
        />
      </span>
      {t.rpeVisible && (
        <span role="cell" className="tableau-series__cellule" aria-label={l.rpe !== null ? `Série ${l.libelle}, RPE ${l.rpe}` : undefined}>
          {l.rpe ?? ''}
        </span>
      )}
      <span role="cell" className="tableau-series__valide">
        {lectureSeule ? (
          l.terminee && <span aria-label={`Série ${l.libelle} validée`}>✓</span>
        ) : l.terminee ? (
          <button
            type="button"
            className="tableau-series__fait tableau-series__fait--oui"
            aria-label={`Annuler la validation de la série ${l.libelle}`}
            disabled={t.enCours}
            onClick={() => void t.devalider(l.numero)}
          >
            <span aria-hidden="true">✓</span>
          </button>
        ) : (
          <button
            type="button"
            className="tableau-series__fait"
            aria-label={`Valider la série ${l.libelle}`}
            disabled={t.enCours}
            aria-busy={t.enCours}
            onClick={() => void t.valider(l.numero)}
          >
            <span aria-hidden="true">✓</span>
          </button>
        )}
      </span>
    </div>
  )
}

function PucesRpe({ ligne: l, t }: { ligne: LigneAffichee; t: Tableau }) {
  return (
    <div role="row" className="tableau-series__rpe">
      <div role="cell" className="tableau-series__rpe-contenu">
        <span id={`rpe-${l.numero}`} className="tableau-series__rpe-titre">
          RPE
        </span>
        <div role="group" aria-labelledby={`rpe-${l.numero}`} className="tableau-series__puces">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((v) => (
            <button
              key={v}
              type="button"
              className="tableau-series__puce"
              aria-pressed={l.rpe === v}
              aria-label={`RPE ${v}, série ${l.libelle}`}
              onClick={() => t.choisirRpe(l.numero, v)}
            >
              {v}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
