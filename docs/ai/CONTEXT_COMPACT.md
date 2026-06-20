# PandaMove — Contexte compact IA (v20)
> Charge ce fichier en premier. Il remplace PROJECT_CONTEXT_MIN + AI_INDEX + ROOM_SCHEMA en une seule lecture.

## App
Android Kotlin/Compose · Hub multisport (renforcement, échauffement, running, vélo, timer) · MVVM+UDF · Hilt · Room schema v20 · minSdk 31

## Modules
```
app/
  service/       ActiveSessionService (ForegroundService chrono session)
                 RunningTrackingService (ForegroundService GPS, @AndroidEntryPoint)
  navigation/    PandaFitNavHost.kt · PandaFitDestination.kt
core/
  database/      PandaFitDatabase (v20) · DAOs · entities · migrations 3→20
                 ActiveSessionManager (@Singleton, StateFlow chrono)
                 catalog/GpsTrackingRepository (@Singleton, StateFlow<LiveTrackState>)
  designsystem/  PandaCard · PandaTopBar · AssignSessionDialogs · theme/
  common/        normalizeSearch()
feature/
  home           HomeScreen · HomeViewModel · carte "séance en cours"
  running        RunningScreen · RunningWorkoutDetailScreen · RunningWorkoutExecuteScreen
                 RunningWorkoutReportScreen · RunningExecuteViewModel · RunningDetailViewModel
  cycling        CyclingScreen · CyclingWorkoutDetailScreen · CyclingListViewModel
  strength       SeanceListScreen · SeanceCreateScreen · InstanceExecuteScreen · InstanceReportScreen
  warmup         WarmupListScreen · catégories WARMUP_GENERAL|MOBILITY|ACTIVATION
  calendar       AppCalendarView (lecture seule, multi-sport)
  stats          StatsScreen · StatsViewModel · StatsPreferences (DataStore)
  profile        ProfileScreen · ExerciseCatalogScreen · DataExportManager · DataImportManager
  timer          Minuteur autonome : COUNTDOWN|HIIT|TABATA|EMOM|AMRAP|FOR_TIME
```

## Patterns obligatoires
```kotlin
// ViewModel
@HiltViewModel class FooVM @Inject constructor(...) : ViewModel() {
    private val _ui = MutableStateFlow(FooUiState())
    val ui: StateFlow<FooUiState> = _ui.asStateFlow()
}
// Screen
val state by viewModel.ui.collectAsStateWithLifecycle()  // jamais collectAsState()
// Dialog custom
Dialog(usePlatformDefaultWidth=false) { Surface(RoundedCornerShape(28.dp), tonalElevation=6.dp) { ... } }
// Room
withContext(Dispatchers.IO) { dao.suspendFun() }
// LazyColumn : toujours key = { item.id }
```

## Navigation
```
NavHost (PandaFitNavHost.kt) → AppDrawerNav → Scaffold → [composables]
Routes : PandaFitDestination.kt (RunningRoutes, StrengthRoutes, WarmupRoutes, ProfileRoutes...)
Args : passés String dans route, lus via SavedStateHandle dans VM
```

## Schéma Room (tables clés)
```
seances          id | nom | seance_category | groupes_musculaires | duree_estimee_min
blocs_seance     id | seance_id | nom | type | position | instance_seance_id(NULL=template)
exercices_seance id | seance_id | exercise_id | bloc_id | position | reps_type(REPS|DURATION)
                 | instance_seance_id(NULL=template)  ← isolation v13
instances_seance id | seance_id | date | is_completed | completed_at | duration_seconds
series_realisees id | instance_seance_id | exercice_seance_id | numero_serie
                 | reps_realisees(⚠=secondes si DURATION) | charge_kg | charge_label | is_completed

exercises        id | name | category | muscle_groups | muscle_primary | is_custom | is_favorite
                 MuscleGroup(16): PECTORAUX DOS EPAULES BICEPS TRICEPS QUADRICEPS ISCHIO
                                  FESSIERS MOLLETS ABDOMINAUX TRAPEZES LOMBAIRES ADDUCTEURS OBLIQUES

workouts         id | workout_type(RUNNING|CYCLING) | is_template | scheduled_date
                 | result_distance_km | result_duration_sec | result_pace_avg_min_per_km
                 | result_hr_avg | result_hr_max | result_rpe | result_elevation_m | result_notes
run_repeats      id | workout_id | position | repeat_count | results_json
run_steps        id | workout_id | repeat_id(NULL) | step_type | end_type | end_value | end_unit
                 | target_type | target_min | target_max | results_json

gps_track_points id | workout_id | point_index | latitude | longitude | altitude_m
                 | timestamp_ms | speed_mps | accuracy_m  ← ajoutés migration v19→v20
```

## GPS Live Tracking (v20)
```
Permissions : ACCESS_FINE_LOCATION + ACCESS_COARSE_LOCATION + FOREGROUND_SERVICE_LOCATION
RunningTrackingService : @AndroidEntryPoint ForegroundService dans app/service/
  → FusedLocationProviderClient (1s interval, précision <30m filtrée)
  → gpsTrackingRepository.addPoint(lat, lng, alt, speed, accuracy, ts)
GpsTrackingRepository : @Singleton dans core/database/catalog/
  → StateFlow<LiveTrackState> { isTracking, distanceM, durationSec, speedMps, paceMinkm, elevationGainM, points }
  → Haversine pour distance, gain altitude cumulé
RunningExecuteViewModel : liveTrackState, startGpsTracking(), stopGpsTracking(), finishWorkout() auto-remplit
RunningWorkoutExecuteScreen : GpsTrackBlock composable (OSMDroid MapView 250dp + stats overlay + Start/Stop)
```

## Isolation template/instance (critique v13)
```
Template : blocs/exercices WHERE instance_seance_id IS NULL
Instance : au 1er chargement InstanceExecuteViewModel copie blocs+exercices avec instanceSeanceId=instanceId
⚠ guard : filter { instanceSeanceId == null } avant copie (ne copier qu'une fois)
```

## Flux affectation (piège courant)
```kotlin
// AssignMenuDialog.onDismiss = { showAssignMenu = false }
// ⚠ NE PAS nullifier assignTargetId dans onDismiss → sous-dialogs en ont besoin
```

## Tonnage stats (règle critique)
```kotlin
if (exerciceToRepsType[s.exerciceSeanceId] == RepsType.DURATION) 0.0  // secondes ≠ reps
```

## Sélection multi-exercices (ordre)
```kotlin
// ⚠ NE PAS filter { it.id in multiSelectedIds } → ordre alphabétique DB (UTF-8 binaire É>F)
val selected = state.multiSelectedIds.mapNotNull { id -> exercisesById[id] }  // ordre insertion
```

## Room @Relation
```kotlin
// @Relation ne garantit PAS l'ordre → toujours .sortedBy { position } après récupération
```

## Export JSON
```
DataExportManager.exportToJson() → PandaMoveExport v3.0
DataImportManager.import(json) → parse + insert DB
Schéma : PandaMoveExport > StrengthTemplateDto > BlocDto > ExerciceDto + CustomExerciseDto
```

## Fichiers sensibles (ne jamais modifier)
```
google-services.json · app/keystore/ · gradle/libs.versions.toml (sauf ajout explicite)
```

## Design
```
Direction : Clean & Bold · fond neutre · typo forte · couleurs sport affirmées
TopBar colorée par module : violet(running/strength) · vert(warmup) · bleu(cycling) · orange(stats)
Cartes : bande gauche 4dp + fond légèrement teinté
Chiffres-clés : ExtraBold · secondaire : PandaSubtext
Lire DESIGN.md avant tout travail visuel
```

## Pièges fréquents
- `Stats` : filtre sur `scheduled_date`, pas `completed_at`
- `resultElevationM` : saisi par l'utilisateur ou auto depuis GPS, non calculé depuis distance
- `RunningReportViewModel.duplicateForDate()` : toujours `resultHrMax=null, resultElevationM=null`
- `ExerciceDraft.position` ≠ index de sauvegarde → utiliser `eIdx` de `forEachIndexed`
- Affectation icône 📅 : uniquement depuis les écrans **liste** (pas Detail/Report)
- `collectAsStateWithLifecycle()` (pas `collectAsState()`)
- `@OptIn(ExperimentalMaterial3Api::class)` si ExposedDropdownMenuBox / DatePickerDialog
