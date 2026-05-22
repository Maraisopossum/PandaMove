# Vélo — Flux complet

## Entité principale
`WorkoutEntity` (table `workouts`) — partagée avec Running, discriminée par `workout_type = CYCLING`

## Champs critiques WorkoutEntity (vélo)
```
workout_type: CYCLING
is_template: Boolean       → true = séance type, false = planifiée/terminée
is_completed: Boolean
scheduled_date: LocalDate
duration_minutes: Int?     → durée prévue (avant exécution)
result_duration_sec: Int?  → durée réelle saisie
result_distance_km: Double? → distance réelle
result_hr_avg: Int?
result_rpe: Int?
result_notes: String
completed_at: String?
```

Note : `result_hr_max` et `result_elevation_m` existent en DB (migration v10→v11) mais peuvent ne pas être affichés dans l'UI vélo selon l'implémentation.

## Flux création séance type
```
CyclingScreen → FAB → CyclingWorkoutDetailScreen (éditeur)
CyclingListViewModel (ou CyclingDetailViewModel).save()
  → workoutDao.insert(WorkoutEntity(workoutType=CYCLING, isTemplate=true))
```

## Flux planification (duplication template)
```
CyclingScreen → carte template → icône 📅
AssignMenuDialog.onDismiss = { showAssignMenu = false }  // ⚠ NE PAS nullifier assignTarget
→ CyclingListViewModel.assignToDate(id, date)
    → workoutDao.insert(template.copy(
        id=0, isTemplate=false, scheduledDate=date, isCompleted=false,
        resultDistanceKm=null, resultDurationSec=null, resultHrAvg=null,
        resultRpe=null, resultNotes="",
      ))
→ assignToDates(id, dates)
→ assignRecurring(id, start, intervalDays, occurrences)
```

## Flux exécution / saisie résultats
Le vélo n'a pas d'écran d'exécution step-by-step comme le running.  
Validation via `WorkoutDao.saveResults()` ou via `WorkoutDao.updateCompletion()`.

```kotlin
workoutDao.saveResults(
    id, distKm, durSec, pace=null, hr, hrMax=null, rpe, notes, elevationM=null, completedAt
)
```

## Affichage liste
```
CyclingScreen.LazyColumn
  Section "Séances types"     → observeTemplatesByType(CYCLING)
  Section "Séances planifiées" → observePlannedByType(CYCLING)
  Section "Séances terminées"  → observeCompletedByType(CYCLING)
```

## Stats vélo
- Section "Vélo" dans `StatsScreen` : `SimpleSportCard` (séances, durée totale, durée moy., taux complétion)
- Pas de stats détaillées distance/allure (contrairement au running)
- `StatsViewModel` : `runningCyclingStats(WorkoutType.CYCLING)` → `SportStats` uniquement

## Points sensibles
- Même bug historique `onDismiss` que running/strength → corrigé dans `CyclingScreen.kt`
- `WorkoutDao.observeByType(CYCLING)` retourne templates + planned + completed mélangés → utiliser les queries spécialisées
- Pas de `RunRepeatEntity` / `RunStepEntity` pour le vélo (pas de blocs d'intervalles structurés)
