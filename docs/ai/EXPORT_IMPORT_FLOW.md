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
Racine : `PandaMoveExport`, version **3.2** (`version` écrit explicitement par `DataExportManager`,
auparavant codé en dur `"3.0"` malgré l'ajout de randonnée/respiration en v3.1) :
```json
{
  "version": "3.2",
  "exportDate": "...",
  "strengthTemplates": [...],      // séances types renforcement
  "strengthSessions": { "completed": [...], "planned": [...] },
  "runTemplates": [...], "runSessions": { ... },
  "cyclingTemplates": [...], "cyclingSessions": { ... },
  "hikingTemplates": [...], "hikingSessions": { ... },
  "breathingSessions": [...],
  "customExercises": [...],        // exercices personnalisés (isCustom=true)
  "objectifsProgression": [...],   // objectif courant par exercice (ajouté v3.2)
  "equipmentConfig": { ... }       // inventaire "Mon matériel" (ajouté v3.2)
}
```

### Surcharge progressive — ajouté v3.2
`ExerciceDto` porte désormais les 9 champs de progression (`progressionActivee`, `systemeProgression`,
`repsMin/Max`, `incrementKg`, `incrementDureeSec`, `seuilDeload`, `typeExercice`, `incrementPct`) —
absents du format jusqu'ici malgré leur présence en DB depuis v21/v23 (un export/import effaçait
silencieusement la config de progression d'une séance type).

`objectifsProgression: List<ObjectifProgressionDto>` exporte la table `objectifs_progression`
(objectif courant par exercice, bible §0.1 — charge/reps cible, compteur d'échecs). `exerciceName` est
ajouté au DTO (absent de l'entité) pour permettre la résolution cross-device à l'import, comme
`ExerciceDto.exerciceName`. Import via `ObjectifProgressionDao.upsert()` (clé `seanceId`+`exerciceId`,
pas l'`id` — déjà idempotent, pas de logique IGNORE séparée à écrire).

`equipmentConfig: EquipmentConfigDto?` exporte l'inventaire "Mon matériel" (`EquipmentRepository`,
DataStore — hors Room, donc hors de portée du reste du pipeline). Réutilise directement
`HalteresConfig`/`DisquesConfig`/`PlageConfig` de `EquipmentInventory.kt`. Import = écrasement direct
du DataStore (restauration, pas de déduplication par id).

## DTOs principaux (@Serializable)
```
PandaMoveExport
  StrengthTemplateDto       → SeanceDto + List<BlocDto> + List<ExerciceDto>
  StrengthSessionDto        → InstanceDto + List<SerieDto>
  RunWorkoutDto             → WorkoutDto + List<RunRepeatDto> + List<RunStepDto>
  CustomExerciseDto
  ObjectifProgressionDto    → objectif courant par exercice (v3.2)
  EquipmentConfigDto        → HalteresConfig + DisquesConfig (barre) + PlageConfig (kettlebell/câble) (v3.2)
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
