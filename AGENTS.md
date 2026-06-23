# AGENTS.md

## Build

```bash
./gradlew assembleDebug                        # APK debug
./gradlew test                                 # Tests unitaires
./gradlew installDebug                         # Déploiement device
./gradlew :feature:strength:assembleDebug      # Module seul
```

## Stack
Kotlin 2.0 • Compose + Material3 • Hilt • Room (schema v20) • Navigation Compose • DataStore  
OSMDroid 6.1.20 • play-services-location 21.3.0  
minSdk 31 / targetSdk 35

## Modules
```
app/
  service/       → ActiveSessionService, RunningTrackingService (ForegroundService GPS)
  navigation/    → NavHost, destinations, routes
core/
  database/      → Room (schema v20), DAOs, migrations 3→20, ActiveSessionManager
                   catalog/ → GpsTrackingRepository (@Singleton, StateFlow<LiveTrackState>)
  designsystem/  → PandaCard, PandaTopBar, AssignSessionDialogs, thème
  common/        → utilitaires partagés (normalizeSearch)
feature/
  home | running | cycling | strength | warmup | calendar | stats | profile | timer
```

## Pattern
MVVM + UDF — 1 `StateFlow<UiState>` par ViewModel — DAO → Room  
`collectAsStateWithLifecycle()` uniquement — jamais de logique dans les Composables

## Règles
- Commentaires en **français**
- Pas de logique dans les Composables (déléguer au ViewModel)
- Timer autonome (`feature/timer`) ≠ timer renforcement — scopes séparés
- Unité temps : secondes (`Int`) en base, ms (`Long`) en runtime
- Navigation : `AppDrawerNav` (Drawer) — pas de BottomNav
- Dialogs custom : `Dialog(usePlatformDefaultWidth=false)` + `Surface(RoundedCornerShape(28.dp))`
- GPS : `RunningTrackingService` dans `app/service/` — inject `GpsTrackingRepository` via Hilt
- Permis GPS : `ACCESS_FINE_LOCATION` + `FOREGROUND_SERVICE_LOCATION` (Android 14)
- Migration Room : toujours `addMigrations(...)` dans `DatabaseModule` + incrémenter `version =`
- MuscleGroup : 16 groupes (PECTORAUX, DOS, EPAULES, BICEPS, TRICEPS, QUADRICEPS, ISCHIO, FESSIERS, MOLLETS, ABDOMINAUX, TRAPEZES, LOMBAIRES, ADDUCTEURS, OBLIQUES + autres)
- Dark mode : persisté via `ProfileViewModel.isDarkMode` → DataStore → `MainActivity`

## Fichiers sensibles (ne jamais modifier)
- `google-services.json`
- `app/keystore/`
- `gradle/libs.versions.toml` (sauf ajout de dépendance explicite)

## Design
Lire `DESIGN.md` avant tout travail visuel. Direction : **Clean & Bold** (fond neutre, typographie forte, couleurs sport affirmées).
- TopBar colorée par module sport (violet/vert/bleu/orange)
- Cartes avec bande gauche 4dp + fond légèrement teinté
- Chiffres-clés en `ExtraBold`, secondaire en `PandaSubtext`

## Docs de référence
- `docs/ai/CONTEXT_COMPACT.md` — **LIRE EN PREMIER** : contexte ultra-dense (remplace 5 fichiers)
- `docs/ai/PROMPT_TEMPLATES.md` — templates de prompts par tâche (économise ~30% tokens)
- `docs/ai/ARCHITECTURE.md` — patterns MVVM, Hilt, Room, Navigation (détail)
- `docs/ai/AI_INDEX.md` — index fichiers par feature
- `docs/ai/ROOM_SCHEMA_MIN.md` — schéma Room complet (v13 — à mettre à jour vers v20)
- `docs/ai/RUNNING_FLOW.md` — flux running + GPS tracking
- `docs/ai/STRENGTH_FLOW.md` — flux renforcement + isolation template/instance
- `docs/ai/UI_CONVENTIONS.md` — conventions Compose
- `docs/ai/KNOWN_BUGS.md` — pièges architecturaux (LIRE avant toute modif)

## GPS Live Tracking (v20)
`RunningTrackingService` → `FusedLocationProviderClient` (1s, précision < 30m) → `GpsTrackingRepository.addPoint()` → `StateFlow<LiveTrackState>`  
`RunningWorkoutExecuteScreen` : carte OSMDroid 250dp fixée en haut, stats live (distance/durée/allure/vitesse), bouton Start/Stop GPS, permission launcher.  
`RunningExecuteViewModel.finishWorkout()` : auto-remplit distance/durée/allure/dénivelé depuis le GPS si tracé > 0.

## État
✅ Fonctionne : home, running (+GPS live), cycling, strength, warmup, calendar, stats, profile, timer  
✅ GPS live tracking running — RunningTrackingService + GpsTrackingRepository + OSMDroid map  
✅ Export JSON v3.0 — DataExportManager / DataImportManager  
✅ Catalogue exercices — 16 groupes musculaires, édition custom, encodeur HTML standalone  
🔄 En cours : —  
❌ Bugs connus : `docs/ai/KNOWN_BUGS.md`  
🖼 Images manquantes : timer, stats, profil — voir `docs/ai/HOME_BANNER_IMAGES.md`
