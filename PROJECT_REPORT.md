# PandaFit — Rapport Projet

> Généré le 16 mai 2026 · mis à jour le 17 mai 2026 · Android · Kotlin 2.0.0 · Jetpack Compose · Room v11 · Hilt

---

## Table des matières

1. [Architecture globale](#1-architecture-globale)
2. [Structure des modules](#2-structure-des-modules)
3. [Liste complète des fichiers](#3-liste-complète-des-fichiers)
4. [Dépendances et leurs usages](#4-dépendances-et-leurs-usages)
5. [Flux de données principaux](#5-flux-de-données-principaux)
6. [Base de données — Schéma complet](#6-base-de-données--schéma-complet)
7. [Design system](#7-design-system)
8. [Assets & images — emplacements et dimensions](#8-assets--images--emplacements-et-dimensions)
9. [Conventions de nommage](#9-conventions-de-nommage)
10. [Points d'extension](#10-points-dextension)
11. [Idées d'améliorations](#11-idées-daméliorations)

---

## 1. Architecture globale

### Pattern : MVVM + UDF (Unidirectional Data Flow)

```
UI (Composable)
    │  collectAsStateWithLifecycle()
    ▼
ViewModel (StateFlow<UiState>)
    │  suspend / Flow
    ▼
DAO (Room)
    │  SQLite
    ▼
PandaFitDatabase (Room v11)
```

Chaque écran suit strictement :
- **1 ViewModel** `@HiltViewModel` par écran
- **1 UiState** data class (immuable)
- **1 StateFlow<UiState>** + `MutableStateFlow` encapsulé
- **0 Repository** : les DAOs sont injectés directement dans les ViewModels (architecture simplifiée volontaire)

### Singleton transversal : `ActiveSessionManager`

La session de renforcement en cours survit à la navigation grâce à un singleton Hilt qui gère :
- Chronomètre de session (secondes)
- Timer de repos (compte à rebours)
- Beeps audio de fin de repos
- ID de la séance active

Ce singleton est lu par `ActiveSessionViewModel` (scope app) → propagé à la bannière persistante visible dans tout le drawer.

### Injection de dépendances : Hilt

- `@HiltAndroidApp` sur `PandaFitApp`
- `@AndroidEntryPoint` sur `MainActivity`
- `@HiltViewModel` sur tous les ViewModels
- `DatabaseModule` : fournit la DB + 7 DAOs + repositories catalogs

### Navigation : Jetpack Navigation Compose

- `NavHost` unique dans `PandaFitNavHost`
- `ModalNavigationDrawer` (`AppDrawerNav`) remplace la BottomNav
- Transitions : `fadeIn + slideIntoContainer` 300ms
- Routes paramétrées via `SavedStateHandle` (ex. `instanceId`, `workoutId`)

---

## 2. Structure des modules

```
PandaFit/
├── app/                          ← Application Android (MainActivity, NavHost, AppDrawerNav)
├── build-logic/
│   └── convention/               ← Convention plugins Gradle partagés (8 plugins)
├── core/
│   ├── common/                   ← Result<T> sealed class
│   ├── database/                 ← Room DB, entités, DAOs, migrations, catalog, seeder
│   └── designsystem/             ← Thème, couleurs, typography, composants partagés
└── feature/
    ├── home/                     ← Dashboard accueil
    ├── running/                  ← Module running complet (create/execute/report + Garmin)
    ├── cycling/                  ← Module vélo (create/edit)
    ├── strength/                 ← Module renforcement (create/execute/report)
    ├── timer/                    ← Minuteur multi-mode (Tabata/EMOM/AMRAP/For Time)
    ├── calendar/                 ← Calendrier mensuel multi-sport
    ├── stats/                    ← Statistiques avec graphiques Vico
    ├── profile/                  ← Profil, dark mode, export, catalogue exercices
    └── warmup/                   ← Échauffement & mobilité (réutilise composables strength)
```

**Convention plugins appliqués par module** :

| Module | Plugins |
|--------|---------|
| `app` | android-application, hilt, compose |
| `core:database` | android-library, hilt, room |
| `core:designsystem` | android-library, compose |
| `core:common` | android-library |
| `feature:*` | android-feature (= library + hilt + compose) |

---

## 3. Liste complète des fichiers

### `app/` (5 fichiers)

| Fichier | Rôle |
|---------|------|
| `MainActivity.kt` | Point d'entrée, splash screen, dark mode, `PandaFitNavHost()` |
| `PandaFitApp.kt` | `@HiltAndroidApp`, WorkManager init, seed exercices au lancement |
| `navigation/PandaFitDestination.kt` | Toutes les routes (9 destinations + RunningRoutes, StrengthRoutes, WarmupRoutes, CyclingRoutes) |
| `navigation/PandaFitNavHost.kt` | NavHost, AppDrawerNav, bannière session active, audio beeps |
| `viewmodel/ActiveSessionViewModel.kt` | Bridge vers `ActiveSessionManager` singleton |

### `core/common/` (1 fichier)

| Fichier | Rôle |
|---------|------|
| `Result.kt` | Sealed class `Success<T>` / `Error` / `Loading` |

### `core/database/` (42 fichiers)

**Entités Room (14)**

| Fichier | Table | Rôle |
|---------|-------|------|
| `WorkoutEntity.kt` | `workouts` | Séances running/cycling (templates + instances), résultats globaux |
| `WorkoutBlockEntity.kt` | `workout_blocks` | Blocs d'un workout (répétitions, cibles allure/FC) |
| `WorkoutExerciseEntity.kt` | `workout_exercises` | Exercices dans un bloc |
| `ExerciseEntity.kt` | `exercises` | Catalogue de 166 exercices (muscle, équipement, type) |
| `ExerciseSetEntity.kt` | `exercise_sets` | Séries par exercice |
| `SeanceEntity.kt` | `seances` | Templates de séances renforcement + échauffement |
| `BlocSeanceEntity.kt` | `blocs_seance` | Groupes d'exercices (ECHAUFFEMENT/SUPERSET/CIRCUIT/RECUPERATION) |
| `ExerciceSeanceEntity.kt` | `exercices_seance` | Exercice dans une séance (position, reps_cibles, type REPS/DURATION) |
| `InstanceSeanceEntity.kt` | `instances_seance` | Occurrence de séance exécutée, date, durée, is_completed |
| `SerieRealiseeEntity.kt` | `series_realisees` | Série réalisée (reps, kg, RPE), CASCADE delete |
| `RunStepEntity.kt` | `run_steps` | Étape running (type Garmin, fin durée/distance, cible allure/FC/cadence) |
| `RunRepeatEntity.kt` | `run_repeats` | Groupe de répétitions running |
| `SeanceCategory.kt` | — | Enum : STRENGTH, WARMUP_GENERAL, WARMUP_MOBILITY, WARMUP_ACTIVATION |
| `RepsType.kt` | — | Enum : REPS, DURATION |

**Relations (5)**

| Fichier | Rôle |
|---------|------|
| `SeanceFull.kt` | Séance + blocs + exercices (avec exercise résolu) |
| `ExerciceSeanceWithExercise.kt` | Exercice séance + entité Exercise |
| `InstanceWithSeries.kt` | Instance + toutes ses séries réalisées |
| `WorkoutWithBlocks.kt` | Workout + ses blocs |
| `WorkoutExerciseWithSets.kt` | Exercice workout + ses séries |

**DAOs (7)**

| Fichier | Méthodes clés |
|---------|---------------|
| `WorkoutDao.kt` | CRUD, `observeByType()`, `observeTemplatesByType()`, `observePlannedByType()`, `observeCompletedByType()`, `saveResults()` |
| `WorkoutBlockDao.kt` | CRUD, `deleteAllForWorkout()`, `insertAll()` |
| `ExerciseDao.kt` | CRUD catalog, `searchByName()`, `getByCategory()` |
| `SeanceDao.kt` | `getSeanceFull()`, CRUD séances/blocs/exercices (transactions) |
| `InstanceSeanceDao.kt` | `getWithSeries()`, `getAllCompletedInstancesWithSeries()`, `getActiveInstance()` |
| `RunStepDao.kt` | CRUD étapes running, `getAllForWorkout()` |
| `RunRepeatDao.kt` | CRUD groupes répétitions |

**Infrastructure (7)**

| Fichier | Rôle |
|---------|------|
| `PandaFitDatabase.kt` | Room DB v10, 7 migrations, tous les DAOs |
| `ActiveSessionManager.kt` | Singleton session active (timer, repos, beeps) |
| `di/DatabaseModule.kt` | Hilt : DB + DAOs + repositories |
| `converters/DateConverters.kt` | LocalDate ↔ String, LocalDateTime ↔ Long |
| `converters/ListConverters.kt` | List<String> ↔ JSON |
| `seeder/ExerciseSeeder.kt` | Seed 166 exercices au premier lancement |
| `catalog/CatalogRepository.kt` | CRUD catalog exercices |
| `catalog/EquipmentRepository.kt` | CRUD équipement user |
| `catalog/UserPreferencesRepository.kt` | DataStore (nom, dark mode, genre) |
| `catalog/MuscuCatalog.kt` | 166 exercices définis en dur |
| `catalog/MuscleGroup.kt` | Enum groupes musculaires |
| `catalog/EquipmentCategory.kt` | Enum catégories équipement |

### `core/designsystem/` (18 fichiers)

**Thème (5)**

| Fichier | Rôle |
|---------|------|
| `theme/Color.kt` | Toute la palette (violet, vert, rouge, orange, bleu, kalyptus, fonds, dark mode) |
| `theme/Typography.kt` | DM Sans (corps), Poppins (displays), Inter (legacy) — 13 styles M3 |
| `theme/Theme.kt` | `PandaFitTheme`, light/dark scheme, `PandaFitExtendedColors` par sport |
| `theme/Shape.kt` | Formes M3 (4→24dp) |
| `theme/Spacing.kt` | Tokens espacement (4/8/16/24/32/48dp) + aliases sémantiques |

**Composants (13)**

| Fichier | Usage |
|---------|-------|
| `AppButton.kt` | Boutons stylisés (primary, secondary, ghost, danger) |
| `AppCard.kt` | Carte blanche, bordure 1dp, radius 14dp |
| `AppCalendarView.kt` | Calendrier mensuel avec dots colorés |
| `AppDrawerNav.kt` | Drawer latéral sombre (kalyptus) avec items nav |
| `PandaButton.kt` | Variante bouton legacy |
| `PandaCard.kt` | Carte avec elevation, click, couleur container |
| `PandaChip.kt` | Chips filtrables/sélectionnables |
| `PandaEmptyState.kt` | Écran vide (icône + titre + description + CTA) |
| `PandaTopBar.kt` | TopAppBar avec support drawer + back + scroll behavior |
| `SportBadge.kt` | Badge rond avec icône sport colorée |
| `SectionTitle.kt` | En-tête de section 15sp bold avec couleur accent |
| `LoadingIndicator.kt` | Indicateur de chargement centré |
| `ActiveSessionBanner.kt` | Bannière verte session active (timer + repos + click) |

### `feature/home/` (3 fichiers)

| Fichier | Rôle |
|---------|------|
| `model/HomeUiState.kt` | `upcomingInstances`, `upcomingWorkouts`, `weeklySummary` |
| `ui/HomeScreen.kt` | Header sombre, stats semaine, séances du jour, grille sections |
| `viewmodel/HomeViewModel.kt` | Observe séances à venir + résumé semaine |

### `feature/running/` (10 fichiers)

| Fichier | Rôle |
|---------|------|
| `model/RunningUiState.kt` | 3 états (list/detail/execute) + `RunningBlockDraft` + `IntervalRepResult` |
| `ui/RunningScreen.kt` | Liste 3 sections (types/planifiées/terminées) |
| `ui/RunningWorkoutDetailScreen.kt` | Créer/éditer séance — blocs standard + intervalles |
| `ui/RunningWorkoutExecuteScreen.kt` | Saisie résultats par intervalle |
| `ui/RunningWorkoutReportScreen.kt` | Rapport post-séance lecture seule |
| `util/GarminTcxExporter.kt` | Génération TCX XML + partage `Intent.ACTION_SEND` |
| `viewmodel/RunningListViewModel.kt` | 3 flows combinés (templates/planned/completed) |
| `viewmodel/RunningDetailViewModel.kt` | CRUD séance + export Garmin |
| `viewmodel/RunningExecuteViewModel.kt` | Saisie résultats intervalles, `saveResults()` |
| `viewmodel/RunningReportViewModel.kt` | Lecture séance terminée |

### `feature/cycling/` (5 fichiers)

| Fichier | Rôle |
|---------|------|
| `model/CyclingUiState.kt` | États liste + detail |
| `ui/CyclingScreen.kt` | Liste séances vélo |
| `ui/CyclingWorkoutDetailScreen.kt` | Créer/éditer séance vélo |
| `viewmodel/CyclingListViewModel.kt` | Observe workouts CYCLING |
| `viewmodel/CyclingDetailViewModel.kt` | CRUD séance vélo |

### `feature/strength/` (17 fichiers)

| Fichier | Rôle |
|---------|------|
| `model/StrengthUiState.kt` | États strength (list, execute) |
| `model/SeanceUiState.kt` | États pour création/détail séance |
| `ui/SeanceListScreen.kt` | Liste séances renforcement (templates + instances planifiées + terminées) |
| `ui/SeanceCreateScreen.kt` | Création/édition séance : exercices, blocs, supersets, drag & drop |
| `ui/SeanceDetailScreen.kt` | Détail séance + historique instances + bouton lancer |
| `ui/InstanceExecuteScreen.kt` | Session live : séries, timer repos, chrono, FAB minuteur manuel |
| `ui/InstanceReportScreen.kt` | Rapport fin de séance : KPIs, tableau séries, tonnage |
| `viewmodel/SeanceListViewModel.kt` | Observe seances + instances actives |
| `viewmodel/SeanceDetailViewModel.kt` | Charge seance + instances historique |
| `viewmodel/SeanceCreateViewModel.kt` | CRUD séance + blocs + exercices |
| `viewmodel/InstanceExecuteViewModel.kt` | Session live + `navigateToNextInBloc()` + timer |

### `feature/timer/` (3 fichiers)

| Fichier | Rôle |
|---------|------|
| `model/TimerUiState.kt` | Mode (TABATA/EMOM/AMRAP/FOR_TIME), phase, config, presets |
| `ui/TimerScreen.kt` | 3 vues : Home (choix mode), Config (paramètres), Running (décompte) |
| `viewmodel/TimerViewModel.kt` | Gestion timer, phase transitions, countdown |

### `feature/calendar/` (3 fichiers)

| Fichier | Rôle |
|---------|------|
| `model/CalendarUiState.kt` | Mois affiché, jour sélectionné, dots par date |
| `ui/CalendarScreen.kt` | Grille mensuelle + liste séances du jour sélectionné |
| `viewmodel/CalendarViewModel.kt` | Charge workouts + instances par plage de dates |

### `feature/stats/` (3 fichiers)

| Fichier | Rôle |
|---------|------|
| `model/StatsUiState.kt` | Données agrégées par sport et période |
| `ui/StatsScreen.kt` | Graphiques Vico (courbes, barres) par sport |
| `viewmodel/StatsViewModel.kt` | Agrège données Room + calculs |

### `feature/profile/` (6 fichiers)

| Fichier | Rôle |
|---------|------|
| `ui/ProfileScreen.kt` | Nom, dark mode, genre, export JSON, actions compte |
| `ui/EquipmentScreen.kt` | Gestion équipement disponible |
| `ui/ExerciseCatalogScreen.kt` | Parcourir les 166 exercices par muscle/catégorie |
| `viewmodel/ProfileViewModel.kt` | DataStore (nom, dark mode) + stats + export |
| `viewmodel/EquipmentViewModel.kt` | CRUD équipement |
| `viewmodel/ExerciseCatalogViewModel.kt` | Browse + search catalog |

### `feature/warmup/` (2 fichiers)

| Fichier | Rôle |
|---------|------|
| `ui/WarmupListScreen.kt` | Liste séances échauffement/mobilité (catégories filtrées) |
| `viewmodel/WarmupListViewModel.kt` | Observe seances category=WARMUP_* |

### `build-logic/convention/` (8 fichiers)

| Fichier | Rôle |
|---------|------|
| `Extensions.kt` | Accès `project.libs` VersionCatalog |
| `KotlinAndroid.kt` | `configureKotlinAndroid()` : compileSdk, Java 17, compiler options |
| `AndroidApplicationConventionPlugin.kt` | Plugin pour module `app` |
| `AndroidLibraryConventionPlugin.kt` | Plugin pour modules `core:*` |
| `AndroidHiltConventionPlugin.kt` | Setup Hilt + KSP |
| `AndroidRoomConventionPlugin.kt` | Setup Room + KSP |
| `AndroidComposeConventionPlugin.kt` | Compiler Compose config |
| `AndroidFeatureConventionPlugin.kt` | = library + hilt + compose (tous les `feature:*`) |

---

## 4. Dépendances et leurs usages

### Versions SDK

| Paramètre | Valeur |
|-----------|--------|
| Min SDK | 31 (Android 12) |
| Target SDK | 35 (Android 15) |
| Compile SDK | 35 |
| Kotlin | 2.0.0 |
| AGP | 8.5.2 |
| Java | 17 |
| Gradle Wrapper | 9.4.1 |

### Dépendances clés

| Bibliothèque | Version | Usage |
|---|---|---|
| **Jetpack Compose BOM** | 2024.06.00 | UI déclarative (Material3) |
| `compose-material3` | (BOM) | Composants UI standard |
| `compose-material-icons-extended` | (BOM) | ~1000 icônes Material |
| `compose-animation` | (BOM) | Transitions, AnimatedVisibility |
| **Navigation Compose** | 2.7.7 | Routing entre écrans |
| **Hilt** | 2.51.1 | Injection de dépendances |
| `hilt-navigation-compose` | 1.2.0 | `hiltViewModel()` dans Compose |
| **Room** | 2.6.1 | Base de données SQLite (ORM) |
| `room-ktx` | 2.6.1 | Extensions Kotlin (Flow, coroutines) |
| **KSP** | 2.0.0-1.0.21 | Générateur de code Room + Hilt |
| **Lifecycle** | 2.8.2 | ViewModel, `collectAsStateWithLifecycle` |
| **Coroutines** | 1.8.1 | Async/IO sur `Dispatchers.IO/Default` |
| **DataStore** | 1.1.1 | Préférences utilisateur (dark mode, nom) |
| **WorkManager** | 2.9.0 | Tâches background (seed, export) |
| **Coil** | 2.6.0 | Chargement images (images panda) |
| **Vico Charts** | 1.15.0 | Graphiques statistiques (line, bar, pie) |
| **Reorderable** | 2.4.0 | Drag & drop dans LazyColumn |
| `core-splashscreen` | 1.0.1 | Splash screen natif Android 12+ |
| `core-ktx` | — | Extensions Kotlin Android |
| `activity-compose` | — | `setContent {}`, `enableEdgeToEdge()` |
| `desugar_jdk_libs` | 2.0.4 | `java.time.*` sur API < 26 |
| `kotlinx-serialization` | — | Sérialisation JSON (List<String> converters) |
| `androidx.core.FileProvider` | — | Partage fichiers TCX (Garmin export) |

### Dépendances de test

| Bibliothèque | Version | Usage |
|---|---|---|
| JUnit 4 | 4.13.2 | Tests unitaires |
| AndroidX JUnit | 1.2.1 | Tests instrumentés |
| Espresso | 3.6.1 | Tests UI |
| MockK | 1.13.11 | Mocking Kotlin |
| Turbine | 1.1.0 | Testing Flow Kotlin |

> ⚠️ **Aucun test n'existe actuellement** dans le projet (ni test/, ni androidTest/).

---

## 5. Flux de données principaux

### 5.1 Flux : Liste → Création → Exécution (Renforcement)

```
SeanceListScreen
    │ click "+"
    ▼
SeanceCreateScreen
    ├── SeanceCreateViewModel.save()
    │       ├── seanceDao.insertSeance()
    │       ├── seanceDao.insertBlocs()
    │       └── seanceDao.insertExercices()
    └── navigate → SeanceDetailScreen
            │ click "Lancer"
            ├── instanceSeanceDao.createInstance(seanceId, date)
            └── navigate → InstanceExecuteScreen(instanceId)
                    │
                    ├── InstanceExecuteViewModel.load()
                    │       ├── instanceSeanceDao.getWithSeries(instanceId)
                    │       ├── seanceDao.getSeanceFull(seanceId)
                    │       └── historiqueComplet (séries précédentes)
                    │
                    ├── [User coche série]
                    │       ├── instanceSeanceDao.upsertSerie()
                    │       └── ActiveSessionManager.startRestTimer()
                    │
                    ├── [Timer repos terminé]
                    │       └── navigateToNextInBloc() → auto-navigation
                    │
                    └── [FINIR] → InstanceReportScreen
                            └── [Terminer] → viewModel.finishInstance()
                                    └── instanceSeanceDao.markCompleted()
```

### 5.2 Flux : Session active persistante

```
InstanceExecuteViewModel.init
    └── ActiveSessionManager.startSession(instanceId, seanceName)
            ├── sessionSeconds++ (timer coroutine, Dispatchers.Default)
            └── emit activeInstanceId

PandaFitNavHost (scope app)
    └── observe activeInstanceId
            └── ActiveSessionBanner affiché sur TOUS les écrans
                    └── onClick → navigate(instanceExecute(activeInstanceId))
```

### 5.3 Flux : Lecture de données (MVVM + UDF)

```
ViewModel.init
    └── viewModelScope.launch {
            dao.observeXxx()        // Flow<List<Entity>>
                .catch { error }
                .collect { data →
                    _uiState.value = UiState(data)
                }
        }

Composable
    └── val state by vm.uiState.collectAsStateWithLifecycle()
            └── recomposition automatique à chaque changement
```

### 5.4 Flux : Export Garmin TCX

```
RunningWorkoutDetailScreen
    └── [Planifier & Exporter]
            └── RunningDetailViewModel.saveAndExport(context)
                    ├── workoutDao.insert/update(entity)
                    ├── blockDao.insertAll(blocks)
                    └── GarminTcxExporter.exportAndShare(context, workout, blocks)
                            ├── buildTcx() → XML string
                            ├── File(cacheDir, "name.tcx").writeText(xml)
                            ├── FileProvider.getUriForFile()
                            └── Intent.ACTION_SEND → chooser
```

### 5.5 Flux : Préférences utilisateur

```
DataStore (user_preferences.pb)
    ↑↓ UserPreferencesRepository
        ↑↓ ProfileViewModel (StateFlow<isDarkMode>)
            ↑↓ MainActivity → PandaFitTheme(darkTheme = isDarkMode)
```

---

## 6. Base de données — Schéma complet

### Version actuelle : 10

### Tables et colonnes principales

```
workouts
  id, workout_type (RUNNING/CYCLING/STRENGTH), name, notes, objective
  scheduled_date, created_at, updated_at, is_completed, completed_at
  duration_minutes, tags, color_hex
  is_template, cycle_label                         ← v6
  result_distance_km, result_duration_sec          ← v6
  result_pace_avg_min_per_km, result_hr_avg, result_rpe, result_notes  ← v6

workout_blocks
  id, workout_id→workouts, block_type, name, position
  duration_minutes, distance_km, target_pace_min_per_km
  target_power_watts, target_cadence_rpm, target_heart_rate_bpm, rpe_target
  recovery_minutes, repetitions
  actual_pace_min_per_km, actual_distance_km, actual_duration_minutes
  actual_heart_rate_bpm, actual_power_watts, actual_rpe, is_success, notes
  target_pace_max_min_per_km, target_hr_min, target_hr_max, target_type  ← v6
  distance_m, distance_unit, duration_unit                               ← v6
  recovery_distance_m, recovery_duration_sec, interval_rep_results_json  ← v6

exercises
  id, name, description, category, exercise_type, is_custom
  equipment (JSON), muscle_primary, muscle_groups (JSON)

seances
  id, nom, notes, created_at, seance_category (STRENGTH/WARMUP_*)  ← v9

blocs_seance
  id, seance_id→seances, type (ECHAUFFEMENT/SUPERSET/CIRCUIT/RECUPERATION)
  nom, position, temps_repos_inter_sec, temps_repos_fin_round_sec

exercices_seance
  id, seance_id→seances, exercise_id→exercises, bloc_id→blocs_seance (nullable)
  nom, position, nombre_series_prevues, reps_cibles, charge_cible
  reps_type (REPS/DURATION), consigne_cle, notes

instances_seance
  id, seance_id→seances, date, notes, is_completed, created_at, updated_at
  duration_seconds                                                         ← v10

series_realisees
  id, instance_id→instances (CASCADE), exercice_seance_id→exercices (CASCADE)
  numero_serie, reps_realisees, charge_kg, charge_label, rpe, is_completed

run_repeats
  id, workout_id→workouts (CASCADE), position, repeat_count
  results_json (JSON)                                                      ← v8

run_steps
  id, workout_id→workouts (CASCADE), repeat_id→run_repeats (CASCADE, nullable)
  position, step_type (WARMUP/RUNNING/WALKING/RECOVERY/REST/OTHER)
  end_type (DURATION/DISTANCE), end_value, end_unit (SECONDS/METERS/KM)
  note, target_type (NONE/PACE/CADENCE/HR_ZONE/HR_CUSTOM)
  target_min, target_max
```

### Clés étrangères et comportements

| Relation | Comportement |
|----------|-------------|
| `exercices_seance` → `seances` | CASCADE delete |
| `exercices_seance` → `exercises` | RESTRICT (protège le catalogue) |
| `exercices_seance` → `blocs_seance` | SET NULL (exercice reste sans bloc) |
| `series_realisees` → `instances_seance` | CASCADE delete |
| `series_realisees` → `exercices_seance` | CASCADE delete |
| `run_steps` → `workouts` | CASCADE delete |
| `run_steps` → `run_repeats` | CASCADE delete |

---

## 7. Design system

### Palette de couleurs

| Token | Hex | Usage |
|-------|-----|-------|
| `PandaPurple` | `#7C5CBF` | Primaire, renforcement, drawer actif |
| `PandaPurpleMid` | `#9B7DD4` | Icônes drawer actives |
| `PandaPurpleLight` | `#EDE8F7` | Fonds cartes renforcement |
| `PandaGreen` | `#2E9E6B` | Running, succès, FAB principal |
| `PandaBlue` | `#1565C0` | Cycling, liens |
| `PandaOrange` | `#E65100` | Supersets, intervalles, alertes |
| `PandaOrangeLight` | `#FFF3E0` | Fond blocs intervalles |
| `PandaOrangeBorder` | `#FFCC80` | Bordure blocs intervalles |
| `PandaRed` | `#E53935` | Erreurs, suppression, fin séance |
| `PandaBackground` | `#F4F4F7` | Fond général |
| `PandaSidebar` | `#1E1830` | Fond drawer |
| `KalyptusGreen` | `#969B7F` | Accents secondaires |

### Typographie

| Style M3 | Police | Taille | Graisse | Usage |
|----------|--------|--------|---------|-------|
| `displayMedium` | Poppins | 45sp | Bold | Chronomètres |
| `headlineMedium` | DM Sans | 22sp | ExtraBold | Titres d'écran |
| `titleMedium` | DM Sans | 15sp | Bold | Titres de section |
| `titleSmall` | DM Sans | 13sp | SemiBold | Noms d'exercices |
| `bodyMedium` | DM Sans | 15sp | Normal | Texte courant |
| `bodySmall` | DM Sans | 13sp | Normal | Descriptions |
| `labelLarge` | DM Sans | 12sp | SemiBold | Boutons, badges |
| `labelSmall` | DM Sans | 10sp | Medium | Sous-titres, métadonnées |

### Espacement (tokens)

```kotlin
xs = 4.dp    // séparateurs fins
sm = 8.dp    // padding interne compact
md = 16.dp   // padding écran standard
lg = 24.dp   // séparateurs entre sections
xl = 32.dp   // espacement large
xxl = 48.dp  // grands espaces
```

---

## 8. Assets & images — emplacements et dimensions

### Launcher icon

| Dossier | Dimensions | Format |
|---------|-----------|--------|
| `app/src/main/res/mipmap-mdpi/` | 48×48 px | PNG |
| `app/src/main/res/mipmap-hdpi/` | 72×72 px | PNG |
| `app/src/main/res/mipmap-xhdpi/` | 96×96 px | PNG |
| `app/src/main/res/mipmap-xxhdpi/` | 144×144 px | PNG |
| `app/src/main/res/mipmap-xxxhdpi/` | 192×192 px | PNG |
| `app/src/main/res/mipmap-anydpi-v26/` | — | XML adaptatif (foreground + background) |

> Fichiers actuels : `ic_launcher.png`, `ic_launcher_round.png`, `ic_launcher.xml` (adaptatif)

### Splash screen

| Fichier | Dimensions | Notes |
|---------|-----------|-------|
| `drawable-mdpi/splash.png` | 240×240 px | Logo centré |
| `drawable-hdpi/splash.png` | 360×360 px | |
| `drawable-xhdpi/splash.png` | 480×480 px | |
| `drawable-xxhdpi/splash.png` | 720×720 px | |
| `drawable-xxxhdpi/splash.png` | 960×960 px | |
| `drawable/ic_splash_transparent.xml` | Vector | Icône vectorielle splash |
| `drawable/splash_screen_bg.xml` | Vector | Fond splash (couleur kalyptus) |

> Le splash utilise l'API SplashScreen Android 12+ via le thème `Theme.PandaFit.Launch`.

### Images feature modules (Panda illustrations)

| Fichier | Usage recommandé | Dimensions |
|---------|-----------------|-----------|
| `drawable/img_home_hero_panda.png` | Dashboard accueil hero | 512×512 px |
| `drawable/img_panda_running.png` | Carte module running | 256×256 px |
| `drawable/img_panda_cycling.png` | Carte module vélo | 256×256 px |
| `drawable/img_panda_strength.png` | Carte module renforcement | 256×256 px |

> Ces images sont chargées via Coil (`painterResource`). Pour des images téléchargeables, utiliser `rememberAsyncImagePainter()`.

### Ajout d'une nouvelle image de feature

1. Placer les 5 densités dans `app/src/main/res/drawable-[densité]/`
2. Référencer via `R.drawable.img_panda_nomfeature`
3. Dimensionner selon l'usage : icône (96dp) → 96/144/192/288/384 px selon densité

### Icônes vectorielles

Toutes les icônes UI proviennent de `androidx.compose.material.icons.filled.*` et `outlined.*` (dependency `material-icons-extended`). Aucun drawable custom nécessaire pour les icônes fonctionnelles.

Pour des icônes custom : créer un `VectorDrawable` XML dans `core/designsystem/src/main/res/drawable/` et le référencer avec `painterResource(R.drawable.ic_nom)`.

### Fonts

| Dossier | Fichiers |
|---------|---------|
| `core/designsystem/src/main/res/font/` | 15 fichiers TTF (DM Sans ×5, Poppins ×5, Inter ×4) |

Toujours ajouter les nouvelles polices dans `core/designsystem` (pas dans `app/`), puis les déclarer dans `Typography.kt`.

---

## 9. Conventions de nommage

### Fichiers Kotlin

| Type | Convention | Exemple |
|------|-----------|---------|
| Screen Composable | `NomFonctionScreen.kt` | `SeanceListScreen.kt` |
| ViewModel | `NomFonctionViewModel.kt` | `InstanceExecuteViewModel.kt` |
| UiState | dans `model/NomFonctionUiState.kt` | `RunningUiState.kt` |
| Entité Room | `NomEntiteEntity.kt` | `WorkoutBlockEntity.kt` |
| DAO | `NomEntiteDao.kt` | `WorkoutDao.kt` |
| Relation | `NomRelation.kt` | `SeanceFull.kt`, `InstanceWithSeries.kt` |
| Composant design system | `AppNom.kt` ou `PandaNom.kt` | `AppDrawerNav.kt`, `PandaCard.kt` |
| Utilitaire | `NomFonctionnel.kt` | `GarminTcxExporter.kt` |

### Composables

| Type | Convention | Exemple |
|------|-----------|---------|
| Écran principal | `fun NomScreen(...)` (public) | `fun RunningScreen(...)` |
| Sous-composant interne | `private fun NomComposable(...)` | `private fun RunWorkoutCard(...)` |
| Composant design system | `fun NomComposant(...)` (public dans package) | `fun PandaCard(...)` |

### Variables et états

```kotlin
// StateFlow
private val _uiState = MutableStateFlow(XxxUiState())
val uiState: StateFlow<XxxUiState> = _uiState.asStateFlow()

// Collecte dans Composable
val uiState by viewModel.uiState.collectAsStateWithLifecycle()

// Dialog / menu states
var showXxxDialog by remember { mutableStateOf(false) }
```

### Ressources

| Type | Convention | Exemple |
|------|-----------|---------|
| Drawables images | `img_[module]_[description].png` | `img_panda_running.png` |
| Drawables icônes | `ic_[description].xml` | `ic_splash_transparent.xml` |
| Couleurs XML | `panda_[nom]` | `panda_purple`, `panda_green` |
| Strings | `[module]_[description]` | `strength_empty_state_title` |
| Layouts (legacy) | `fragment_[nom].xml` | (non utilisé, tout est Compose) |

### Routes de navigation

```kotlin
// Format : "module/sous-route/{parametre}"
"strength/instances/{instanceId}"
"running/{workoutId}/execute"
"warmup/create/{category}"

// Fonctions d'aide
fun instanceReport(id: Long) = "strength/instances/$id/report"
fun execute(id: Long) = "running/$id/execute"
```

### Base de données

| Élément | Convention |
|---------|-----------|
| Table | `snake_case` plural | `workout_blocks`, `series_realisees` |
| Colonne | `snake_case` | `is_completed`, `scheduled_date` |
| Enum DB | `UPPER_CASE` | `RUNNING`, `SUPERSET`, `HR_ZONE` |
| Index | via `@Entity(indices = [Index("colonne")])` |
| FK | `onDelete = ForeignKey.CASCADE/RESTRICT/SET_NULL` explicite |

---

## 10. Points d'extension

### Ajouter un nouvel écran dans un feature existant

1. Créer `ui/NomScreen.kt` avec `@Composable fun NomScreen(...)`
2. Créer `viewmodel/NomViewModel.kt` avec `@HiltViewModel`
3. Ajouter dans `model/NomUiState.kt` (ou fichier UiState existant)
4. Enregistrer la route dans `PandaFitDestination.kt` :
   ```kotlin
   object MonModuleRoutes {
       const val MON_ECRAN = "monmodule/{paramId}"
       fun monEcran(id: Long) = "monmodule/$id"
   }
   ```
5. Ajouter le `composable(MonModuleRoutes.MON_ECRAN) { ... }` dans `PandaFitNavHost.kt`

### Ajouter un nouveau module feature

1. Créer le dossier `feature/nommodule/`
2. Créer `feature/nommodule/build.gradle.kts` :
   ```kotlin
   plugins { alias(libs.plugins.pandafit.android.feature) }
   android { namespace = "com.pandafit.feature.nommodule" }
   dependencies { implementation(projects.coreDatabase) }
   ```
3. Ajouter dans `settings.gradle.kts` : `include(":feature:nommodule")`
4. Ajouter dans `app/build.gradle.kts` : `implementation(projects.feature.nommodule)`
5. Créer la `data object` dans `PandaFitDestination`
6. Ajouter l'item dans `defaultDrawerItems` (`AppDrawerNav.kt`)

### Ajouter une entité Room

1. Créer `core/database/src/.../entities/NomEntity.kt` avec `@Entity`
2. Créer `core/database/src/.../dao/NomDao.kt` avec `@Dao`
3. Ajouter l'entité dans `@Database(entities = [...])` dans `PandaFitDatabase.kt`
4. Ajouter le DAO dans `PandaFitDatabase` (`abstract fun nomDao(): NomDao`)
5. Fournir le DAO dans `DatabaseModule.kt`
6. Écrire la migration `MIGRATION_N_(N+1)` avec les `ALTER TABLE` / `CREATE TABLE`
7. Ajouter la migration dans `DatabaseModule.kt` (`.addMigrations(...)`)
8. Bump la version dans `@Database(version = N+1)`

### Ajouter un composant au design system

1. Créer `core/designsystem/src/.../components/NomComposant.kt`
2. Utiliser les tokens : `MaterialTheme.colorScheme.*`, `LocalPandaFitSpacing.current`, `MaterialTheme.typography.*`
3. Importer `core:designsystem` dans le module feature qui l'utilise (déjà inclus via `android-feature` convention plugin)

### Ajouter des statistiques

1. Ajouter une query agrégée dans le DAO concerné (ex. `WorkoutDao.sumByPeriod()`)
2. Exposer dans `StatsViewModel` via un nouveau Flow ou une propriété calculée dans `StatsUiState`
3. Ajouter un graphique dans `StatsScreen.kt` avec Vico (`CartesianChartHost`)

### Ajouter un type de sport

1. Ajouter la valeur dans l'enum `WorkoutType` : `RUNNING, CYCLING, STRENGTH, SWIMMING`
2. Créer le module `feature:swimming/` selon le même pattern que `feature:cycling`
3. Ajouter les tokens de couleur dans `Color.kt`
4. Ajouter dans `PandaFitExtendedColors` dans `Theme.kt`
5. Ajouter dans `defaultDrawerItems` et `TOP_LEVEL_DESTINATIONS`

---

## 11. Idées d'améliorations

### 🔴 Priorité haute (stabilité / fonctionnalités manquantes courantes)

#### Tests
> **Aucun test n'existe actuellement.** C'est le point le plus critique pour une app de ce niveau.
- Créer des tests unitaires pour les ViewModels (`turbine` pour les Flow déjà en dépendance)
- Tester les migrations Room (test DB en mémoire)
- Tester `GarminTcxExporter.buildTcx()` (pur Kotlin, facile à tester)
- Ajouter au moins des smoke tests UI pour les parcours critiques (Espresso/Compose testing)

#### Sécurité des données
- Ajouter `exportSchema = true` avec un chemin fixe dans Room pour versionner le schéma
- Backup automatique via `android:fullBackupContent` dans le manifest

### 🟡 Priorité moyenne (UX / qualité)

#### Performances
- **Pagination** : `SeanceListScreen` et `ExerciseCatalogScreen` chargent tout en mémoire — utiliser `PagingSource` + `LazyPagingItems` pour les listes longues
- **Chargement d'images** : les images panda en PNG haute résolution peuvent être lourdes — envisager WebP ou vector pour les illustrations simples
- **Recomposition** : certains composables passent des lambdas non mémoïzées → ajouter `remember { }` sur les callbacks

#### UX manquantes courantes
- **Onboarding** : aucun tutoriel au premier lancement — ajouter un flow 3-4 écrans
- **Notifications** : aucun rappel de séance planifiée — utiliser `WorkManager` + `NotificationManager`
- **Partage de séance** : partager le rapport de séance (PDF ou image) via `Intent.ACTION_SEND`
- **Widget Android** : widget accueil pour voir la prochaine séance
- **Offline-first** : déjà le cas (Room local) mais pas de sync cloud — envisager une solution de backup (Firebase Firestore ou Room sync)
- **Historique de poids** : courbe de progression par exercice sur le temps (actuellement absent dans Stats)

#### Architecture
- **Repository pattern** : les ViewModels injectent directement les DAOs — pour faciliter les tests et l'isolation, introduire des Repository entre DAO et ViewModel
- **`sealed interface` pour UiState** : remplacer les `data class` avec un `isLoading: Boolean` par un sealed : `Loading | Success(data) | Error(msg)`
- **Erreur handling** : la majorité des erreurs sont `error: String?` dans UiState — standardiser avec `core:common/Result.kt` déjà présent

### 🟢 Nouvelles fonctionnalités à valeur ajoutée

#### Synchronisation
- **Garmin Connect API** : en plus du fichier TCX, permettre l'upload direct via l'API Garmin Connect OAuth2
- **Strava** : import/export séances running via l'API Strava (standard dans les apps running)
- **Google Fit / Health Connect** : sync des données de santé (FC réelle, GPS)

#### Intelligence
- **Suggestions de charge** : basées sur le 1RM et la progression, suggérer automatiquement charge+1kg si toutes les séries réussies
- **Programme de progression** : cycle de 4 semaines avec augmentation progressive (ex. linéaire, ondulante)
- **RPE tracking** : graphique d'évolution du RPE par exercice pour détecter fatigue/surcharge

#### Social
- **Profil partageable** : page web statique générée (recap semaine, PBs)
- **Export PDF** : rapport de séance en PDF (PDFDocument API Android)

#### Cyclisme
- **Module vélo complet** : le module cycling est minimal — ajouter :
  - Zones de puissance (FTP)
  - Profil d'élévation
  - Export GPX/FIT
  - Suivi kilométrage par vélo

#### Accessibilité
- **TalkBack** : ajouter `contentDescription` sur toutes les icônes sans texte
- **Taille de texte** : tester avec les grandes polices système (`fontScale > 1.5`)
- **Contraste** : vérifier le ratio de contraste des couleurs grises (`PandaSubtext = #888888` sur fond blanc = 3.5:1, insuffisant pour AA)

---

## Récapitulatif chiffres clés

| Métrique | Valeur |
|----------|--------|
| Modules Gradle | 12 (1 app + 3 core + 8 feature) |
| Fichiers Kotlin | ~130 |
| Tables Room | 13 |
| Migrations DB | 8 (v3 → v11) |
| Exercices pré-seedés | 166 |
| Composants design system | 13 |
| Polices | 15 fichiers (DM Sans, Poppins, Inter) |
| Routes navigation | 40+ |
| Tests | 0 ⚠️ |
| Min SDK | 31 (Android 12) |
| Target SDK | 35 (Android 15) |

---

*Rapport généré automatiquement — PandaFit v1.0 · Mai 2026*
