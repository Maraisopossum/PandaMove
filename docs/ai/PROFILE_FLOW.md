# Profil — Flux complet

## Fichiers
| Rôle | Fichier |
|---|---|
| UI | `feature/profile/ui/ProfileScreen.kt` |
| VM | `feature/profile/viewmodel/ProfileViewModel.kt` |
| Catalogue exercices | `feature/profile/ui/ExerciseCatalogScreen.kt` |
| VM catalogue | `feature/profile/viewmodel/ExerciseCatalogViewModel.kt` |
| Équipement | `feature/profile/ui/EquipmentScreen.kt` |
| VM équipement | `feature/profile/viewmodel/EquipmentViewModel.kt` |
| Config stats | `feature/stats/ui/StatsConfigScreen.kt` (accessible depuis profil) |
| VM config stats | `feature/stats/viewmodel/StatsConfigViewModel.kt` |

## Sections ProfileScreen
```
1. Carte identité         → nom utilisateur (éditable via AlertDialog inline)
2. Profil                 → genre (MALE/FEMALE), boutons radio
3. Renforcement           → "Mon matériel" + "Catalogue d'exercices"
4. Statistiques           → "Configuration des statistiques" → StatsConfigScreen
5. Données                → "Exporter" + "Importer" + "À propos"
```

## Flux renommage utilisateur
```
icône crayon → showRenameDialog = true
AlertDialog + OutlinedTextField
→ ProfileViewModel.updateUserName(name)
   → SharedPreferences ou DataStore (selon implémentation)
```

## Flux export/import
Voir `EXPORT_IMPORT_FLOW.md`.

## Équipement (EquipmentScreen)
```
Liste de catégories d'équipement disponibles
→ EquipmentRepository.selectedEquipment: StateFlow<Set<EquipmentCategory>>
→ Persisté en SharedPreferences / DataStore
→ Utilisé dans SeanceCreateViewModel.filteredPickerExercises() pour filtrer les exercices
```

## Catalogue exercices (ExerciseCatalogScreen)
```
ExerciseCatalogViewModel
  → exerciseDao.observeAll() : Flow<List<ExerciseEntity>>
  → filtres : groupe musculaire, équipement, custom/catalogue
Exercices custom : isCustom=true → exportés, éditables
Exercices catalogue : isCustom=false → non éditables, non exportés
```

## Navigation depuis Profil
```
ProfileScreen(
    onNavigateToEquipment = { navController.navigate("profile/equipment") },
    onNavigateToExerciseCatalog = { navController.navigate("profile/exercises") },
    onNavigateToStatsConfig = { navController.navigate(ProfileRoutes.STATS_CONFIG) },
    onOpenDrawer = { drawerState.open() },
)
```

## ExportImportStatus (états VM)
```kotlin
enum class ExportImportStatus { IDLE, EXPORTING, SUCCESS_EXPORT, IMPORTING, SUCCESS_IMPORT, ERROR }
// SUCCESS_EXPORT → auto-clear après 3 secondes (LaunchedEffect dans ProfileScreen)
// SUCCESS_IMPORT → AlertDialog avec résumé ImportResult(imported, skipped, errors)
```

## Points sensibles
- `importLauncher = rememberLauncherForActivityResult(GetContent())` → lance le file picker system
- Content type lancé : `"application/json"`
- `context.contentResolver.openInputStream(uri)?.bufferedReader()?.readText()` → lecture fichier
- `StatsConfigScreen` est dans `feature/stats/` (pas `feature/profile/`) → évite dépendance inter-modules inversée
