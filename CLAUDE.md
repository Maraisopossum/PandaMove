# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Run

```bash
# Build debug APK
./gradlew assembleDebug

# Run tests
./gradlew test

# Run on device
./gradlew installDebug

# Single module build
./gradlew :feature:strength:assembleDebug
```

## Module Architecture

Multi-module Android project (Kotlin + Jetpack Compose + Hilt + Room):

```
app/                    — NavHost, MainActivity, ActiveSessionViewModel
core/
  common/               — Result types, utilities
  database/             — Room DB (PandaFitDatabase), DAOs, entities, relations, ActiveSessionManager singleton
  designsystem/         — PandaFitTheme, PandaCard, PandaButton, SportIconBadge, color tokens
feature/
  home/                 — Dashboard with upcoming sessions and active-session resume banner
  running/              — Running workouts (list, detail, execute)
  cycling/              — Cycling workouts (list, detail)
  strength/             — Strength training: SeanceListScreen, SeanceCreateScreen, SeanceDetailScreen, InstanceExecuteScreen
  calendar/             — Calendar view of all scheduled workouts
  stats/                — Statistics with Vico charts
  profile/              — User name, dark mode (DataStore), JSON export
  timer/                — Standalone workout timer (COUNTDOWN, HIIT, TABATA, EMOM, AMRAP, FOR_TIME)
```

## Key Architecture Decisions

**Navigation**: Jetpack Navigation Compose with bottom bar (8 destinations). Execute screens hide the bottom bar.

**Strength training data model**:
- `SeanceEntity` = template (séance type)
- `BlocSeanceEntity` = exercise group (ECHAUFFEMENT, SUPERSET, CIRCUIT, RECUPERATION) with global `position` for ordering
- `ExerciceSeanceEntity` = exercise in a session; `position` field = global order among libre + bloc items
- `InstanceSeanceEntity` = scheduled occurrence of a template
- `SerieRealiseeEntity` = actual set recorded during execution (CASCADE-deleted if its ExerciceSeanceEntity is deleted)

**Exercise ordering**: `ExerciceSeanceEntity.position` and `BlocSeanceEntity.position` share the same global counter, allowing libre exercises and blocs to be interleaved. `InstanceExecuteViewModel.buildOrderedExercises()` merges them by position.

**Saving edits**: `SeanceCreateViewModel.updateExistingSeanceContent()` does UPDATE in-place for entities with existing IDs to avoid CASCADE-deleting historical series. Only truly removed exercises are deleted.

**Active session persistence**: `ActiveSessionManager` (Hilt `@Singleton` in `core:database`) holds the session timer and ID. The `InstanceExecuteViewModel` registers with it on load; the NavHost shows a persistent banner.

**Dark mode**: `ProfileViewModel.isDarkMode: StateFlow<Boolean>` (DataStore-backed) is injected in `MainActivity.setContent {}` and passed to `PandaFitTheme(darkTheme = ...)`.

## Database

Room with type converters for `LocalDate`/`LocalDateTime` and `List<String>`. Migration strategy: add schema in `core/database/schemas/`. Current DB version: check `PandaFitDatabase`.

**Important**: `SerieRealiseeEntity` has `onDelete = CASCADE` on `exerciceSeanceId` FK. Deleting an `ExerciceSeanceEntity` destroys all historical series for that exercise.

## Tech Stack

- Kotlin 2.0.0, Compose BOM 2024.06.00, Material3 1.2.1
- Hilt 2.51.1 (DI), Room 2.6.1, KSP 2.0.0
- DataStore Preferences (user settings), WorkManager (seeding)
- Vico 1.15.0 (charts), Coil 2.6.0 (images)
- Min SDK 31 (Android 12)
