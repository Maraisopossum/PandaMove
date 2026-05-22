# Room Schema — Version condensée (v11)

## Tables principales

### `seances` → `SeanceEntity`
```
id PK | nom | seance_category (STRENGTH|WARMUP) | groupes_musculaires | duree_estimee_min | notes | created_at | updated_at
```

### `blocs_seance` → `BlocSeanceEntity`
```
id PK | seance_id FK | nom | type (ECHAUFFEMENT|SUPERSET|CIRCUIT|RECUPERATION) | position | duree_min | description | temps_repos_inter_sec | temps_repos_fin_round_sec
```

### `exercices_seance` → `ExerciceSeanceEntity`
```
id PK | seance_id FK | exercise_id FK | bloc_id FK(NULL) | superset_groupe | position
| nombre_series_prevues | reps_cibles | reps_type (REPS|DURATION) ← clé tonnage
| charge_cible | tempo | temps_repos_sec | consigne_cle | equipement | avertissement
```

### `instances_seance` → `InstanceSeanceEntity`
```
id PK | seance_id FK | date | notes | is_completed | completed_at | duration_seconds | created_at
```

### `series_realisees` → `SerieRealiseeEntity`
```
id PK | instance_seance_id FK CASCADE | exercice_seance_id FK CASCADE
| numero_serie | reps_realisees | charge_kg | charge_label | rpe | notes | is_completed
```

### `exercises` → `ExerciseEntity`
```
id PK | name | description | category | muscle_groups | exercise_type | equipment
| muscle_primary | is_custom | is_favorite
```
`ORDER BY name ASC` dans `observeAll()` → tri UTF-8 binaire (É > F, impact sélection multi-exercices)

### `workouts` → `WorkoutEntity`
```
id PK | workout_type (RUNNING|CYCLING) | name | notes | objective | scheduled_date
| is_template | is_completed | completed_at | duration_minutes | cycle_label
| tags | color_hex | result_distance_km | result_duration_sec | result_pace_avg_min_per_km
| result_hr_avg | result_hr_max* | result_rpe | result_notes | result_elevation_m*
| created_at | updated_at
```
★ `result_hr_max` et `result_elevation_m` ajoutés en migration v10→v11

### `run_repeats` → `RunRepeatEntity`
```
id PK | workout_id FK | position | repeat_count | results_json
```

### `run_steps` → `RunStepEntity`
```
id PK | workout_id FK | repeat_id FK(NULL) | position | step_type | end_type | end_value | end_unit
| note | target_type | target_min | target_max | results_json
```

## Relations Room
| Parent | Enfant | Type | Contrainte |
|---|---|---|---|
| `SeanceFull` | `exercices: List<ExerciceSeanceWithExercise>` | @Relation (NON ORDONNÉE) | Toujours `.sortedBy { position }` en Kotlin |
| `ExerciceSeanceWithExercise` | `exercise: ExerciseEntity` | @Relation 1:1 | `parentColumn="exercise_id"` |
| `InstanceWithSeries` | `series: List<SerieRealiseeEntity>` | @Relation | filtre par `exerciceSeanceId` |
| `WorkoutWithBlocks` | `blocks: List<WorkoutBlockEntity>` | @Relation | |

## Clés de mapping importantes
```kotlin
// Stats tonnage — mapping exerciceSeanceId → repsType
ExerciceMapping(id, exerciseId, repsType)  // getExerciceMappingsForSeances()
// → si repsType == DURATION → tonnage += 0.0 (pas de multiplication reps)
```

## Migrations critiques
| Migration | Changement |
|---|---|
| v10 → v11 | `ALTER TABLE workouts ADD COLUMN result_hr_max INTEGER` + `result_elevation_m INTEGER` |
