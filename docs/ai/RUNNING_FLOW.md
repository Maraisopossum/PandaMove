# Running — Flux complet

## Entités principales
| Entité | Table | Rôle |
|---|---|---|
| `WorkoutEntity` | `workouts` | Séance running/vélo (template ou planifiée) |
| `RunRepeatEntity` | `run_repeats` | Groupe de répétitions |
| `RunStepEntity` | `run_steps` | Étape individuelle (course, récup, échauffement…) |

## Champs critiques WorkoutEntity
```
isTemplate: Boolean          → true = séance type, false = planifiée/terminée
isCompleted: Boolean         → true = résultats saisis
scheduledDate: LocalDate
resultDistanceKm: Double?    → saisi à la fin
resultDurationSec: Int?      → saisi à la fin
resultPaceAvgMinPerKm: Double?
resultHrAvg: Int?            → FC moyenne
resultHrMax: Int?            → FC max (migration v10→v11)
resultRpe: Int?
resultNotes: String
resultElevationM: Int?       → dénivelé réel (migration v10→v11) ← utilisé dans stats
completedAt: String?
```

## RunStepEntity — champs importants
```
stepType: RunStepType        → ACTIVE | RECOVERY | WARMUP | COOLDOWN
endType: RunEndType          → DISTANCE | DURATION | OPEN
endValue: Double
endUnit: RunEndUnit          → KM | M | MIN | SEC
targetType: RunTargetType    → PACE | HR | POWER | NONE
targetMin / targetMax: Double?
resultsJson: String          → résultats réels encodés JSON
```

## Flux création séance type
```
RunningScreen → FAB → RunningWorkoutDetailScreen (editor)
RunningDetailViewModel.save() → workoutDao.insert(WorkoutEntity(isTemplate=true))
+ stepDao.insertAll() / repeatDao.insert()
```

## Flux planification (duplication template → séance planifiée)
```
RunningScreen carte template → icône 📅
AssignMenuDialog → AssignSingleDatePickerDialog / AssignMultiDatePickerDialog / AssignRecurrenceDialog
RunningListViewModel.assignToDate(id, date)
  → workoutDao.insert(template.copy(
      id=0, isTemplate=false, scheduledDate=date, isCompleted=false,
      resultDistanceKm=null, resultDurationSec=null, resultPaceAvgMinPerKm=null,
      resultHrAvg=null, resultRpe=null, resultNotes="",
      resultHrMax=null,        // ⚠ à nullifier explicitement
      resultElevationM=null,   // ⚠ à nullifier explicitement
    ))
+ duplication des RunRepeatEntity et RunStepEntity avec nouveaux IDs
```

## Calcul allure live
```kotlin
// RunningExecuteViewModel.updateOverallResult(field, value)
// Quand "distance" ou "duration" change → computePaceStr() recalcule automatiquement l'allure
private fun computePaceStr(distanceKm: String, durationStr: String): String?
// → parse dist (Double) + dur (MM:SS ou HH:MM:SS) → pace = durSec / 60 / distKm (min/km)
// → résultat injecté dans resultPaceStr du UiState (champ allure pré-rempli)
```

## Flux exécution + sauvegarde résultats
```
RunningScreen carte planifiée → RunningWorkoutExecuteScreen
Utilisateur remplit ResultInputCell ("Distance", "Temps", "Allure", "FC moy.", "FC max", "RPE", "Dénivelé")
→ Allure auto-calculée dès que Distance + Temps sont renseignés
RunningExecuteViewModel.finishWorkout()
  → workoutDao.saveResults(
      id, distKm, durSec, pace, hr, hrMax, rpe, notes, elevationM, completedAt
    )
  → repeatDao.update(repeat.copy(resultsJson = json.encodeToString(reps)))
  → stepDao.update(step.copy(resultsJson = json.encodeToString(result)))
→ navController → RunningWorkoutReportScreen
```

## Rapport (RunningWorkoutReportScreen)
- Chargé par `RunningReportViewModel` : workout + repeats + steps
- Sections : résultats globaux (`GlobalResultsCard`) + blocs répétition (lecture seule)
- `GlobalResultsCard` affiche : Distance / Temps / Allure moy. / FC moy. / FC max / RPE / Dénivelé
- **Dénivelé** : lu depuis `workout.resultElevationM` (saisi à l'exécution) ← pas calculé depuis distance

## GPS Live Tracking (v20)
```
Permissions : ACCESS_FINE_LOCATION + ACCESS_COARSE_LOCATION + FOREGROUND_SERVICE_LOCATION
Service : app/service/RunningTrackingService (@AndroidEntryPoint, ForegroundService)
  → FusedLocationProviderClient : Priority.PRIORITY_HIGH_ACCURACY, 1s interval, précision < 30m
  → Appelle gpsTrackingRepository.addPoint(lat, lng, altM, speedMps, accuracyM, timestampMs)
  → ACTION_START (workoutId) / ACTION_STOP
Repository : core/database/catalog/GpsTrackingRepository (@Singleton)
  → StateFlow<LiveTrackState> { isTracking, distanceM, durationSec, speedMps, paceMinkm, elevationGainM, points }
  → Haversine pour delta distance · gain élévation cumulé · pace depuis speed FusedLocation si > 0.5 m/s
  → addPoint() : suspend, insère GpsTrackPointEntity + met à jour le state
ViewModel (RunningExecuteViewModel) :
  → liveTrackState : StateFlow<LiveTrackState> (stateIn WhileSubscribed 5s)
  → startGpsTracking() → RunningTrackingService.start(context, workoutId)
  → stopGpsTracking() → RunningTrackingService.stop(context)
  → finishWorkout() : si track.distanceM > 0 → auto-remplit distanceKm/duration/pace/elevation
Screen (RunningWorkoutExecuteScreen) :
  → GpsTrackBlock composable (premier item LazyColumn) : 250dp, RoundedCornerShape(14dp)
  → Si permission absente : placeholder + bouton "Autoriser la localisation"
  → Si permission : MapView OSMDroid + polyline violette + stats bar (distance/durée/allure/vitesse)
  → Bouton ▶ Start GPS (PandaPurple) / ⏹ Stop GPS (RedColor) en overlay top-right
  → DisposableEffect : mapView.onResume() / mapView.onPause()
  → AndroidView(factory = remember(ctx) { MapView }, update = { polyline + animateTo })
DB : gps_track_points (workout_id, point_index, latitude, longitude, altitude_m, timestamp_ms, speed_mps, accuracy_m)
Migration : v19→v20 — ALTER TABLE gps_track_points ADD COLUMN timestamp_ms/speed_mps/accuracy_m
```

## Points sensibles
- `resultElevationM` saisi dans `RunningWorkoutExecuteScreen` → `RunningExecuteViewModel.updateOverallResult("elevation", it)` → `finishWorkout()` → `saveResults(elevationM = s.resultElevationM.toIntOrNull())`
- Si GPS actif à finishWorkout() → auto-remplit et écrase les champs distance/durée/allure/dénivelé
- Dans **stats** : `totalElev = completed.sumOf { it.resultElevationM ?: 0 }` — filtre par `scheduled_date` (pas `completed_at`)
- Fun card "sommet" : `totalElevationM / summit.elevationM * 100` (dénivelé réel, pas distance)
- `RunningReportViewModel.duplicateForDate()` : toujours inclure `resultHrMax = null, resultElevationM = null` dans le `.copy()`
- `gpsTrackingRepository.reset()` appelé après `finishWorkout()` pour nettoyer le state
