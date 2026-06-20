# PandaFit — Contexte IA minimal (v20)

## App
Android Kotlin/Compose · Hub multisport (renforcement, échauffement, running, vélo, timer) · Module-based architecture

## Modules
```
app/                        → NavHost, DI wiring
  service/                  → ActiveSessionService (chrono session), RunningTrackingService (GPS ForegroundService)
core/
  database/                 → Room (schema v20), DAOs, entities, migrations (v3→20)
                               catalog/ → GpsTrackingRepository (@Singleton, StateFlow<LiveTrackState>)
                               ActiveSessionManager (@Singleton, StateFlow chrono)
  designsystem/             → composants partagés (PandaCard, PandaTopBar, AssignSessionDialogs)
  common/                   → utilitaires partagés (normalizeSearch)
feature/
  home/                     → HomeScreen + HomeViewModel + carte "séance en cours"
  strength/                 → séances renforcement (SeanceCreateScreen, InstanceExecuteScreen)
  warmup/                   → séances échauffement (WarmupListScreen, catégories WARMUP_*)
  running/                  → running (RunningScreen, RunningWorkoutExecuteScreen + carte GPS, RunningWorkoutReportScreen)
  cycling/                  → vélo (CyclingScreen)
  stats/                    → StatsScreen + StatsViewModel + StatsConfig (DataStore)
  profile/                  → ProfileScreen + export/import JSON + catalogue exercices (16 groupes musculaires)
  calendar/                 → AppCalendarView (lecture seule, multi-sport)
  timer/                    → Minuteur autonome (COUNTDOWN|HIIT|TABATA|EMOM|AMRAP|FOR_TIME)
```

## Stack technique
- Compose + Material3 · Hilt · Room v20 · Navigation Compose · DataStore Preferences
- Kotlin coroutines/Flow · `@HiltViewModel` · `SavedStateHandle`
- kotlinx.serialization (export JSON) · Garmin TCX export
- OSMDroid 6.1.20 (carte GPS running) · play-services-location 21.3.0 (FusedLocationProviderClient)

## Navigation
`PandaFitNavHost.kt` : NavHost central · `AppDrawerNav` wrappe tout (remplace BottomNav)
`PandaFitDestination.kt` : routes top-level + objets routes imbriquées (RunningRoutes, StrengthRoutes, WarmupRoutes, ProfileRoutes…)

## Patterns obligatoires
- **MVVM + UDF** : un seul `StateFlow<UiState>` par ViewModel, jamais de state dans l'UI
- **Hilt** : `@HiltViewModel` + `@Singleton` + modules `@InstallIn(SingletonComponent)`
- **Room** : toujours `withContext(Dispatchers.IO)` pour les suspending DAO calls
- **Compose** : `collectAsStateWithLifecycle()` uniquement (pas `collectAsState()`)
- **Dialog** : `Dialog(usePlatformDefaultWidth=false)` + `Surface(RoundedCornerShape(28.dp))` pour les dialogs custom
- **ForegroundService** : `@AndroidEntryPoint` dans `app/service/`, inject Repository via Hilt, `START_NOT_STICKY`

## Modèle de données — structure simplifiée
```
SeanceEntity (STRENGTH|WARMUP_*|STRENGTH_ONESHOT)
  ──< BlocSeanceEntity (instance_seance_id NULL=template, non-null=copie instance)
  ──< ExerciceSeanceEntity (repsType: REPS|DURATION, instance_seance_id idem)
  ──< InstanceSeanceEntity ──< SerieRealiseeEntity

WorkoutEntity (running/vélo) ──< RunRepeatEntity ──< RunStepEntity (results_json v12)

GpsTrackPointEntity (workout_id, point_index, lat, lng, alt_m, timestamp_ms, speed_mps, accuracy_m) ← v20
```

## Isolation template/instance (v13)
Au premier chargement de `InstanceExecuteViewModel`, si les blocs/exercices n'ont pas encore
`instanceSeanceId`, ils sont **copiés** depuis le template avec `instanceSeanceId = instanceId`.
→ Les modifications d'une instance n'impactent pas le template.
→ `SeanceDao` : `WHERE instance_seance_id IS NULL` = template, `WHERE instance_seance_id = X` = instance.

## GPS Live Tracking (v20)
```
RunningTrackingService (@AndroidEntryPoint ForegroundService) → FusedLocationProviderClient (1s, <30m)
→ GpsTrackingRepository.addPoint() → StateFlow<LiveTrackState>
→ RunningExecuteViewModel.liveTrackState + finishWorkout() auto-remplit résultats
→ RunningWorkoutExecuteScreen : OSMDroid MapView 250dp + stats overlay + bouton Start/Stop
Permissions requises : ACCESS_FINE_LOCATION + FOREGROUND_SERVICE_LOCATION
```

## Flux critiques
**Affectation séance type** → `AssignMenuDialog` (liste) → sous-dialog → ViewModel.assignToDate/Dates/Recurring → insert InstanceSeanceEntity / WorkoutEntity copy  
**Tonnage renforcement** → exclure `RepsType.DURATION` : `if (exerciceToRepsType[s.exerciceSeanceId] == RepsType.DURATION) 0.0`  
**Stats config** → `StatsPreferences` (DataStore) → `StatsViewModel` lit via `.configFlow.first()` → `StatsConfig` injecté dans le UiState  
**Allure running live** → `RunningExecuteViewModel.computePaceStr(dist, dur)` → auto-calcul à chaque saisie de distance ou durée  
**GPS auto-fill** → `finishWorkout()` : si `track.distanceM > 0` → écrase distance/durée/allure/dénivelé depuis `LiveTrackState`

## MuscleGroup (16 valeurs)
```
PECTORAUX · DOS · EPAULES · BICEPS · TRICEPS · QUADRICEPS · ISCHIO · FESSIERS
MOLLETS · ABDOMINAUX · TRAPEZES · LOMBAIRES · ADDUCTEURS · OBLIQUES · AUTRE · FULL_BODY
```
Mapping `MuscleGroup → ExerciseCategory` dans `ExerciseCatalogViewModel.toExerciseCategory()` :
- TRAPEZES/LOMBAIRES → BACK · ADDUCTEURS → LEGS · OBLIQUES → CORE
