# Bugs connus et pièges

## ✅ RÉSOLUS

### Bug affectation séance type — assignTargetId nullifié trop tôt
- **Symptôme** : clic icône 📅 → dialog apparaît → choix date → rien ne se passe
- **Cause** : `onDismiss = { showAssignMenu = false; assignTarget = null }` — l'id est effacé avant que le sous-dialog puisse l'utiliser
- **Fix** : retirer `assignTarget = null` du `onDismiss` de `AssignMenuDialog` (le clearer uniquement à la confirmation)
- **Fichiers** : `SeanceListScreen.kt`, `RunningScreen.kt`, `CyclingScreen.kt`

### Bug rapport running — FCmax et Dénivelé absents
- **Symptôme** : résultats saisis (FCmax=172, dénivelé=30m) mais non affichés dans le rapport
- **Cause** : `GlobalResultsCard` n'affichait pas `resultHrMax` ni `resultElevationM`
- **Fix** : ajout de deux `ResultCell` dans `RunningWorkoutReportScreen.kt`

### Bug stats dénivelé — calcul depuis distance au lieu du réel
- **Symptôme** : % sommet calculé avec `distanceKm * 1000 / 4808` (horizontal → altitude)
- **Fix** : `FunRunningCard` utilise maintenant `totalElevationM / summit.elevationM * 100`
- **Fichier** : `StatsScreen.kt`

### Bug tonnage renforcement — séries DURATION comptées comme reps
- **Symptôme** : tonnage gonflé artificiellement quand des exercices sont en mode "Temps"
- **Cause** : `repsRealisees` = secondes pour les DURATION, pas des répétitions
- **Fix** : `if (exerciceToRepsType[s.exerciceSeanceId] == RepsType.DURATION) 0.0`
- **Fichiers** : `InstanceSeanceDao.kt` (ExerciceMapping + repsType), `StatsViewModel.buildStrengthDetail()`

### Bug ordre exercices superset — sélection multi
- **Symptôme** : l'utilisateur sélectionne "Élévations PUIS Face pull" mais l'ordre est inversé
- **Cause** : `availableExercises.filter { it.id in multiSelectedIds }` utilise l'ordre alphabétique DB (ORDER BY name ASC en UTF-8 binaire — "F" < "É" car 0x46 < 0xC3)
- **Fix** : `multiSelectedIds.mapNotNull { id -> exercisesById[id] }` (respecte l'ordre d'insertion du LinkedHashSet)
- **Fichier** : `SeanceCreateViewModel.confirmMultiSelection()`

### Bug toExerciseCategory — 4 groupes musculaires non mappés
- **Symptôme** : exercices TRAPEZES, LOMBAIRES, ADDUCTEURS, OBLIQUES affichés dans la catégorie "Autre" au lieu de DOS/JAMBES/CORE
- **Cause** : `when (this)` dans `ExerciseCatalogViewModel.toExerciseCategory()` n'avait pas de case pour les 4 groupes ajoutés après la création initiale
- **Fix** : ajouter explicitement `MuscleGroup.TRAPEZES, MuscleGroup.LOMBAIRES -> ExerciseCategory.BACK`, `MuscleGroup.ADDUCTEURS -> ExerciseCategory.LEGS`, `MuscleGroup.OBLIQUES -> ExerciseCategory.CORE`
- **Fichier** : `feature/profile/viewmodel/ExerciseCatalogViewModel.kt`

### Bug duplication workout — resultHrMax/resultElevationM copiés du template
- **Symptôme** : nouvelles instances héritent de valeurs résiduelles du template
- **Fix** : `resultHrMax = null, resultElevationM = null` dans `duplicateForDate().copy(...)`
- **Fichier** : `RunningReportViewModel.duplicateForDate()`

### Bug FLAG_ACTIVITY_NEW_TASK — partage export
- **Symptôme** : crash "Calling startActivity() from outside of Activity context"
- **Cause** : flag sur l'intent fils au lieu du chooser
- **Fix** : `Intent.createChooser(send, ...).apply { addFlags(FLAG_ACTIVITY_NEW_TASK) }`
- **Fichier** : `DataExportManager.shareFile()`

---

## ⚠ PIÈGES ARCHITECTURAUX

### SeanceFull @Relation non ordonnée
- Room `@Relation` ne garantit PAS l'ordre des enfants
- Toujours `.sortedBy { it.exerciceSeance.position }` après récupération
- Fichiers concernés : `SeanceCreateViewModel.loadSeance()`, `InstanceExecuteViewModel.buildOrderedExercises()`

### ExerciceDraft.position ≠ position de sauvegarde
- Le champ `position` dans `ExerciceDraft` est potentiellement obsolète après reordonnancement
- La position réelle sauvegardée = `eIdx` dans `forEachIndexed` de `updateExistingSeanceContent()`
- Ne jamais utiliser `exDraft.position` pour la sauvegarde

### Stats — filtre par scheduled_date, pas completed_at
- `workoutDao.observeByDateRange(startDate, today)` filtre sur `scheduled_date`
- Une séance planifiée il y a 35 jours mais terminée aujourd'hui ne s'affiche pas dans "30j"

### DataStore et multiple instances
- `@StatsDataStore` qualifier obligatoire pour distinguer le DataStore stats des autres
- Fichier : `stats/preferences/StatsPreferences.kt`

### Calendrier — icône supprimée dans les écrans détail
- Affectation uniquement depuis la **liste** (SeanceListScreen, RunningScreen, CyclingScreen)
- **Supprimée** de : `SeanceDetailScreen`, `RunningWorkoutReportScreen`
- Ne pas réintroduire dans ces écrans

### RepsType.DURATION dans les stats
- `repsRealisees` pour DURATION = secondes, non des répétitions
- Impact : tonnage ET totalReps doivent ignorer ces séries (traiter comme 0)
- Source : `ExerciceSeanceEntity.repsType` (via `ExerciceMapping` dans `InstanceSeanceDao`)
