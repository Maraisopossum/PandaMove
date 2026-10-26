import { useId, useState, type CSSProperties } from 'react'
import type { EquipmentStocke } from '../../../core/import/equipment'
import { ChampChoix, ChampNombreFacultatif, ChampTexte } from '../champs'
import { LIBELLES_BLOC, TYPES_BLOC, type BlocDraft, type TypeBloc } from '../draft'
import { couleursBloc } from '../execute/navExercices'
import { Compteur } from './Compteur'
import { ExerciceCarte, type ActionsExercice } from './ExerciceCarte'
import { DESCRIPTIONS_BLOC, ICONES_BLOC, reglesBloc, textesPas } from './regles'

type PatchBloc = Partial<Omit<BlocDraft, 'id' | 'exercices'>>

export interface ActionsBloc {
  onModifier: (patch: PatchBloc) => void
  onChangerType: (type: TypeBloc) => void
  onMonter: () => void
  onDescendre: () => void
  onSupprimer: () => void
  onAjouterExercices: () => void
}

interface Props {
  bloc: BlocDraft
  materiel: EquipmentStocke
  peutMonter: boolean
  peutDescendre: boolean
  actions: ActionsBloc
  /** Actions d'un exercice du bloc, par id */
  actionsExercice: (exerciceId: string) => ActionsExercice
  peutDeplacerExercice: (exerciceId: string, sens: -1 | 1) => boolean
}

const OPTIONS_TYPE = TYPES_BLOC.map((t) => ({ valeur: t, libelle: LIBELLES_BLOC[t] }))

// Carte d'un bloc (Android BlocCard) : bande de la couleur du type, nom, type modifiable, déplacement,
// suppression, réglages propres au type, puis ses exercices et le bouton « + Exercice ».
export function BlocCarte({ bloc: b, materiel, peutMonter, peutDescendre, actions, actionsExercice, peutDeplacerExercice }: Props) {
  const [deplie, setDeplie] = useState(true)
  const idCorps = useId()
  const regles = reglesBloc(b.type)
  const couleurs = couleursBloc(b.type)
  const style = { '--bloc-clair': couleurs.clair, '--bloc-sombre': couleurs.sombre } as CSSProperties
  const nom = b.nom || LIBELLES_BLOC[b.type]

  return (
    <li className="bloc-edition" style={style}>
      <section aria-label={`Bloc ${nom}`}>
        <div className="bloc-edition__entete">
          <span className="bloc-edition__icone" aria-hidden="true">
            {ICONES_BLOC[b.type]}
          </span>
          <ChampTexte libelle="Nom du bloc" valeur={b.nom} onChange={(v) => actions.onModifier({ nom: v })} />
          <button
            type="button"
            className="bouton"
            aria-expanded={deplie}
            aria-controls={deplie ? idCorps : undefined}
            aria-label={`${deplie ? 'Replier' : 'Déplier'} le bloc ${nom}`}
            onClick={() => setDeplie(!deplie)}
          >
            <span aria-hidden="true">{deplie ? '▴' : '▾'}</span>
          </button>
        </div>

        <div className="bloc-edition__outils">
          <ChampChoix libelle="Type de bloc" valeur={b.type} options={OPTIONS_TYPE} onChange={(v) => actions.onChangerType(v as TypeBloc)} />
          <div className="bloc-edition__boutons">
            <button type="button" className="bouton" aria-label={`Monter le bloc ${nom}`} disabled={!peutMonter} onClick={actions.onMonter}>
              <span aria-hidden="true">↑</span> Monter
            </button>
            <button type="button" className="bouton" aria-label={`Descendre le bloc ${nom}`} disabled={!peutDescendre} onClick={actions.onDescendre}>
              <span aria-hidden="true">↓</span> Descendre
            </button>
            <button type="button" className="bouton bouton--alerte" aria-label={`Supprimer le bloc ${nom}`} onClick={actions.onSupprimer}>
              Supprimer
            </button>
          </div>
        </div>
        <p className="aide">{DESCRIPTIONS_BLOC[b.type]}</p>

        {regles.reposBloc && (
          <div className="exo__grille">
            <Compteur
              libelle="Repos entre exercices (s)"
              valeur={b.tempsReposInterSec}
              pas={textesPas.reposInter}
              unite="s"
              onChange={(v) => actions.onModifier({ tempsReposInterSec: v })}
            />
            <Compteur
              libelle="Repos en fin de tour (s)"
              valeur={b.tempsReposFinRoundSec}
              pas={textesPas.reposFinTour}
              unite="s"
              onChange={(v) => actions.onModifier({ tempsReposFinRoundSec: v })}
            />
          </div>
        )}
        {regles.seriesCommunes && (
          <Compteur libelle="Nombre de tours du circuit" valeur={b.nombreSeriesPrevues} min={1} onChange={(v) => actions.onModifier({ nombreSeriesPrevues: v })} />
        )}

        <details className="plus-options">
          <summary>Plus d’options du bloc</summary>
          <ChampNombreFacultatif libelle="Durée du bloc (min)" valeur={b.dureeMin} onChange={(v) => actions.onModifier({ dureeMin: v })} />
          <ChampTexte libelle="Description du bloc" valeur={b.description} onChange={(v) => actions.onModifier({ description: v })} />
        </details>

        {deplie && (
          <div id={idCorps}>
            {b.exercices.length === 0 ? (
              <p className="aide">Ce bloc est vide : ajoutez-y des exercices.</p>
            ) : (
              <ol className="bloc-edition__exercices">
                {b.exercices.map((e) => (
                  <ExerciceCarte
                    key={e.id}
                    exercice={e}
                    typeBloc={b.type}
                    materiel={materiel}
                    peutMonter={peutDeplacerExercice(e.id, -1)}
                    peutDescendre={peutDeplacerExercice(e.id, 1)}
                    actions={actionsExercice(e.id)}
                  />
                ))}
              </ol>
            )}
            <button type="button" className="bouton bloc-edition__ajout" aria-label={`Ajouter un exercice au bloc ${nom}`} onClick={actions.onAjouterExercices}>
              <span aria-hidden="true">+</span> Exercice
            </button>
          </div>
        )}
      </section>
    </li>
  )
}
