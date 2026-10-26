# Room Schema — Version condensée (v26)

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
| is_bilateral                                              ← ajouté migration v18→v19
| progression_activee | systeme_progression (LINEAIRE|DOUBLE|TEMPORELLE)
| reps_min | reps_max | increment_kg | increment_duree_sec | seuil_deload  ← ajoutés migration v20→v21
| type_exercice (COMPOSE_BAS|COMPOSE_HAUT|ISOLATION|MACHINE|PDC) | increment_pct  ← ajoutés migration v22→v23
| is_bodyweight  ← ajouté migration v23→v24
```

### `instances_seance` → `InstanceSeanceEntity`
```
id PK | seance_id FK | date | notes | is_completed | completed_at | duration_seconds | created_at
```

### `objectifs_progression` → `ObjectifProgressionEntity` (v21)
```
id PK | seance_id FK | exercice_id FK | charge_cible | reps_cible | duree_cible_sec
| compteur_echec | derniere_maj
| nombre_series_cible  ← ajouté migration v23→v24
```
Objectif courant par exercice (bible §0.1) — lu à l'activation d'une instance, jamais figé dans le template.

### `series_realisees` → `SerieRealiseeEntity`
```
id PK | instance_seance_id FK CASCADE | exercice_seance_id FK CASCADE
| numero_serie | reps_realisees | charge_kg | charge_label | rpe | notes | is_completed
```

### `exercises` → `ExerciseEntity`
```
id PK | name | description | category | muscle_groups | exercise_type | equipment
| muscle_primary | is_custom | is_favorite
| is_bodyweight  ← ajouté migration v23→v24
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
| source (NATIVE|TCX_IMPORT)           ← ajouté migration v24→v25
| created_at | updated_at
```

### `run_repeats` → `RunRepeatEntity`
```
id PK | workout_id FK | position | repeat_count | results_json
| is_auto_lap  ← ajouté migration v25→v26 (true = splits km auto-lap montre importés TCX,
                 false = vrai bloc de fractionné construit dans l'app — évite d'afficher
                 "INTERVALLE X/N" à l'exécution live d'une sortie continue réutilisée en modèle)
```

### `run_steps` → `RunStepEntity`
```
id PK | workout_id FK | repeat_id FK(NULL) | position | step_type | end_type | end_value | end_unit
| note | target_type | target_min | target_max | results_json*
```
★ `results_json` ajouté en migration v11→v12 (validation des étapes libres)

### `breathing_session` → `BreathingSessionEntity` (v16)
```
id PK | method_id | method_name | cycles_completed | duration_seconds | session_date
```
Historique des séances de respiration terminées — `session_date` en `LocalDate` (comparable à `scheduled_date` de `workouts` pour l'agrégation calendrier/stats).

### `custom_breathing_method` → `CustomBreathingMethodEntity` (v17)
```
id PK | name | emoji | inhale_seconds | hold_in_seconds | exhale_seconds | hold_out_seconds | default_cycles
```
Méthodes de respiration créées par l'utilisateur, en complément des méthodes prédéfinies codées en dur côté `feature/breathing`.

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
| v15 → v16 | `CREATE TABLE breathing_session` (module respiration) |
| v16 → v17 | `CREATE TABLE custom_breathing_method` (méthodes de respiration personnalisées) |
| v19 → v20 | `ALTER TABLE gps_track_points ADD COLUMN timestamp_ms INTEGER NOT NULL DEFAULT 0` + `speed_mps REAL` + `accuracy_m REAL` |
| v20 → v21 | Module surcharge progressive : `progression_activee`, `systeme_progression`, `reps_min`, `reps_max`, `increment_kg`, `increment_duree_sec`, `seuil_deload` sur `exercices_seance` + table `objectifs_progression` |
| v21 → v22 | `ALTER TABLE seances ADD COLUMN is_archived INTEGER NOT NULL DEFAULT 0` (archivage au lieu de suppression cascade) |
| v22 → v23 | Incrément qualitatif (bible §4.1-§4.3) : `ALTER TABLE exercices_seance ADD COLUMN type_exercice TEXT` + `increment_pct REAL` |
| v23 → v24 | `is_bodyweight` sur `exercises` + `exercices_seance` ; `nombre_series_cible` sur `objectifs_progression` |
| v24 → v25 | `ALTER TABLE workouts ADD COLUMN source TEXT NOT NULL DEFAULT 'NATIVE'` (provenance NATIVE / TCX_IMPORT, notice source dans l'écran résultat) |
| v25 → v26 | `ALTER TABLE run_repeats ADD COLUMN is_auto_lap INTEGER NOT NULL DEFAULT 0` (distingue auto-lap montre vs vrai fractionné) |
| Prochaine | v26 → v27 — incrémenter `version =` dans `PandaFitDatabase.kt` + ajouter dans `DatabaseModule.addMigrations()` |
