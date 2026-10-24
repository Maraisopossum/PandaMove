import type { RepsType, TypeExercice } from '../../core/db/types'
import type { ExerciceDraft } from './draft'
import { ChampCase, ChampChoix, ChampNombre, ChampNombreFacultatif, ChampTexte, Grille } from './champs'

type Patch = Partial<Omit<ExerciceDraft, 'id'>>

const TYPES_REPS = [
  { valeur: 'REPS', libelle: 'Répétitions' },
  { valeur: 'DURATION', libelle: 'Durée (secondes)' },
]
const SYSTEMES = [
  { valeur: '', libelle: 'Aucun' },
  { valeur: 'LINEAIRE', libelle: 'Linéaire' },
  { valeur: 'DOUBLE', libelle: 'Double progression' },
  { valeur: 'TEMPORELLE', libelle: 'Temporelle' },
]
const TYPES_EXERCICE = [
  { valeur: '', libelle: 'Non précisé' },
  { valeur: 'COMPOSE_BAS', libelle: 'Composé bas du corps' },
  { valeur: 'COMPOSE_HAUT', libelle: 'Composé haut du corps' },
  { valeur: 'ISOLATION', libelle: 'Isolation' },
  { valeur: 'MACHINE', libelle: 'Machine' },
  { valeur: 'PDC', libelle: 'Poids de corps' },
]

// Champs d'un exercice de séance (objectifs, repos, surcharge progressive). Présentation pure.
export function ExerciceEditeur({ exercice: e, onChange }: { exercice: ExerciceDraft; onChange: (patch: Patch) => void }) {
  return (
    <div className="exercice__champs">
      <Grille>
        <ChampNombre libelle="Séries" valeur={e.nombreSeriesPrevues} onChange={(v) => onChange({ nombreSeriesPrevues: v })} />
        <ChampChoix libelle="Type de répétitions" valeur={e.repsType} options={TYPES_REPS} onChange={(v) => onChange({ repsType: v as RepsType })} />
        <ChampTexte
          libelle={e.repsType === 'DURATION' ? 'Durée cible (s)' : 'Répétitions cibles (ex. 8-12)'}
          valeur={e.repsCibles}
          onChange={(v) => onChange({ repsCibles: v })}
        />
        <ChampTexte libelle="Charge cible" valeur={e.chargeCible} onChange={(v) => onChange({ chargeCible: v })} />
        <ChampNombre libelle="Repos entre séries (s)" valeur={e.tempsReposSec} onChange={(v) => onChange({ tempsReposSec: v })} />
        <ChampTexte libelle="Tempo" valeur={e.tempo} onChange={(v) => onChange({ tempo: v })} />
        <ChampTexte libelle="Groupe de superset" valeur={e.supersetGroupe ?? ''} onChange={(v) => onChange({ supersetGroupe: v.trim() === '' ? null : v })} />
        <ChampTexte libelle="Consigne clé" valeur={e.consigneCle} onChange={(v) => onChange({ consigneCle: v })} />
      </Grille>
      <ChampCase libelle="Exercice bilatéral (G et D alternent)" valeur={e.isBilateral} onChange={(v) => onChange({ isBilateral: v })} />
      <ChampCase libelle="Poids de corps" valeur={e.isBodyweight} onChange={(v) => onChange({ isBodyweight: v })} />

      <fieldset className="formulaire__groupe">
        <legend>Surcharge progressive</legend>
        <ChampCase libelle="Activer la progression" valeur={e.progressionActivee} onChange={(v) => onChange({ progressionActivee: v })} />
        <Grille>
          <ChampChoix libelle="Système" valeur={e.systemeProgression ?? ''} options={SYSTEMES} onChange={(v) => onChange({ systemeProgression: v === '' ? null : v })} />
          <ChampChoix
            libelle="Type d'exercice"
            valeur={e.typeExercice ?? ''}
            options={TYPES_EXERCICE}
            onChange={(v) => onChange({ typeExercice: v === '' ? null : (v as TypeExercice) })}
          />
          <ChampNombreFacultatif libelle="Répétitions min" valeur={e.repsMin} onChange={(v) => onChange({ repsMin: v })} />
          <ChampNombreFacultatif libelle="Répétitions max" valeur={e.repsMax} onChange={(v) => onChange({ repsMax: v })} />
          <ChampNombreFacultatif libelle="Incrément (kg)" valeur={e.incrementKg} onChange={(v) => onChange({ incrementKg: v })} />
          <ChampNombreFacultatif libelle="Incrément (%)" valeur={e.incrementPct} onChange={(v) => onChange({ incrementPct: v })} />
          <ChampNombre libelle="Incrément durée (s)" valeur={e.incrementDureeSec} onChange={(v) => onChange({ incrementDureeSec: v })} />
          <ChampNombre libelle="Seuil de deload (échecs)" valeur={e.seuilDeload} onChange={(v) => onChange({ seuilDeload: v })} />
        </Grille>
      </fieldset>
    </div>
  )
}
