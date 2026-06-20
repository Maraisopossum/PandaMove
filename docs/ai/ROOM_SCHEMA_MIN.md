# Room Schema — Version condensée (v20)

## Tables principales

### `seances` → `SeanceEntity`
```
id PK | nom | seance_category (STRENGTH|WARMUP_GENERAL|WARMUP_MOBILITY|WARMUP_ACTIVATION|STRENGTH_ONESHOT)
     | groupes_musculaires | duree_estimee_min | notes | created_at | updated_at
```

### `blocs_seance` → `BlocSeanceEntity`
```
id PK | seance_id FK | nom | type (ECHAUFFEMENT|SUPERSET|CIRCUIT|RECUPERATION) | position
     | duree_min | description | temps_repos_inter_sec | temps_repos_fin_round_sec
     | instance_seance_id FK(NULL)   ← NULL = bloc template, non-null = copie liée à une instance (v13)
```

### `exercices_seance` → `ExerciceSeanceEntity`
```
id PK | seance_id FK | exercise_id FK | bloc_id FK(NULL) | superset_groupe | position
| nombre_series_prevues | reps_cibles | reps_type (REPS|DURATION) ← clé tonnage
| charge_cible | tempo | temps_repos_sec | consigne_cle | equipement | avertissement
| instance_seance_id FK(NULL)   ← NULL = exercice template, non-null = copie liée à une instance (v13)
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

MuscleGroup (16 valeurs) :
```
PECTORAUX | DOS | EPAULES | BICEPS | TRICEPS | QUADRICEPS | ISCHIO | FESSIERS
MOLLETS | ABDOMINAUX | TRAPEZES | LOMBAIRES | ADDUCTEURS | OBLIQUES | AUTRE | FULL_BODY
```

### `workouts` → `WorkoutEntity`
```
id PK | workout_type (RUNNING|CYCLING) | name | notes | objective | scheduled_date
| is_template | is_completed | completed_at | duration_minutes | cycle_label
| tags | color_hex
| result_distance_km | result_duration_sec | result_pace_avg_min_per_km
| result_hr_avg | result_hr_max*        ← migration v10→v11
| result_rpe | result_notes
| result_elevation_m*                  ← migration v10→v11
| result_cadence_avg_rpm               ← migration ultérieure
| result_calories                      ← migration ultérieure
| created_at | updated_at
```

### `run_repeats` → `RunRepeatEntity`
```
id PK | workout_id FK | position | repeat_count | results_json
```

### `run_steps` → `RunStepEntity`
```
id PK | workout_id FK | repeat_id FK(NULL) | position | step_type | end_type | end_value | end_unit
| note | target_type | target_min | target_max | results_json*
```
★ `results_json` ajouté en migration v11→v12 (validation des étapes libres)

### `gps_track_points` → `GpsTrackPointEntity`
```
id PK | workout_id FK | point_index | latitude | longitude | altitude_m
| timestamp_ms NOT NULL DEFAULT 0    ← ajouté migration v19→v20
| speed_mps                          ← ajouté migration v19→v20 (nullable)
| accuracy_m                         ← ajouté migration v19→v20 (nullable)
```

## Relations Room
| Parent | Enfant | Type | Contrainte |
|---|---|---|---|
| `SeanceFull` | `exercices: List<ExerciceSeanceWithExercise>` | @Relation (NON ORDONNÉE) | Toujours `.sortedBy { position }` en Kotlin |
| `ExerciceSeanceWithExercise` | `exercise: ExerciseEntity` | @Relation 1:1 | `parentColumn="exercise_id"` |
| `InstanceWithSeries` | `series: List<SerieRealiseeEntity>` | @Relation | filtre par `exerciceSeanceId` |
| `WorkoutWithBlocks` | `blocks: List<WorkoutBlockEntity>` | @Relation | |

## Isolation template / instance (v13)
```
Template : blocs et exercices avec instance_seance_id IS NULL
Instance : au début de l'exécution, InstanceExecuteViewModel copie les blocs/exercices
           avec instance_seance_id = instanceId (copie indépendante)
Queries : SeanceDao.getTemplateBlocsForSeance()  → WHERE instance_seance_id IS NULL
          SeanceDao.getInstanceBlocs(instanceId) → WHERE instance_seance_id = :instanceId
```

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
| v11 → v12 | `ALTER TABLE run_steps ADD COLUMN results_json TEXT NOT NULL DEFAULT ''` |
| v12 → v13 | `ALTER TABLE blocs_seance ADD COLUMN instance_seance_id INTEGER` + idem sur `exercices_seance` + index |
| v19 → v20 | `ALTER TABLE gps_track_points ADD COLUMN timestamp_ms INTEGER NOT NULL DEFAULT 0` + `speed_mps REAL` + `accuracy_m REAL` |
| Prochaine | v20 → v21 — incrémenter `version =` dans `PandaFitDatabase.kt` + ajouter dans `DatabaseModule.addMigrations()` |
