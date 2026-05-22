# Affectation calendrier — Flux détaillé

## Vue d'ensemble
L'affectation = créer une session planifiée à partir d'une séance type.  
Trois modes : une date, plusieurs dates, récurrence.  
Trois modules : renforcement (`InstanceSeanceEntity`), running (`WorkoutEntity` copie), vélo (`WorkoutEntity` copie).

## Composants UI partagés
Tous dans `core/designsystem/components/AssignSessionDialogs.kt` :

### AssignMenuDialog
```kotlin
// Trois boutons : "Une date" / "Plusieurs dates" / "Récurrence"
AssignMenuDialog(
    onDismiss = { showAssignMenu = false },         // ⚠ NE PAS nullifier l'id cible ici
    onSingleDate = { showSingleDatePicker = true },
    onMultipleDates = { showMultiDateDialog = true },
    onRecurrence = { showRecurrenceDialog = true },
)
```

### AssignSingleDatePickerDialog
```kotlin
AssignSingleDatePickerDialog(
    title = "Sélectionner une date",   // paramètre optionnel
    confirmLabel = "Affecter",          // paramètre optionnel
    initialDate = LocalDate.now(),
    minDate = LocalDate.now(),          // ⚠ désactive les jours passés
    onDismiss = { showSingleDatePicker = false; assignTargetId = null },
    onConfirm = { date -> viewModel.assignToDate(id!!, date); ... },
)
```

### AssignMultiDatePickerDialog
```kotlin
AssignMultiDatePickerDialog(
    onDismiss = { showMultiDateDialog = false; assignTargetId = null },
    onConfirm = { dates: Set<LocalDate> -> viewModel.assignToDates(id!!, dates); ... },
)
// Navigation par flèches < Mois YYYY > (un mois à la fois)
// Jours passés grisés et non-cliquables
// Badge compteur de sélection violet
```

### AssignRecurrenceDialog
```kotlin
AssignRecurrenceDialog(
    onDismiss = { showRecurrenceDialog = false; assignTargetId = null },
    onConfirm = { start: LocalDate, intervalDays: Int, occurrences: Int -> ... },
)
// Sections : Fréquence (N + unité dropdown) / Date de début / Se termine
// "Jamais" → occurrences = 52|365|12 selon unité (1 an max)
// "Le [date]" → AssignSingleDatePickerDialog imbriqué (minDate = startDate+1)
// "Après N" → stepper direct
```

## Règle critique — gestion de l'id cible
```
⚠ PIÈGE : ne JAMAIS nullifier assignTargetId/assignTarget dans onDismiss du AssignMenuDialog.

Séquence correcte :
1. Utilisateur clique 📅 → assignTargetId = seance.id; showAssignMenu = true
2. AssignMenuDialog.onDismiss → showAssignMenu = false  (assignTargetId CONSERVÉ)
3. AssignMenuDialog.onSingleDate → showSingleDatePicker = true
4. AssignSingleDatePickerDialog.onConfirm → assignTargetId?.let { viewModel.assign(it, date) }
5. Après confirmation → showSingleDatePicker = false; assignTargetId = null  (libéré ici)
```

## Implémentation par module

### Renforcement (SeanceListViewModel)
```kotlin
fun assignToDate(seanceId: Long, date: LocalDate) {
    viewModelScope.launch {
        instanceSeanceDao.insertInstance(InstanceSeanceEntity(seanceId=seanceId, date=date))
    }
}
fun assignToDates(seanceId: Long, dates: Set<LocalDate>) { /* batch insert */ }
fun assignRecurring(seanceId: Long, start: LocalDate, intervalDays: Int, occurrences: Int) {
    viewModelScope.launch {
        repeat(occurrences) { i ->
            instanceSeanceDao.insertInstance(
                InstanceSeanceEntity(seanceId=seanceId, date=start.plusDays((i*intervalDays).toLong()))
            )
        }
    }
}
```

### Running (RunningListViewModel)
```kotlin
fun assignToDate(templateId: Long, date: LocalDate) {
    viewModelScope.launch {
        val template = workoutDao.getById(templateId) ?: return@launch
        val newId = workoutDao.insert(template.copy(
            id=0, isTemplate=false, scheduledDate=date, isCompleted=false,
            resultDistanceKm=null, resultDurationSec=null, resultPaceAvgMinPerKm=null,
            resultHrAvg=null, resultRpe=null, resultNotes="",
            resultHrMax=null,        // ⚠ toujours nullifier
            resultElevationM=null,   // ⚠ toujours nullifier
        ))
        // Duplication des steps et repeats avec nouveaux IDs (RunReportViewModel.duplicateForDate)
    }
}
```

### Vélo (CyclingListViewModel)
Identique au Running : `workoutDao.insert(template.copy(...))` sans steps/repeats.

## Où l'affectation N'EXISTE PAS (supprimée)
| Écran | Raison |
|---|---|
| `SeanceDetailScreen` | Affectation depuis la liste uniquement |
| `RunningWorkoutReportScreen` | Idem — plus de FAB template ni icône TopAppBar |
| `CyclingWorkoutDetailScreen` | Idem |

## Style visuel des dialogs
Conformité imposée (identique entre les 3 modes) :
- Container : `Dialog(usePlatformDefaultWidth=false)` + `Surface(RoundedCornerShape(28.dp), tonalElevation=6.dp, fillMaxWidth().padding(horizontal=24.dp))`
- Titre : `headlineSmall + FontWeight.SemiBold`
- Navigation mois : `< Mois YYYY >` avec `KeyboardArrowLeft/Right`
- Sélection : cercle plein `PandaPurple` (sélectionné), cercle transparent `PandaPurple.copy(0.15f)` (aujourd'hui)
- Boutons : `TextButton("Annuler")` + `Button(containerColor=PandaPurple, "Affecter")`
