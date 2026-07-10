package com.pandafit.feature.calendar.ui

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.DirectionsBike
import androidx.compose.material.icons.automirrored.filled.DirectionsRun
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Air
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.ChevronLeft
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.FitnessCenter
import androidx.compose.material.icons.filled.Landscape
import androidx.compose.material.icons.filled.DateRange
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.pandafit.core.database.entities.BreathingSessionEntity
import com.pandafit.core.database.entities.InstanceSeanceEntity
import com.pandafit.core.database.entities.SeanceEntity
import com.pandafit.core.database.entities.WorkoutEntity
import com.pandafit.core.database.entities.WorkoutType
import com.pandafit.designsystem.components.AssignSingleDatePickerDialog
import com.pandafit.designsystem.components.PandaCard
import com.pandafit.designsystem.components.PandaErrorState
import com.pandafit.designsystem.components.PandaFilterChip
import com.pandafit.designsystem.components.PandaSportCard
import com.pandafit.designsystem.components.PandaTopBar
import com.pandafit.designsystem.components.SportDot
import com.pandafit.designsystem.components.SportIconBadge
import com.pandafit.designsystem.theme.KalyptusGreen
import com.pandafit.designsystem.theme.PandaAmber
import com.pandafit.designsystem.theme.PandaBlue
import com.pandafit.designsystem.theme.PandaGreen
import com.pandafit.designsystem.theme.PandaOrange
import com.pandafit.designsystem.theme.PandaPurple
import com.pandafit.designsystem.theme.PandaSubtext
import com.pandafit.feature.calendar.R
import com.pandafit.feature.calendar.model.CalendarUiState
import com.pandafit.feature.calendar.model.UpcomingItem
import com.pandafit.feature.calendar.viewmodel.CalendarViewModel
import java.time.LocalDate
import java.time.YearMonth
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

// ===== Bottom sheet — choix du type de séance à ajouter =====

@Composable
private fun AddSessionChooserSheet(
    onPickStrength: () -> Unit,
    onPickRunning: () -> Unit,
    onPickCycling: () -> Unit,
) {
    Column(modifier = Modifier.fillMaxWidth()) {
        Text(
            stringResource(R.string.calendar_add_session_title),
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp),
        )
        HorizontalDivider()
        TextButton(
            onClick = onPickStrength,
            modifier = Modifier.fillMaxWidth(),
            contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
        ) {
            Icon(Icons.Default.FitnessCenter, null, tint = PandaPurple, modifier = Modifier.size(18.dp))
            Spacer(Modifier.width(10.dp))
            Text(stringResource(R.string.calendar_add_strength_option), modifier = Modifier.weight(1f), style = MaterialTheme.typography.bodyMedium)
        }
        HorizontalDivider(modifier = Modifier.padding(horizontal = 16.dp))
        TextButton(
            onClick = onPickRunning,
            modifier = Modifier.fillMaxWidth(),
            contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
        ) {
            Icon(Icons.AutoMirrored.Filled.DirectionsRun, null, tint = PandaGreen, modifier = Modifier.size(18.dp))
            Spacer(Modifier.width(10.dp))
            Text(stringResource(R.string.calendar_add_running_option), modifier = Modifier.weight(1f), style = MaterialTheme.typography.bodyMedium)
        }
        HorizontalDivider(modifier = Modifier.padding(horizontal = 16.dp))
        TextButton(
            onClick = onPickCycling,
            modifier = Modifier.fillMaxWidth(),
            contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
        ) {
            Icon(Icons.AutoMirrored.Filled.DirectionsBike, null, tint = PandaBlue, modifier = Modifier.size(18.dp))
            Spacer(Modifier.width(10.dp))
            Text(stringResource(R.string.calendar_add_cycling_option), modifier = Modifier.weight(1f), style = MaterialTheme.typography.bodyMedium)
        }
        Spacer(Modifier.height(24.dp))
    }
}

// ===== Bottom sheet séances =====

@Composable
private fun SeancePickerSheet(
    seances: List<SeanceEntity>,
    onSelect: (Long) -> Unit,
    onDismiss: () -> Unit,
) {
    Column(modifier = Modifier.fillMaxWidth()) {
        Text(
            stringResource(R.string.calendar_sheet_assign_seance),
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp),
        )
        HorizontalDivider()
        if (seances.isEmpty()) {
            Text(
                stringResource(R.string.calendar_sheet_no_seance),
                style = MaterialTheme.typography.bodySmall,
                color = PandaSubtext,
                modifier = Modifier.padding(16.dp),
            )
        } else {
            LazyColumn {
                items(seances, key = { it.id }) { seance ->
                    TextButton(
                        onClick = { onSelect(seance.id) },
                        modifier = Modifier.fillMaxWidth(),
                        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
                    ) {
                        Icon(Icons.Default.FitnessCenter, null, tint = PandaPurple, modifier = Modifier.size(18.dp))
                        Spacer(Modifier.width(10.dp))
                        Text(seance.nom, modifier = Modifier.weight(1f), style = MaterialTheme.typography.bodyMedium)
                    }
                    HorizontalDivider(modifier = Modifier.padding(horizontal = 16.dp))
                }
                item { Spacer(Modifier.height(32.dp)) }
            }
        }
    }
}

// ===== Bottom sheet workouts (running / vélo) =====

@Composable
private fun WorkoutPickerSheet(
    title: String,
    workouts: List<WorkoutEntity>,
    accentColor: Color,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    onSelect: (Long) -> Unit,
    onDismiss: () -> Unit,
) {
    Column(modifier = Modifier.fillMaxWidth()) {
        Text(
            title,
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp),
        )
        HorizontalDivider()
        if (workouts.isEmpty()) {
            Text(
                stringResource(R.string.calendar_sheet_no_template),
                style = MaterialTheme.typography.bodySmall,
                color = PandaSubtext,
                modifier = Modifier.padding(16.dp),
            )
        } else {
            LazyColumn {
                items(workouts, key = { it.id }) { workout ->
                    TextButton(
                        onClick = { onSelect(workout.id) },
                        modifier = Modifier.fillMaxWidth(),
                        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
                    ) {
                        Icon(icon, null, tint = accentColor, modifier = Modifier.size(18.dp))
                        Spacer(Modifier.width(10.dp))
                        Text(workout.name, modifier = Modifier.weight(1f), style = MaterialTheme.typography.bodyMedium)
                    }
                    HorizontalDivider(modifier = Modifier.padding(horizontal = 16.dp))
                }
                item { Spacer(Modifier.height(32.dp)) }
            }
        }
    }
}

// ===== État vide du jour sélectionné =====

@Composable
private fun CalendarEmptyDayState(gender: String, onAddSession: () -> Unit, modifier: Modifier = Modifier) {
    val mascotRes = if (gender == "FEMALE") {
        R.drawable.panda_calendar_empty_female
    } else {
        R.drawable.panda_calendar_empty_male
    }
    Column(
        modifier = modifier.padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Box(contentAlignment = Alignment.Center) {
            Box(
                modifier = Modifier.size(140.dp).clip(CircleShape).background(PandaGreen.copy(alpha = 0.10f)),
            )
            Image(
                painter = painterResource(mascotRes),
                contentDescription = null,
                modifier = Modifier.size(120.dp),
            )
        }
        Spacer(Modifier.height(12.dp))
        Text(
            stringResource(R.string.calendar_empty_day_title),
            style = MaterialTheme.typography.titleSmall,
            fontWeight = FontWeight.SemiBold,
            textAlign = TextAlign.Center,
        )
        Spacer(Modifier.height(4.dp))
        Text(
            stringResource(R.string.calendar_no_session_day),
            style = MaterialTheme.typography.bodyMedium,
            color = PandaSubtext,
            textAlign = TextAlign.Center,
        )
        Spacer(Modifier.height(16.dp))
        Button(
            onClick = onAddSession,
            colors = ButtonDefaults.buttonColors(containerColor = PandaGreen),
        ) {
            Icon(Icons.Default.Add, null, modifier = Modifier.size(18.dp))
            Spacer(Modifier.width(6.dp))
            Text(stringResource(R.string.calendar_add_session_title))
        }
    }
}

// ===== Toggle filtre sport (pictogramme seul) =====

@Composable
private fun CalendarSportToggle(
    icon: ImageVector,
    color: Color,
    selected: Boolean,
    onClick: () -> Unit,
) {
    Box(
        modifier = Modifier
            .size(44.dp)
            .clip(CircleShape)
            .background(if (selected) color else color.copy(alpha = 0.12f))
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Icon(
            icon,
            null,
            tint = if (selected) Color.White else color,
            modifier = Modifier.size(20.dp),
        )
    }
}

// ===== Section "Prochaines séances" =====

@Composable
private fun UpcomingItemRow(item: UpcomingItem, modifier: Modifier = Modifier) {
    val dateLabel = item.date.format(DateTimeFormatter.ofPattern("EEE d MMM", Locale.FRENCH)).replaceFirstChar { it.uppercase() }
    val (icon, color, title) = when (item) {
        is UpcomingItem.Workout -> Triple(workoutTypeIcon(item.workout.workoutType), workoutTypeColor(item.workout.workoutType), item.workout.name)
        is UpcomingItem.Instance -> Triple(Icons.Default.FitnessCenter, PandaPurple, item.seanceName)
    }
    val statusLabel = stringResource(if (item.isCompleted) R.string.calendar_status_completed else R.string.calendar_status_planned)
    PandaSportCard(accentColor = color, modifier = modifier.fillMaxWidth()) {
        Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            SportIconBadge(icon = icon, contentDescription = null, accentColor = color, size = 40.dp, iconSize = 20.dp)
            Spacer(Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(title, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Medium)
                Spacer(Modifier.height(2.dp))
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    Icon(Icons.Default.CalendarMonth, null, tint = PandaSubtext, modifier = Modifier.size(13.dp))
                    Text(dateLabel, style = MaterialTheme.typography.bodySmall, color = PandaSubtext)
                }
            }
            Text(
                statusLabel,
                style = MaterialTheme.typography.labelSmall,
                color = color,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier
                    .clip(RoundedCornerShape(12.dp))
                    .background(color.copy(alpha = 0.12f))
                    .padding(horizontal = 10.dp, vertical = 4.dp),
            )
        }
    }
}

// ===== Grille calendrier =====

@Composable
private fun MonthNavigationHeader(currentMonth: YearMonth, onPrevious: () -> Unit, onNext: () -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        IconButton(onClick = onPrevious) { Icon(Icons.Default.ChevronLeft, stringResource(R.string.calendar_prev_month_cd)) }
        Text(
            text = currentMonth.format(DateTimeFormatter.ofPattern("MMMM yyyy", Locale.FRENCH)).replaceFirstChar { it.uppercase() },
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.SemiBold,
        )
        IconButton(onClick = onNext) { Icon(Icons.Default.ChevronRight, stringResource(R.string.calendar_next_month_cd)) }
    }
}

@Composable
private fun MonthCalendarGrid(
    currentMonth: YearMonth,
    selectedDate: LocalDate,
    workoutsByDate: Map<LocalDate, List<WorkoutEntity>>,
    instancesByDate: Map<LocalDate, List<InstanceSeanceEntity>>,
    breathingSessionsByDate: Map<LocalDate, List<BreathingSessionEntity>>,
    onSelectDate: (LocalDate) -> Unit,
) {
    val today = LocalDate.now()
    val firstDayOfMonth = currentMonth.atDay(1)
    val daysInMonth = currentMonth.lengthOfMonth()
    val firstDayOfWeek = (firstDayOfMonth.dayOfWeek.value + 6) % 7
    val totalCells = firstDayOfWeek + daysInMonth

    Column(modifier = Modifier.padding(horizontal = 16.dp)) {
        Row(modifier = Modifier.fillMaxWidth()) {
            listOf("L", "M", "M", "J", "V", "S", "D").forEach { day ->
                Text(day, modifier = Modifier.weight(1f), textAlign = TextAlign.Center, style = MaterialTheme.typography.labelSmall, color = PandaSubtext, fontWeight = FontWeight.SemiBold)
            }
        }
        Spacer(Modifier.height(8.dp))
        val weeks = ((totalCells + 6) / 7)
        repeat(weeks) { weekIndex ->
            Row(modifier = Modifier.fillMaxWidth()) {
                repeat(7) { dayOfWeek ->
                    val cellIndex = weekIndex * 7 + dayOfWeek
                    val dayNumber = cellIndex - firstDayOfWeek + 1
                    if (dayNumber < 1 || dayNumber > daysInMonth) {
                        Box(modifier = Modifier.weight(1f).aspectRatio(1f))
                    } else {
                        val date = currentMonth.atDay(dayNumber)
                        CalendarDayCell(
                            day = dayNumber,
                            date = date,
                            isSelected = date == selectedDate,
                            isToday = date == today,
                            workouts = workoutsByDate[date] ?: emptyList(),
                            hasStrengthInstance = (instancesByDate[date]?.isNotEmpty() == true),
                            hasBreathingSession = (breathingSessionsByDate[date]?.isNotEmpty() == true),
                            onClick = { onSelectDate(date) },
                            modifier = Modifier.weight(1f),
                        )
                    }
                }
            }
            Spacer(Modifier.height(4.dp))
        }
    }
}

@Composable
private fun CalendarDayCell(
    day: Int, date: LocalDate, isSelected: Boolean, isToday: Boolean,
    workouts: List<WorkoutEntity>, hasStrengthInstance: Boolean, hasBreathingSession: Boolean = false,
    onClick: () -> Unit, modifier: Modifier = Modifier,
) {
    Box(
        modifier = modifier.aspectRatio(1f).clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Box(
                modifier = Modifier.size(30.dp).clip(CircleShape)
                    .background(when { isSelected -> PandaGreen; isToday -> PandaGreen.copy(alpha = 0.15f); else -> Color.Transparent }),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    day.toString(),
                    style = MaterialTheme.typography.bodySmall,
                    fontWeight = if (isSelected || isToday) FontWeight.Bold else FontWeight.Normal,
                    color = when { isSelected -> Color.White; isToday -> PandaGreen; else -> MaterialTheme.colorScheme.onSurface },
                )
            }
            if (workouts.isNotEmpty() || hasStrengthInstance || hasBreathingSession) {
                Row(horizontalArrangement = Arrangement.spacedBy(2.dp), modifier = Modifier.padding(top = 2.dp)) {
                    workouts.take(2).forEach { SportDot(color = workoutTypeColor(it.workoutType), size = 5.dp) }
                    if (hasStrengthInstance) SportDot(color = PandaPurple, size = 5.dp)
                    if (hasBreathingSession) SportDot(color = KalyptusGreen, size = 5.dp)
                }
            }
        }
    }
}

@Composable
private fun CalendarWorkoutItem(
    workout: WorkoutEntity,
    onClick: () -> Unit,
    onDelete: () -> Unit,
    onReschedule: (() -> Unit)? = null,
    modifier: Modifier = Modifier,
) {
    var showConfirm by remember { mutableStateOf(false) }
    val accentColor = workoutTypeColor(workout.workoutType)
    val icon = when (workout.workoutType) {
        WorkoutType.RUNNING -> Icons.AutoMirrored.Filled.DirectionsRun
        WorkoutType.CYCLING -> Icons.AutoMirrored.Filled.DirectionsBike
        WorkoutType.STRENGTH -> Icons.Default.FitnessCenter
        WorkoutType.HIKING -> Icons.Default.Landscape
    }

    if (showConfirm) {
        AlertDialog(
            onDismissRequest = { showConfirm = false },
            title = { Text(stringResource(R.string.calendar_delete_workout_title)) },
            text = { Text(stringResource(R.string.calendar_delete_workout_text, workout.name)) },
            confirmButton = {
                TextButton(onClick = { showConfirm = false; onDelete() }) {
                    Text(stringResource(R.string.common_confirm_delete), color = MaterialTheme.colorScheme.error)
                }
            },
            dismissButton = {
                TextButton(onClick = { showConfirm = false }) { Text(stringResource(R.string.common_cancel)) }
            },
        )
    }

    PandaSportCard(accentColor = accentColor, onClick = onClick, modifier = modifier.fillMaxWidth()) {
        Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            SportIconBadge(icon = icon, contentDescription = null, accentColor = accentColor, size = 40.dp, iconSize = 20.dp)
            Spacer(Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(workout.name, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Medium)
                if (workout.objective.isNotBlank()) {
                    Text(workout.objective, style = MaterialTheme.typography.bodySmall, color = PandaSubtext)
                }
            }
            if (workout.isCompleted) {
                Icon(Icons.Default.CheckCircle, stringResource(R.string.calendar_completed_cd), tint = accentColor, modifier = Modifier.size(18.dp))
            } else if (onReschedule != null) {
                IconButton(onClick = onReschedule, modifier = Modifier.size(32.dp)) {
                    Icon(Icons.Default.DateRange, stringResource(R.string.calendar_change_date_cd), tint = PandaSubtext, modifier = Modifier.size(16.dp))
                }
            }
            Spacer(Modifier.width(4.dp))
            IconButton(onClick = { showConfirm = true }, modifier = Modifier.size(32.dp)) {
                Icon(Icons.Default.Delete, stringResource(R.string.common_delete_cd), tint = MaterialTheme.colorScheme.error, modifier = Modifier.size(16.dp))
            }
        }
    }
}

@Composable
private fun CalendarInstanceItem(
    instance: InstanceSeanceEntity,
    seance: SeanceEntity?,
    onClick: () -> Unit,
    onDelete: () -> Unit,
    onReschedule: (() -> Unit)? = null,
    modifier: Modifier = Modifier,
) {
    var showConfirm by remember { mutableStateOf(false) }

    if (showConfirm) {
        AlertDialog(
            onDismissRequest = { showConfirm = false },
            title = { Text(stringResource(R.string.calendar_delete_workout_title)) },
            text = { Text(stringResource(R.string.calendar_delete_instance_text, seance?.nom ?: stringResource(R.string.calendar_delete_instance_fallback))) },
            confirmButton = {
                TextButton(onClick = { showConfirm = false; onDelete() }) {
                    Text(stringResource(R.string.common_confirm_delete), color = MaterialTheme.colorScheme.error)
                }
            },
            dismissButton = {
                TextButton(onClick = { showConfirm = false }) { Text(stringResource(R.string.common_cancel)) }
            },
        )
    }

    PandaSportCard(accentColor = PandaPurple, onClick = onClick, modifier = modifier.fillMaxWidth()) {
        Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            SportIconBadge(icon = Icons.Default.FitnessCenter, contentDescription = null, accentColor = PandaPurple, size = 40.dp, iconSize = 20.dp)
            Spacer(Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(seance?.nom ?: stringResource(R.string.calendar_instance_fallback), style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Medium)
                if (seance?.groupesMusculaires?.isNotEmpty() == true) {
                    Text(seance.groupesMusculaires.joinToString(" · "), style = MaterialTheme.typography.bodySmall, color = PandaSubtext)
                }
            }
            if (instance.isCompleted) {
                Icon(Icons.Default.CheckCircle, stringResource(R.string.calendar_completed_cd), tint = PandaPurple, modifier = Modifier.size(18.dp))
            } else {
                if (onReschedule != null) {
                    IconButton(onClick = onReschedule, modifier = Modifier.size(32.dp)) {
                        Icon(Icons.Default.DateRange, stringResource(R.string.calendar_change_date_cd), tint = PandaSubtext, modifier = Modifier.size(16.dp))
                    }
                }
                Icon(Icons.Default.PlayArrow, stringResource(R.string.calendar_start_cd), tint = PandaPurple, modifier = Modifier.size(18.dp))
            }
            Spacer(Modifier.width(4.dp))
            IconButton(onClick = { showConfirm = true }, modifier = Modifier.size(32.dp)) {
                Icon(Icons.Default.Delete, stringResource(R.string.common_delete_cd), tint = MaterialTheme.colorScheme.error, modifier = Modifier.size(16.dp))
            }
        }
    }
}

@Composable
private fun CalendarBreathingItem(
    session: BreathingSessionEntity,
    modifier: Modifier = Modifier,
) {
    val durationMin = session.durationSeconds / 60
    val durationSec = session.durationSeconds % 60
    val durationLabel = if (durationMin > 0) "${durationMin}min${if (durationSec > 0) " ${durationSec}s" else ""}" else "${durationSec}s"

    PandaSportCard(accentColor = KalyptusGreen, modifier = modifier.fillMaxWidth()) {
        Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            SportIconBadge(icon = Icons.Default.Air, contentDescription = null, accentColor = KalyptusGreen, size = 40.dp, iconSize = 20.dp)
            Spacer(Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(session.methodName, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Medium)
                Text("$durationLabel · ${session.cyclesCompleted} cycle${if (session.cyclesCompleted > 1) "s" else ""}", style = MaterialTheme.typography.bodySmall, color = PandaSubtext)
            }
            Icon(Icons.Default.CheckCircle, stringResource(R.string.calendar_completed_cd), tint = KalyptusGreen, modifier = Modifier.size(18.dp))
        }
    }
}

private fun workoutTypeColor(type: WorkoutType) = when (type) {
    WorkoutType.RUNNING -> PandaGreen; WorkoutType.CYCLING -> PandaBlue; WorkoutType.STRENGTH -> PandaPurple; WorkoutType.HIKING -> PandaAmber
}
private fun workoutTypeIcon(type: WorkoutType) = when (type) {
    WorkoutType.RUNNING -> Icons.AutoMirrored.Filled.DirectionsRun
    WorkoutType.CYCLING -> Icons.AutoMirrored.Filled.DirectionsBike
    WorkoutType.STRENGTH -> Icons.Default.FitnessCenter
    WorkoutType.HIKING -> Icons.Default.Landscape
}
