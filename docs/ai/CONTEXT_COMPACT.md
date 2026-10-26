# PandaMove — Contexte compact IA (v26)
> Charge ce fichier en premier. Il condense l'essentiel de PROJECT_CONTEXT_MIN + AI_INDEX + ROOM_SCHEMA_MIN pour une lecture rapide — les 3 restent la référence détaillée sur leur sujet (index fichiers, schéma complet) et ne sont pas supprimés ; les garder synchronisés en cas de changement de version/structure.

## App
Android Kotlin/Compose · Hub multisport (renforcement, échauffement, running, vélo, respiration, randonnée, timer) · MVVM+UDF · Hilt · Room schema v26 · minSdk 31

## Modules
```
app/
  service/       ActiveSessionService (ForegroundService chrono session)
                 RunningTrackingService (ForegroundService GPS, @AndroidEntryPoint)
  navigation/    PandaFitNavHost.kt · PandaFitDestination.kt
core/
  database/      PandaFitDatabase (v26) · DAOs · entities · migrations 3→26
                 ActiveSessionManager (@Singleton, StateFlow chrono)
                 catalog/GpsTrackingRepository (@Singleton, StateFlow<LiveTrackState>)
                 catalog/EquipmentRepository (@Singleton, inventaire matériel réel — voir section dédiée)
                 progression/ProgressionEngine (moteur pur — incrément qualitatif bible §4)
  designsystem/  PandaCard · PandaTopBar · AssignSessionDialogs · theme/
  common/        normalizeSearch()
feature/
  home           HomeScreen · HomeViewModel · carte "séance en cours"
  running        RunningScreen · RunningWorkoutDetailScreen · RunningWorkoutExecuteScreen
                 RunningWorkoutReportScreen · RunningExecuteViewModel · RunningDetailViewModel
  cycling        CyclingScreen · CyclingWorkoutDetailScreen · CyclingListViewModel
  strength       SeanceListScreen · SeanceCreateScreen · InstanceExecuteScreen · InstanceReportScreen
  warmup         WarmupListScreen · catégories WARMUP_GENERAL|MOBILITY|ACTIVATION
  calendar       CalendarScreen · CalendarViewModel — vue multi-sport, filtres, affectation,
                 section "Prochaines séances" (workouts + instances strength à venir)
  stats          StatsScreen · StatsViewModel · StatsPreferences (DataStore)
  profile        ProfileScreen · ExerciseCatalogScreen · DataExportManager · DataImportManager
  breathing      BreathingSessionScreen · BreathingMethodSelectionScreen — méthodes prédéfinies + custom
  hiking         module randonnée (voir feature/hiking/)
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
                 | progression_activee | systeme_progression | reps_min | reps_max | increment_kg
                 | seuil_deload | type_exercice(COMPOSE_BAS|COMPOSE_HAUT|ISOLATION|MACHINE|PDC) | increment_pct  ← v21/v23
objectifs_progression id | seance_id | exercise_id | charge_cible | reps_cible | duree_cible_sec
                 | compteur_echec | derniere_maj   ← objectif courant (bible §0.1), v21
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

## Surcharge progressive — incrément qualitatif (v23)
```
ProgressionEngine.calculerIncrementQualitatif() : max(pas_matériel, charge×%cible), plafond +10%
  → inventaire structuré déclaré (Haltères/Barre/Kettlebell/Câble) : snapping exact sur la charge
    réellement composable — EquipmentInventory.kt (DisquesConfig combinatoire, PlageConfig min/max/pas,
    HalteresConfig fixes+chargeables), résolu via EquipmentRepository.inventaire (DataStore JSON)
  → sinon : pas simple (MACHINE) ou incrementKg manuel — comportement legacy inchangé
TypeExercice (COMPOSE_BAS|COMPOSE_HAUT|ISOLATION|MACHINE|PDC) sur ExerciceSeanceEntity → %cible par défaut
InstanceExecuteViewModel.resolveChargesAtteignables() : union des catégories d'équipement de l'exercice
  (rawEquipmentToCategory sur ExerciseEntity.equipment) → liste triée passée à evaluerExercice()
Deload (-10% après échecs répétés) : PROPOSÉ via ProgressionRecapDialog (Oui/Non/Ajuster), jamais imposé
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
DataExportManager.exportToJson() → PandaMoveExport v3.2
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
