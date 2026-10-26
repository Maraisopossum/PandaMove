# Système Calendrier / Affectation

## Source of truth
- **Renforcement** : `InstanceSeanceEntity` (table `instances_seance`) — une ligne = une session planifiée
- **Running / Vélo** : `WorkoutEntity` (table `workouts`) — `isTemplate=false`, `scheduledDate` = date planifiée
- Écran calendrier (`feature/calendar/ui/CalendarScreen.kt` + `CalendarViewModel.kt`) : agrège les deux
  sources par mois, **plus lecture seule** — filtres par sport, ajout de séance depuis l'état vide du
  jour, reschedule/suppression, section "Prochaines séances" (voir plus bas)
- ⚠ Ne pas confondre avec `core/designsystem/components/AppCalendarView.kt` — grille de calendrier
  réutilisable générique (utilisée notamment par les dialogs d'affectation ci-dessous), sans lien direct
  avec l'écran Calendrier

## Écran Calendrier — état actuel
```
Filtres sport (CalendarSportToggle) : pictogrammes ronds icône seule, "Tous" + un par WorkoutType
  → toggleFilter(type) / selectAllFilters() dans CalendarViewModel
Grille mensuelle : jour sélectionné/aujourd'hui en pastille 30dp (pas la cellule entière)
  ⚠ premier jour de la semaine = (dayOfWeek.value + 6) % 7 — PAS dayOfWeek.value % 7 (bug corrigé :
  décalait tous les jours d'une case, lundi=1 non ramené à l'offset 0)
Jour sélectionné, vide : CalendarEmptyDayState — mascotte (gender-aware via UserPreferencesRepository
  .genderFlow), titre + CTA "Ajouter une séance" → AddSessionChooserSheet (Renfort/Running/Vélo)
  → réutilise SeancePickerSheet / WorkoutPickerSheet existants
Jour sélectionné, non vide : CalendarWorkoutItem / CalendarInstanceItem / CalendarBreathingItem
Section "Prochaines séances" : CalendarViewModel combine WorkoutDao.observeUpcoming() +
  InstanceSeanceDao.observeUpcoming() (STRENGTH uniquement, WARMUP exclu), triées par date, limite 5
  → modèle UpcomingItem (sealed interface Workout | Instance) dans CalendarUiState.kt
```

## Composants réutilisables (designsystem)
Tous dans `core/designsystem/components/AssignSessionDialogs.kt` :

| Composable | Rôle |
|---|---|
| `AssignMenuDialog` | Menu de choix (une date / plusieurs / récurrence) |
| `AssignSingleDatePickerDialog` | Calendrier navigation mensuelle, sélection unique |
| `AssignMultiDatePickerDialog` | Calendrier navigation mensuelle, multi-sélection |
| `AssignRecurrenceDialog` | Fréquence + unité + fin (Jamais/Date/N occurrences) |

**Style unifié** : `Dialog(usePlatformDefaultWidth=false)` + `Surface(RoundedCornerShape(28.dp))` + boutons `TextButton/Button(PandaPurple)`

## Flux d'affectation — Renforcement (SeanceListScreen)
```
Icône 📅 sur carte → assignTargetId = seance.id + showAssignMenu = true
AssignMenuDialog.onDismiss = { showAssignMenu = false }  // ⚠ NE PAS clearer assignTargetId ici
  → onSingleDate → showSingleDatePicker = true
  → onMultipleDates → showMultiDateDialog = true
  → onRecurrence → showRecurrenceDialog = true
Confirmation → viewModel.assignToDate(assignTargetId!!, date)
              → viewModel.assignToDates(assignTargetId!!, dates)
              → viewModel.assignRecurring(assignTargetId!!, start, intervalDays, occurrences)
```

**Point critique** : `onDismiss` du `AssignMenuDialog` ne doit PAS nullifier `assignTargetId` (bug historique, corrigé dans les 3 modules : strength, running, cycling).

## Flux d'affectation — Running & Vélo
Identique mais `assignTarget: WorkoutEntity?` (l'entité complète, pas juste l'id).  
`viewModel.assignToDate(id, date)` → `workoutDao.insert(template.copy(id=0, isTemplate=false, scheduledDate=date, ...))`

## Récurrence
- `onConfirm(startDate, intervalDays, occurrences)` : signature unique pour les 3 modules
- "Jamais" → occurrences = 52 (semaine) / 365 (jour) / 12 (mois) — limite pratique 1 an
- "Le [date]" → calcul `ChronoUnit.DAYS.between(start, end) / intervalDays + 1`
- "Après N" → direct
- `intervalDays` = freqCount × (1|7|30) selon unité

## Où l'affectation N'EXISTE PAS
- `SeanceDetailScreen` (renforcement) : icône calendrier supprimée — affectation depuis la LISTE uniquement
- `RunningWorkoutReportScreen` : idem — plus de FAB ni d'icône calendrier pour les templates

## Contraintes architecture
- `AssignSingleDatePickerDialog` : `minDate = LocalDate.now()` par défaut (pas de passé)
- `AssignRecurrenceDialog` end date picker : `minDate = startDate.plusDays(1)`
- Duplication workout running : toujours nullifier `resultHrMax = null, resultElevationM = null` dans le `.copy()`
