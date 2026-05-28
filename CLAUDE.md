# CLAUDE.md

## Build

```bash
./gradlew assembleDebug                        # APK debug
./gradlew test                                 # Tests unitaires
./gradlew installDebug                         # Déploiement device
./gradlew :feature:strength:assembleDebug      # Module seul
```

## Stack
Kotlin 2.0 • Compose + Material3 • Hilt • Room v11 • Navigation Compose • DataStore  
minSdk 31 / targetSdk 35

## Modules
```
app/             → NavHost, DI wiring, AppDrawerNav
core/
  database/      → Room, DAOs, entités, migrations (v11), ActiveSessionManager
  designsystem/  → PandaCard, PandaTopBar, AssignSessionDialogs, thème
  common/        → utilitaires partagés
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

## Fichiers sensibles (ne jamais modifier)
- `google-services.json`
- `app/keystore/`
- `gradle/libs.versions.toml` (sauf ajout de dépendance explicite)

## Docs de référence
- `docs/ai/ARCHITECTURE.md` — patterns MVVM, Hilt, Room, Navigation
- `docs/ai/PROJECT_CONTEXT_MIN.md` — contexte minimal + flux critiques
- `docs/ai/AI_INDEX.md` — index fichiers par feature
- `docs/ai/ROOM_SCHEMA_MIN.md` — schéma Room
- `docs/ai/UI_CONVENTIONS.md` — conventions Compose

## État
✅ Fonctionne : home, running, cycling, strength, warmup, calendar, stats, profile, timer  
🔄 En cours : —  
❌ Bugs connus : `docs/ai/KNOWN_BUGS.md`  
🖼 Images manquantes : timer, stats, profil — voir `docs/ai/HOME_BANNER_IMAGES.md`
