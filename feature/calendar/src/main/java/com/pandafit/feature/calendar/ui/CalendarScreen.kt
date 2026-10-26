package com.pandafit.feature.calendar.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.DirectionsBike
import androidx.compose.material.icons.automirrored.filled.DirectionsRun
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.pandafit.core.database.entities.WorkoutType
import com.pandafit.designsystem.components.AssignSingleDatePickerDialog
import com.pandafit.designsystem.components.PandaCard
import com.pandafit.designsystem.components.PandaErrorState
import com.pandafit.designsystem.components.PandaTopBar
import com.pandafit.designsystem.theme.PandaBlue
import com.pandafit.designsystem.theme.PandaGreen
import com.pandafit.designsystem.theme.PandaOrange
import com.pandafit.feature.calendar.R
import com.pandafit.feature.calendar.viewmodel.CalendarViewModel
import java.time.format.DateTimeFormatter
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CalendarScreen(
    onNavigateToWorkout: (type: String, id: Long, isCompleted: Boolean) -> Unit,
    onNavigateToInstance: (Long) -> Unit,
    onNavigateToInstanceReport: (Long) -> Unit = onNavigateToInstance,
    onNavigateToCreateRunning: () -> Unit = {},
    onNavigateToCreateCycling: () -> Unit = {},
    onOpenDrawer: () -> Unit = {},
    viewModel: CalendarViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    var showAddChooser by remember { mutableStateOf(false) }
    var showSeancePicker by remember { mutableStateOf(false) }
    var showRunningPicker by remember { mutableStateOf(false) }
    var showCyclingPicker by remember { mutableStateOf(false) }
    var rescheduleInstanceId by remember { mutableStateOf<Long?>(null) }
    var rescheduleWorkoutId by remember { mutableStateOf<Long?>(null) }
    var showReschedulePicker by remember { mutableStateOf(false) }
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    // Bottom sheet — choix du type de séance à ajouter
    if (showAddChooser) {
        ModalBottomSheet(onDismissRequest = { showAddChooser = false }, sheetState = sheetState) {
            AddSessionChooserSheet(
                onPickStrength = { showAddChooser = false; showSeancePicker = true },
                onPickRunning = { showAddChooser = false; showRunningPicker = true },
                onPickCycling = { showAddChooser = false; showCyclingPicker = true },
            )
        }
    }

    // Bottom sheet — renforcement
    if (showSeancePicker) {
        ModalBottomSheet(onDismissRequest = { showSeancePicker = false }, sheetState = sheetState) {
            SeancePickerSheet(
                seances = uiState.availableSeances,
                onSelect = { seanceId ->
                    viewModel.createInstanceForDate(seanceId, uiState.selectedDate)
                    showSeancePicker = false
                },
                onDismiss = { showSeancePicker = false },
            )
        }
    }

    // Picker reschedule (instances strength et workouts running/vélo)
    if (showReschedulePicker) {
        AssignSingleDatePickerDialog(
            minDate = java.time.LocalDate.of(2000, 1, 1),
            onDismiss = {
                showReschedulePicker = false
                rescheduleInstanceId = null
                rescheduleWorkoutId = null
            },
            onConfirm = { date ->
                rescheduleInstanceId?.let { viewModel.rescheduleInstance(it, date) }
                rescheduleWorkoutId?.let { viewModel.rescheduleWorkout(it, date) }
                showReschedulePicker = false
                rescheduleInstanceId = null
                rescheduleWorkoutId = null
            },
        )
    }

    // Bottom sheet — running
    if (showRunningPicker) {
        ModalBottomSheet(onDismissRequest = { showRunningPicker = false }, sheetState = sheetState) {
            WorkoutPickerSheet(
                title = stringResource(R.string.calendar_sheet_running_title),
                workouts = uiState.availableRunningWorkouts,
                accentColor = PandaGreen,
                icon = Icons.AutoMirrored.Filled.DirectionsRun,
                onSelect = { templateId ->
                    viewModel.assignWorkoutToDate(templateId, uiState.selectedDate)
                    showRunningPicker = false
                },
                onDismiss = { showRunningPicker = false },
            )
        }
    }

    // Bottom sheet — vélo
    if (showCyclingPicker) {
        ModalBottomSheet(onDismissRequest = { showCyclingPicker = false }, sheetState = sheetState) {
            WorkoutPickerSheet(
                title = stringResource(R.string.calendar_sheet_cycling_title),
                workouts = uiState.availableCyclingWorkouts,
                accentColor = PandaBlue,
                icon = Icons.AutoMirrored.Filled.DirectionsBike,
                onSelect = { templateId ->
                    viewModel.assignWorkoutToDate(templateId, uiState.selectedDate)
                    showCyclingPicker = false
                },
                onDismiss = { showCyclingPicker = false },
            )
        }
    }

    Scaffold(
        topBar = {
            PandaTopBar(
                title = stringResource(R.string.calendar_screen_title),
                onOpenDrawer = onOpenDrawer,
                containerColor = PandaOrange,
                contentColor = Color.White,
            )
        },
        containerColor = MaterialTheme.colorScheme.background,
    ) { innerPadding ->
        if (uiState.error != null) {
            PandaErrorState(description = uiState.error!!, modifier = Modifier.padding(innerPadding))
            return@Scaffold
        }
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(innerPadding),
            contentPadding = PaddingValues(bottom = 88.dp),
        ) {
            // Filtres sport
            item {
                val allSelected = uiState.activeFilters.size == WorkoutType.entries.size
                Row(
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    CalendarSportToggle(
                        icon = Icons.Default.CalendarMonth,
                        color = PandaGreen,
                        selected = allSelected,
                        onClick = viewModel::selectAllFilters,
                    )
                    WorkoutType.entries.forEach { type ->
                        CalendarSportToggle(
                            icon = workoutTypeIcon(type),
                            color = workoutTypeColor(type),
                            selected = type in uiState.activeFilters,
                            onClick = { viewModel.toggleFilter(type) },
                        )
                    }
                }
            }

            // Navigation mois
            item {
                MonthNavigationHeader(
                    currentMonth = uiState.currentMonth,
                    onPrevious = viewModel::previousMonth,
                    onNext = viewModel::nextMonth,
                )
            }

            // Grille calendrier
            item {
                MonthCalendarGrid(
                    currentMonth = uiState.currentMonth,
                    selectedDate = uiState.selectedDate,
                    workoutsByDate = uiState.filteredWorkoutsByDate,
                    instancesByDate = uiState.instancesByDate,
                    breathingSessionsByDate = uiState.breathingSessionsByDate,
                    onSelectDate = viewModel::selectDate,
                )
            }

            // Séances du jour sélectionné
            item {
                Spacer(Modifier.height(16.dp))
                val dateLabel = uiState.selectedDate.format(DateTimeFormatter.ofPattern("EEEE d MMMM", Locale.FRENCH))
                Row(
                    modifier = Modifier.padding(horizontal = 16.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    Icon(Icons.Default.CalendarMonth, null, tint = PandaGreen, modifier = Modifier.size(20.dp))
                    Text(
                        text = dateLabel.replaceFirstChar { it.uppercase() },
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.SemiBold,
                    )
                }
                Spacer(Modifier.height(8.dp))
            }

            val hasContent = uiState.filteredSelectedDayWorkouts.isNotEmpty()
                || uiState.selectedDayInstances.isNotEmpty()
                || uiState.selectedDayBreathingSessions.isNotEmpty()
            if (!hasContent) {
                item {
                    PandaCard(modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp)) {
                        CalendarEmptyDayState(
                            gender = uiState.gender,
                            onAddSession = { showAddChooser = true },
                            modifier = Modifier.fillMaxWidth(),
                        )
                    }
                }
            } else {
                items(uiState.filteredSelectedDayWorkouts, key = { "w_${it.id}" }) { workout ->
                    CalendarWorkoutItem(
                        workout = workout,
                        onClick = { onNavigateToWorkout(workout.workoutType.name.lowercase(), workout.id, workout.isCompleted) },
                        onDelete = { viewModel.deleteWorkout(workout) },
                        onReschedule = if (!workout.isCompleted) {
                            { rescheduleWorkoutId = workout.id; showReschedulePicker = true }
                        } else null,
                        modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp),
                    )
                }
                items(uiState.selectedDayInstances, key = { "i_${it.id}" }) { instance ->
                    val seance = uiState.seancesById[instance.seanceId]
                    CalendarInstanceItem(
                        instance = instance,
                        seance = seance,
                        onClick = { if (instance.isCompleted) onNavigateToInstanceReport(instance.id) else onNavigateToInstance(instance.id) },
                        onDelete = { viewModel.deleteInstance(instance) },
                        onReschedule = if (!instance.isCompleted) {
                            { rescheduleInstanceId = instance.id; showReschedulePicker = true }
                        } else null,
                        modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp),
                    )
                }
                items(uiState.selectedDayBreathingSessions, key = { "b_${it.id}" }) { session ->
                    CalendarBreathingItem(
                        session = session,
                        modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp),
                    )
                }
            }

            // Prochaines séances
            if (uiState.upcomingItems.isNotEmpty()) {
                item {
                    Spacer(Modifier.height(20.dp))
                    Text(
                        stringResource(R.string.calendar_upcoming_title),
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.padding(horizontal = 16.dp),
                    )
                    Spacer(Modifier.height(8.dp))
                }
                items(uiState.upcomingItems, key = { "u_${it::class.simpleName}_${it.date}_${it.hashCode()}" }) { item ->
                    UpcomingItemRow(item = item, modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp))
                }
            }
        }
    }
}
