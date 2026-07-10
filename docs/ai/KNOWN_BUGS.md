# Bugs connus et pièges

## ✅ RÉSOLUS

### Bug import TCX — horodatage GPS toujours à 0
- **Symptôme** : les points GPS d'une séance importée (`timestamp_ms`, `speed_mps`) sont systématiquement à 0/null, alors que la colonne existe pour ça (migration v19→v20) — impossible d'exploiter une trace importée pour une analyse temporelle (allure dans le temps, rejeu chronologique)
- **Cause** : `TcxParser` ne parsait jamais la balise `<Time>` du `<Trackpoint>` (pourtant obligatoire dans le format TCX) — `TcxRawPoint` n'avait même pas de champ pour ça
- **Fix** : ajout de `tag == "Time" && inTrackpoint()` (parsing ISO-8601 → epoch millis) et `tag == "Speed" && inTrackpoint()` (extension Garmin TPX) dans `TcxParser.kt`, champs `timestampMs`/`speedMs` sur `TcxRawPoint`, propagés jusqu'à `GpsTrackPointEntity` dans `TcxImportManager.insertGpsTrack()`
- **Fichiers** : `TcxParser.kt`, `TcxParsedData.kt`, `TcxImportManager.kt`

### Bug dénivelé bruité — cumul brut sans seuil anti-bruit
- **Symptôme** : le dénivelé positif calculé dépasse l'amplitude réelle du parcours sur un terrain quasi plat (ex. 19 m de gain pour ~10 m d'amplitude GPS) — le bruit de mesure (GPS ±10-20 m, baromètre montre) est compté comme du vrai dénivelé
- **Cause** : `GpsTrackingRepository.addPoint()` (live) et `TcxParser.computeElevationGain()` (import) cumulaient chacun de leur côté toute différence d'altitude positive entre deux échantillons consécutifs, sans seuil
- **Fix** : utilitaire partagé `evaluateElevationSample()` (hystérésis ±2 m — une variation sous ce seuil ne déplace pas la référence et ne compte pas comme dénivelé) dans `core/database/util/ElevationGain.kt`, utilisé par les deux moteurs
- **Fichiers** : `core/database/util/ElevationGain.kt`, `GpsTrackingRepository.kt`, `TcxParser.kt`

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

### Deload (surcharge progressive) — proposé, jamais imposé
- `prepareFinish()` (`InstanceExecuteViewModel.kt`) ne doit JAMAIS appeler `persisterObjectif()`
  directement quand `proposition.deload == true` — toujours router vers `rows` (récap
  `ProgressionRecapDialog`, Oui/Non/Ajuster)
- Seuls les échecs simples (`deload == false`, cible maintenue) sont persistés silencieusement
- Si un futur refactor du `when` dans `prepareFinish()` regroupe à nouveau ECHEC/ECHEC_MARQUE sans
  vérifier `.deload`, le deload redevient silencieux — piège à surveiller

### Historique cross-séance — même exercice dans deux blocs
- **Contexte** : `getHistoriqueForExercise` filtre par `exercise_id` (catalogue), pas par `exercice_seance_id`
- **Impact 1** : un exercice utilisé dans deux séances d'objectifs différents (ex. Squat Force 5×5 vs Volume 4×12) emprunte l'historique de l'autre séance pour le pré-remplissage — **uniquement quand `progressionActivee = false`** (si progression activée, la cible template prime, l'historique cross-séance est ignoré pour le pre-fill)
- **Impact 2** : un même exercice dans deux blocs d'une même séance (ex. Développé couché en échauffement ET en superset) : la liste historique fusionnée des deux blocs est matchée par `numeroSerie`, sans distinction de bloc → pré-remplissage potentiellement inversé (charge échauffement ↔ charge travail)
- **Décision** : archivé — cas rare en pratique, surcharge progressive masque l'impact 1
- **Fix futur** : filtrer `getHistoriqueForExercise` par `exercice_seance_id` OU par `seanceId` selon le contexte voulu

### Export JSON — version cosmétique, pas de dispatch à l'import
- Le champ `version` dans `PandaMoveExport` est écrit mais **jamais lu** — l'import tente v3 en premier, puis v2 comme fallback structurel (shape du JSON), sans branching sur `version`
- `ignoreUnknownKeys = true` + valeurs par défaut Kotlin gèrent les ajouts additifs (v3.1, v3.2) sans code supplémentaire
- **Piège futur** : si un champ change de *sens* (unité, sémantique) sans être renommé, `ignoreUnknownKeys` ne protège pas — l'ancien champ sera silencieusement ignoré et l'import sera cassé sans erreur visible
- **Action si ça arrive** : rendre `version` actionnable avec un `when (export.version)` dans `DataImportManager.import()` avant de merger le changement sémantique

### chargesAtteignables vs pasMateriel — précédence dans calculerIncrementQualitatif
- `ProgressionEngine.calculerIncrementQualitatif()` snappe sur `chargesAtteignables` (inventaire réel,
  bible §4.3) si non vide ; sinon retombe sur `pasMateriel`/`incrementKg` (legacy, catégorie MACHINE)
- Ne jamais passer les deux en supposant qu'un seul est lu silencieusement : `chargesAtteignables` a
  toujours la priorité dès qu'il est non vide, même si `pasMateriel` est également renseigné
