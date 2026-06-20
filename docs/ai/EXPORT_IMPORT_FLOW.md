# Export / Import JSON — Flux complet

## Fichiers
| Rôle | Fichier |
|---|---|
| Export | `core/database/export/DataExportManager.kt` |
| Import | `core/database/export/DataImportManager.kt` |
| DTOs | `core/database/export/ExportDtos.kt` |
| VM export/import | `feature/profile/viewmodel/ProfileViewModel.kt` |
| UI déclencheur | `feature/profile/ui/ProfileScreen.kt` |

## Format export
Fichier JSON : `pandamove_export_YYYY-MM-DD.json`  
Racine : `PandaMoveExport` avec 5 sections :
```json
{
  "exportDate": "...",
  "strengthTemplates": [...],   // séances types renforcement
  "strengthSessions": [...],    // instances terminées + séries
  "runWorkouts": [...],         // workouts running/vélo avec repeats + steps
  "customExercises": [...],     // exercices personnalisés (isCustom=true)
  "statistics": { ... }         // snapshot stats calculé à l'export
}
```

## DTOs principaux (@Serializable)
```
PandaMoveExport
  StrengthTemplateDto   → SeanceDto + List<BlocDto> + List<ExerciceDto>
  StrengthSessionDto    → InstanceDto + List<SerieDto>
  RunWorkoutDto         → WorkoutDto + List<RunRepeatDto> + List<RunStepDto>
  CustomExerciseDto
  StatsSnapshotDto      → totalStrengthSessions, totalRunSessions, totalDistanceKm
```

## Flux export
```
ProfileScreen → "Exporter mes données" → ProfileViewModel.exportData()
  → DataExportManager.export()           // suspend, Dispatchers.IO
      → seanceDao.observeAll().first()
      → instanceSeanceDao.observeAll().first()
      → workoutDao.observeAll().first().filter { RUNNING|CYCLING }
      → exerciseDao.observeAll().first().filter { isCustom }
      → json.encodeToString(export)
      → File(context.cacheDir, fileName).writeText(jsonStr)
      → return File
  → DataExportManager.shareFile(file)
      → FileProvider.getUriForFile(context, "${packageName}.fileprovider", file)
      → Intent(ACTION_SEND, type="application/json")
      → ⚠ FLAG_ACTIVITY_NEW_TASK sur le CHOOSER, pas sur l'intent fils :
          Intent.createChooser(send, "Partager…").apply { addFlags(FLAG_ACTIVITY_NEW_TASK) }
      → context.startActivity(chooser)
```

## Flux import
```
ProfileScreen → "Importer des données" → importLauncher.launch("application/json")
  → uri → contentResolver.openInputStream(uri) → JSON string
  → ProfileViewModel.importData(content)
      → DataImportManager.import(jsonContent)
          → json.decodeFromString<PandaMoveExport>(jsonContent)
          → Pour chaque entité : insertXxxIgnore() (OnConflictStrategy.IGNORE)
              → déduplique par id — si la ligne existe déjà → ignorée
          → return ImportResult(imported, skipped, errors)
```

## Stratégie déduplication
- Toutes les insertions import utilisent `OnConflictStrategy.IGNORE`
- Séances types : `seanceDao.insertSeanceIgnore(entity)`
- Workouts running : `workoutDao.insertIgnore(entity)`
- Exercices custom : `exerciseDao.insertIgnore(entity)`
- Un deuxième import du même fichier → 0 nouveaux, tout skippé

## Résultat import — UI
```kotlin
data class ImportResult(val imported: Int, val skipped: Int, val errors: Int)
// Affiché dans AlertDialog depuis ProfileScreen
// ExportImportStatus : IDLE | EXPORTING | SUCCESS_EXPORT | IMPORTING | SUCCESS_IMPORT | ERROR
```

## Points sensibles
- `FLAG_ACTIVITY_NEW_TASK` : **obligatoirement** sur le `createChooser()`, jamais sur l'`Intent(ACTION_SEND)` (sinon crash hors Activity context)
- `FileProvider` : configuré dans le manifest avec `${packageName}.fileprovider`
- `cacheDir` : le fichier export est temporaire, recréé à chaque export
- Import idempotent : safe à relancer plusieurs fois sur le même fichier
- Les `customExercises` sont filtrés par `isCustom=true` à l'export (le catalogue par défaut n'est pas exporté)
- Les séries réalisées (`series_realisees`) sont exportées dans `StrengthSessionDto.series`
- Les résultats par step running (`resultsJson`) sont inclus dans `RunStepDto.resultsJson`
- Les `gps_track_points` ne sont pas exportés (données volumineuses — tracés GPS uniquement en DB locale)
- Exercices custom : incluent les champs `muscle_groups` (liste des 16 MuscleGroup) et `muscle_primary`
