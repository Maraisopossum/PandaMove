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
  → filtres : groupe musculaire (16 groupes), équipement, custom/catalogue
  → recherche : ex.name.normalizeSearch().contains(query.normalizeSearch())
      (normalizeSearch() dans core/common → supprime accents, lowercase)
  → muscleToGroup(muscle: String): MuscleGroup → filtre les exercices par groupe musculaire
  → toExerciseCategory(): MuscleGroup → ExerciseCategory (mapping 16 groupes → 7 catégories)
      TRAPEZES/LOMBAIRES → BACK · ADDUCTEURS → LEGS · OBLIQUES → CORE
Exercices custom (isCustom=true) : exportés + éditables via _showEdit / saveEdit()
Exercices catalogue (isCustom=false) : non éditables, non exportés
Édition : ExerciseCatalogViewModel.openEdit(exercise) → _showEdit = true
          saveEdit() → exerciseDao.update(entity) ; closeEdit() → _showEdit = false
MuscleGroup (16) : PECTORAUX DOS EPAULES BICEPS TRICEPS QUADRICEPS ISCHIO FESSIERS
                   MOLLETS ABDOMINAUX TRAPEZES LOMBAIRES ADDUCTEURS OBLIQUES AUTRE FULL_BODY
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

## Dark mode
```
ProfileViewModel.isDarkMode : StateFlow<Boolean>  → persisté via DataStore
MainActivity câble isDarkMode → MaterialTheme(darkTheme = isDarkMode)
ProfileScreen → switch "Mode sombre" → ProfileViewModel.setDarkMode(Boolean)
```

## Points sensibles
- `importLauncher = rememberLauncherForActivityResult(GetContent())` → lance le file picker system
- Content type lancé : `"application/json"`
- `context.contentResolver.openInputStream(uri)?.bufferedReader()?.readText()` → lecture fichier
- `StatsConfigScreen` est dans `feature/stats/` (pas `feature/profile/`) → évite dépendance inter-modules inversée
- `toExerciseCategory()` dans `ExerciseCatalogViewModel` doit couvrir les 16 MuscleGroup explicitement (sinon les 4 nouveaux tombent dans AUTRE)
