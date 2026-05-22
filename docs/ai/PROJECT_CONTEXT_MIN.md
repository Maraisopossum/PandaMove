# PandaFit — Contexte IA minimal

## App
Android Kotlin/Compose · Hub multisport (renforcement, running, vélo) · Module-based architecture

## Modules
```
app/                        → NavHost, DI wiring
core/
  database/                 → Room, DAOs, entities, migrations (v11)
  designsystem/             → composants partagés (PandaCard, PandaTopBar, AssignSessionDialogs)
  common/                   → utilitaires partagés
feature/
  home/                     → HomeScreen + HomeViewModel
  strength/                 → séances renforcement (SeanceCreateScreen, InstanceExecuteScreen)
  running/                  → running (RunningScreen, RunningWorkoutReportScreen)
  cycling/                  → vélo (CyclingScreen)
  stats/                    → StatsScreen + StatsViewModel + StatsConfig (DataStore)
  profile/                  → ProfileScreen + export/import JSON
  calendar/                 → AppCalendarView (lecture seule, multi-sport)
```

## Stack technique
- Compose + Material3 · Hilt · Room v11 · Navigation Compose · DataStore Preferences
- Kotlin coroutines/Flow · `@HiltViewModel` · `SavedStateHandle`
- kotlinx.serialization (export JSON) · Garmin TCX export

## Navigation
`PandaFitNavHost.kt` : NavHost central · `AppDrawerNav` wrappe tout (remplace BottomNav)
`PandaFitDestination.kt` : routes top-level + objets routes imbriquées (RunningRoutes, StrengthRoutes, ProfileRoutes…)

## Patterns obligatoires
- **MVVM + UDF** : un seul `StateFlow<UiState>` par ViewModel, jamais de state dans l'UI
- **Hilt** : `@HiltViewModel` + `@Singleton` + modules `@InstallIn(SingletonComponent)`
- **Room** : toujours `withContext(Dispatchers.IO)` pour les suspending DAO calls
- **Compose** : `collectAsStateWithLifecycle()` uniquement (pas `collectAsState()`)
- **Dialog** : `Dialog(usePlatformDefaultWidth=false)` + `Surface(RoundedCornerShape(28.dp))` pour les dialogs custom

## Modèle de données — structure simplifiée
```
SeanceEntity ──< BlocSeanceEntity ──< ExerciceSeanceEntity (repsType: REPS|DURATION)
SeanceEntity ──< InstanceSeanceEntity ──< SerieRealiseeEntity

WorkoutEntity (running/vélo) ──< RunRepeatEntity ──< RunStepEntity
```

## Flux critiques
**Affectation séance type** → `AssignMenuDialog` (liste) → sous-dialog → ViewModel.assignToDate/Dates/Recurring → insert InstanceSeanceEntity / WorkoutEntity copy  
**Tonnage renforcement** → exclure `RepsType.DURATION` : `if (exerciceToRepsType[s.exerciceSeanceId] == RepsType.DURATION) 0.0`  
**Stats config** → `StatsPreferences` (DataStore) → `StatsViewModel` lit via `.configFlow.first()` → `StatsConfig` injecté dans le UiState  
