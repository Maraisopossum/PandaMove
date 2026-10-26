import { useId } from 'react'
import type { ExerciceDraft } from '../draft'
import { ChampCase, ChampNombreFacultatif } from '../champs'
import { ChoixSegmente } from './ChoixSegmente'
import { Compteur } from './Compteur'
import {
  activerProgression, basculerPoidsDeCorps, choisirSysteme, desactiverProgression, SYSTEMES_PROGRESSION, TYPES_EXERCICE,
} from './progressionConfig'
import type { ExerciceVue } from './useExerciceVue'

type Patch = Partial<Omit<ExerciceDraft, 'id'>>

interface Props {
  exercice: ExerciceDraft
  vue: ExerciceVue
  /** Applique une transformation complète du brouillon de l'exercice (activation, choix du système…) */
  onTransformer: (transformer: (e: ExerciceDraft) => ExerciceDraft) => void
  onChange: (patch: Patch) => void
}

// Surcharge progressive d'un exercice (Android ProgressionConfigSection). Les valeurs saisies ici sont celles que
// lit le moteur de progression en fin de séance ; l'aperçu est calculé par ce même moteur.
export function ProgressionSection({ exercice: e, vue, onTransformer, onChange }: Props) {
  const idSwitch = useId()
  const idDescription = useId()
  const { options } = vue

  return (
    <div className="progression">
      <div className={`progression__entete${e.progressionActivee ? ' progression__entete--actif' : ''}`}>
        <div className="progression__texte">
          <label htmlFor={idSwitch} className="progression__titre">
            Surcharge progressive
          </label>
          <p id={idDescription} className="aide">
            {e.progressionActivee
              ? 'À la fin de la séance, une montée vous est proposée si vous avez réussi toutes vos séries.'
              : 'Désactivée. Activez-la pour que la charge ou les répétitions montent d’elles-mêmes.'}
          </p>
        </div>
        <input
          id={idSwitch}
          type="checkbox"
          role="switch"
          className="progression__interrupteur"
          aria-describedby={idDescription}
          checked={e.progressionActivee}
          onChange={(ev) => onTransformer(ev.target.checked ? activerProgression : desactiverProgression)}
        />
      </div>

      {e.progressionActivee && (
        <div className="progression__panneau">
          <ChampCase
            libelle="Poids de corps : la progression porte sur les répétitions puis les séries, jamais sur la charge"
            valeur={e.isBodyweight}
            onChange={(v) => onTransformer((x) => basculerPoidsDeCorps(x, v))}
          />

          <ChoixSegmente
            libelle="Système de progression"
            options={SYSTEMES_PROGRESSION}
            valeur={(e.systemeProgression ?? 'DOUBLE') as 'LINEAIRE' | 'DOUBLE' | 'TEMPORELLE'}
            onChoisir={(v) => onTransformer((x) => choisirSysteme(x, v))}
          />
          <p className="aide">{vue.aide}</p>

          {options.plage && (
            <div className="progression__plage">
              <Compteur libelle="Répétitions min" valeur={e.repsMin ?? 8} min={1} onChange={(v) => onChange({ repsMin: v })} />
              <span aria-hidden="true" className="progression__fleche">
                →
              </span>
              <Compteur libelle="Répétitions max" valeur={e.repsMax ?? 12} min={1} onChange={(v) => onChange({ repsMax: v })} />
            </div>
          )}

          {options.typeExercice && (
            <>
              <ChoixSegmente
                libelle="Type d’exercice"
                options={TYPES_EXERCICE}
                valeur={e.typeExercice}
                onChoisir={(v) => onChange({ typeExercice: v })}
              />
              <p className="aide">Règle la taille de la montée : composé bas 5 %, composé haut 2,5 %, isolation 2 % de la charge, machine selon son pas.</p>
            </>
          )}

          {options.increment === 'charge' && (
            <Compteur libelle="Incrément (kg)" valeur={e.incrementKg ?? 2.5} min={0.5} pas={0.5} unite="kg" onChange={(v) => onChange({ incrementKg: v })} />
          )}
          {options.increment === 'duree' && (
            <Compteur libelle="Incrément de durée (s)" valeur={e.incrementDureeSec} min={1} pas={5} unite="s" onChange={(v) => onChange({ incrementDureeSec: v })} />
          )}

          <Compteur libelle="Deload après (échecs)" valeur={e.seuilDeload} min={1} onChange={(v) => onChange({ seuilDeload: v })} />
          <p className="aide">Après ce nombre d’échecs de suite, une baisse de 10 % vous est proposée ; elle n’est jamais imposée.</p>

          {options.increment === 'charge' && (
            <details className="plus-options">
              <summary>Réglage avancé de l’incrément</summary>
              <ChampNombreFacultatif libelle="Incrément (%)" valeur={e.incrementPct} onChange={(v) => onChange({ incrementPct: v })} />
              <p className="aide">Facultatif : pourcentage de la charge. Sans valeur, il se déduit du type d’exercice.</p>
            </details>
          )}

          {vue.apercu && (
            <p className="progression__apercu">
              <strong>Aperçu.</strong> {vue.apercu}
            </p>
          )}
          {vue.avertissements.map((a) => (
            <p key={a} className="progression__avertissement" role="note">
              {a}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}
