# PandaFit — Contexte IA minimal

## App
Android Kotlin/Compose · Hub multisport (renforcement, échauffement, running, vélo) · Module-based architecture

## Modules
```
app/                        → NavHost, DI wiring
core/
  database/                 → Room, DAOs, entities, migrations (v13)
  designsystem/             → composants partagés (PandaCard, PandaTopBar, AssignSessionDialogs)
  common/                   → utilitaires partagés (normalizeSearch)
feature/
  home/                     → HomeScreen + HomeViewModel
  strength/                 → séances renforcement (SeanceCreateScreen, InstanceExecuteScreen)
  warmup/                   → séances échauffement (WarmupListScreen, catégories WARMUP_*)
  running/                  → running (RunningScreen, RunningWorkoutReportScreen)
  cycling/                  → vélo (CyclingScreen)
  stats/                    → StatsScreen + StatsViewModel + StatsConfig (DataStore)
  profile/                  → ProfileScreen + export/import JSON + catalogue exercices
  calendar/                 → AppCalendarView (lecture seule, multi-sport)
```

## Stack technique
- Compose + Material3 · Hilt · Room v13 · Navigation Compose · DataStore Preferences
- Kotlin coroutines/Flow · `@HiltViewModel` · `SavedStateHandle`
- kotlinx.serialization (export JSON) · Garmin TCX export

## Navigation
`PandaFitNavHost.kt` : NavHost central · `AppDrawerNav` wrappe tout (remplace BottomNav)
`PandaFitDestination.kt` : routes top-level + objets routes imbriquées (RunningRoutes, StrengthRoutes, WarmupRoutes, ProfileRoutes…)

## Patterns obligatoires
- **MVVM + UDF** : un seul `StateFlow<UiState>` par ViewModel, jamais de state dans l'UI
- **Hilt** : `@HiltViewModel` + `@Singleton` + modules `@InstallIn(SingletonComponent)`
- **Room** : toujours `withContext(Dispatchers.IO)` pour les suspending DAO calls
- **Compose** : `collectAsStateWithLifecycle()` uniquement (pas `collectAsState()`)
- **Dialog** : `Dialog(usePlatformDefaultWidth=false)` + `Surface(RoundedCornerShape(28.dp))` pour les dialogs custom

## Modèle de données — structure simplifiée
```
SeanceEntity (STRENGTH|WARMUP_*|STRENGTH_ONESHOT)
  ──< BlocSeanceEntity (instance_seance_id NULL=template, non-null=copie instance)
  ──< ExerciceSeanceEntity (repsType: REPS|DURATION, instance_seance_id idem)
  ──< InstanceSeanceEntity ──< SerieRealiseeEntity

WorkoutEntity (running/vélo) ──< RunRepeatEntity ──< RunStepEntity (results_json v12)
```

## Isolation template/instance (v13)
Au premier chargement de `InstanceExecuteViewModel`, si les blocs/exercices n'ont pas encore
`instanceSeanceId`, ils sont **copiés** depuis le template avec `instanceSeanceId = instanceId`.
→ Les modifications d'une instance n'impactent pas le template.
→ `SeanceDao` : `WHERE instance_seance_id IS NULL` = template, `WHERE instance_seance_id = X` = instance.

## Flux critiques
**Affectation séance type** → `AssignMenuDialog` (liste) → sous-dialog → ViewModel.assignToDate/Dates/Recurring → insert InstanceSeanceEntity / WorkoutEntity copy  
**Tonnage renforcement** → exclure `RepsType.DURATION` : `if (exerciceToRepsType[s.exerciceSeanceId] == RepsType.DURATION) 0.0`  
**Stats config** → `StatsPreferences` (DataStore) → `StatsViewModel` lit via `.configFlow.first()` → `StatsConfig` injecté dans le UiState  
**Allure running live** → `RunningExecuteViewModel.computePaceStr(dist, dur)` → auto-calcul à chaque saisie de distance ou durée
