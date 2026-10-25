import { useId, useState } from 'react'
import type { RepsType } from '../../../core/db/types'
import type { EquipmentStocke } from '../../../core/import/equipment'
import { ChampCase, ChampTexte } from '../champs'
import type { ExerciceDraft, TypeBloc } from '../draft'
import { ChoixSegmente } from './ChoixSegmente'
import { Compteur } from './Compteur'
import { DureeMinSec } from './DureeMinSec'
import { ProgressionSection } from './ProgressionSection'
import { textesPas } from './regles'
import { normaliserCharge } from './resume'
import { useExerciceVue } from './useExerciceVue'

type Patch = Partial<Omit<ExerciceDraft, 'id'>>

export interface ActionsExercice {
  onChange: (patch: Patch) => void
  onTransformer: (transformer: (e: ExerciceDraft) => ExerciceDraft) => void
  onDupliquer: () => void
  onMonter: () => void
  onDescendre: () => void
  onSupprimer: () => void
}

interface Props {
  exercice: ExerciceDraft
  /** null : exercice libre (hors bloc) */
  typeBloc: TypeBloc | null
  materiel: EquipmentStocke
  peutMonter: boolean
  peutDescendre: boolean
  actions: ActionsExercice
}

const MESURES: readonly { valeur: RepsType; libelle: string }[] = [
  { valeur: 'REPS', libelle: 'Répétitions' },
  { valeur: 'DURATION', libelle: 'Durée' },
]

// Carte d'un exercice de la séance (Android ExerciceCard) : repliée, une ligne de résumé ; dépliée, tous les
// réglages. Aucune décision ici : règles, résumé et aperçus viennent de useExerciceVue.
export function ExerciceCarte({ exercice: e, typeBloc, materiel, peutMonter, peutDescendre, actions }: Props) {
  const [deplie, setDeplie] = useState(false)
  const idPanneau = useId()
  const vue = useExerciceVue(e, typeBloc, materiel)
  const { regles, indice } = vue
  // Circuit : toujours en durée, quel que soit ce qui est stocké
  const mesure: RepsType = regles.typeRepsVerrouille ? 'DURATION' : e.repsType

  return (
    <li className="exo">
      <button type="button" className="exo__entete" aria-expanded={deplie} aria-controls={deplie ? idPanneau : undefined} onClick={() => setDeplie(!deplie)}>
        <span className="exo__icone" aria-hidden="true">
          🏋️
        </span>
        <span className="exo__corps">
          <span className="exo__nom">{e.exerciseNom}</span>
          <span className="exo__meta">
            {e.progressionActivee && <span className="badge badge--progression">↗ Progression</span>}
            {e.isBilateral && <span className="badge badge--bilateral">G + D</span>}
            <span className="exo__resume">{vue.resume}</span>
          </span>
        </span>
        <span className="exo__chevron" aria-hidden="true">
          {deplie ? '▴' : '▾'}
        </span>
      </button>

      {deplie && (
        <div id={idPanneau} className="exo__panneau">
          <div className="exo__grille">
            {regles.series && <Compteur libelle="Séries" valeur={e.nombreSeriesPrevues} min={1} onChange={(v) => actions.onChange({ nombreSeriesPrevues: v })} />}
            {regles.repos && (
              <Compteur
                libelle="Repos entre séries (s)"
                valeur={e.tempsReposSec}
                pas={textesPas.reposExercice}
                unite="s"
                onChange={(v) => actions.onChange({ tempsReposSec: v })}
              />
            )}
          </div>

          <ChoixSegmente
            libelle="Mesure de l’effort"
            options={MESURES}
            valeur={mesure}
            verrouilleSur={regles.typeRepsVerrouille ? 'DURATION' : undefined}
            onChoisir={(v) => actions.onChange({ repsType: v })}
          />
          {regles.typeRepsVerrouille && <p className="aide">Circuit : chaque exercice se fait en durée, elle est obligatoire.</p>}

          {mesure === 'REPS' ? (
            <ChampTexte libelle="Répétitions cibles (ex. 8 ou 8-12)" valeur={e.repsCibles} onChange={(v) => actions.onChange({ repsCibles: v })} />
          ) : (
            <DureeMinSec libelle="Durée cible" repsCibles={e.repsCibles} onChange={(v) => actions.onChange({ repsCibles: v })} />
          )}

          <ChampTexte libelle="Charge cible (ex. 20 kg ou PDC)" valeur={e.chargeCible} onChange={(v) => actions.onChange({ chargeCible: normaliserCharge(v) })} />
          {indice && (
            <p className="exo__indice" role="note">
              {indice.texte}{' '}
              <button type="button" className="bouton" onClick={() => actions.onChange({ chargeCible: indice.chargeProche })}>
                Arrondir à {indice.chargeProche}
              </button>
            </p>
          )}

          <ChampTexte libelle="Consigne clé" valeur={e.consigneCle} onChange={(v) => actions.onChange({ consigneCle: v })} />

          {regles.bilateral && (
            <>
              <ChampCase libelle="Bilatéral (G + D)" valeur={e.isBilateral} onChange={(v) => actions.onChange({ isBilateral: v })} />
              <p className="aide">À chaque tour : côté gauche, puis côté droit.</p>
            </>
          )}

          {regles.progression ? (
            <ProgressionSection exercice={e} vue={vue} onTransformer={(f) => actions.onTransformer(f)} onChange={actions.onChange} />
          ) : (
            <p className="aide exo__non-applicable">La surcharge progressive ne s’applique pas à un exercice d’échauffement ou d’activation.</p>
          )}

          <details className="plus-options">
            <summary>Plus d’options</summary>
            <div className="exo__grille">
              <ChampTexte libelle="Tempo (ex. 3-1-1)" valeur={e.tempo} onChange={(v) => actions.onChange({ tempo: v })} />
              <ChampTexte libelle="Équipement" valeur={e.equipement} onChange={(v) => actions.onChange({ equipement: v })} />
              <ChampTexte libelle="Avertissement" valeur={e.avertissement} onChange={(v) => actions.onChange({ avertissement: v })} />
              {typeBloc === 'SUPERSET' && (
                <ChampTexte
                  libelle="Groupe de superset (A, B…)"
                  valeur={e.supersetGroupe ?? ''}
                  onChange={(v) => actions.onChange({ supersetGroupe: v.trim() === '' ? null : v })}
                />
              )}
            </div>
          </details>

          <div className="exo__pied">
            <button type="button" className="bouton" aria-label={`Dupliquer ${e.exerciseNom}`} onClick={actions.onDupliquer}>
              Dupliquer
            </button>
            <button type="button" className="bouton" aria-label={`Monter ${e.exerciseNom}`} disabled={!peutMonter} onClick={actions.onMonter}>
              <span aria-hidden="true">↑</span> Monter
            </button>
            <button type="button" className="bouton" aria-label={`Descendre ${e.exerciseNom}`} disabled={!peutDescendre} onClick={actions.onDescendre}>
              <span aria-hidden="true">↓</span> Descendre
            </button>
            <button type="button" className="bouton bouton--alerte" aria-label={`Supprimer ${e.exerciseNom}`} onClick={actions.onSupprimer}>
              Supprimer
            </button>
          </div>
        </div>
      )}
    </li>
  )
}
