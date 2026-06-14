package com.pandafit.feature.calendar.ui

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
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.DirectionsBike
import androidx.compose.material.icons.automirrored.filled.DirectionsRun
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.ChevronLeft
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.FitnessCenter
import androidx.compose.material.icons.filled.DateRange
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FloatingActionButton
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.pandafit.core.database.entities.InstanceSeanceEntity
import com.pandafit.core.database.entities.SeanceEntity
import com.pandafit.core.database.entities.WorkoutEntity
import com.pandafit.core.database.entities.WorkoutType
import com.pandafit.designsystem.components.AssignSingleDatePickerDialog
import com.pandafit.designsystem.components.PandaCard
import com.pandafit.designsystem.components.PandaErrorState
import com.pandafit.designsystem.components.PandaFilterChip
import com.pandafit.designsystem.components.PandaTopBar
import com.pandafit.designsystem.components.SportDot
import com.pandafit.designsystem.components.SportIconBadge
import com.pandafit.designsystem.theme.PandaBlue
import com.pandafit.designsystem.theme.PandaGreen
import com.pandafit.designsystem.theme.PandaOrange
import com.pandafit.designsystem.theme.PandaPurple
import com.pandafit.designsystem.theme.PandaSubtext
import com.pandafit.feature.calendar.model.CalendarUiState
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
    var showFabMenu by remember { mutableStateOf(false) }
    var showSeancePicker by remember { mutableStateOf(false) }
    var showRunningPicker by remember { mutableStateOf(false) }
    var showCyclingPicker by remember { mutableStateOf(false) }
    var rescheduleInstanceId by remember { mutableStateOf<Long?>(null) }
    var rescheduleWorkoutId by remember { mutableStateOf<Long?>(null) }
    var showReschedulePicker by remember { mutableStateOf(false) }
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

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
                title = "Affecter une séance running",
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
                title = "Affecter une séance vélo",
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
        topBar = { PandaTopBar(title = "Calendrier", onOpenDrawer = onOpenDrawer) },
        // TODO: réactiver le FAB quand le flux d'affectation depuis le calendrier sera finalisé
//        floatingActionButton = {
//            Box {
//                FloatingActionButton(
//                    onClick = { showFabMenu = true },
//                    containerColor = PandaPurple,
//                ) {
//                    Icon(Icons.Default.Add, "Ajouter", tint = Color.White)
//                }
//                DropdownMenu(expanded = showFabMenu, onDismissRequest = { showFabMenu = false }) {
//                    DropdownMenuItem(
//                        text = { Text("Renforcement") },
//                        leadingIcon = { Icon(Icons.Default.FitnessCenter, null, tint = PandaPurple, modifier = Modifier.size(18.dp)) },
//                        onClick = { showFabMenu = false; showSeancePicker = true },
//                    )
//                    DropdownMenuItem(
//                        text = { Text("Course à pieds") },
//                        leadingIcon = { Icon(Icons.AutoMirrored.Filled.DirectionsRun, null, tint = PandaGreen, modifier = Modifier.size(18.dp)) },
//                        onClick = { showFabMenu = false; showRunningPicker = true },
//                    )
//                    DropdownMenuItem(
//                        text = { Text("Vélo") },
//                        leadingIcon = { Icon(Icons.AutoMirrored.Filled.DirectionsBike, null, tint = PandaBlue, modifier = Modifier.size(18.dp)) },
//                        onClick = { showFabMenu = false; showCyclingPicker = true },
//                    )
//                }
//            }
//        },
        containerColor = MaterialTheme.colorScheme.background,
    ) { innerPadding ->
        if (uiState.error != null) {
            PandaErrorState(description = uiState.error!!, modifier = Modifier.padding(innerPadding))
            return@Scaffold
        }
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(innerPadding),
            contentPadding = PaddingValues(bottom = 80.dp),
        ) {
            // Filtres sport
            item {
                Row(
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    WorkoutType.entries.forEach { type ->
                        PandaFilterChip(
                            label = workoutTypeLabel(type),
                            selected = type in uiState.activeFilters,
                            onSelectedChange = { viewModel.toggleFilter(type) },
                            selectedColor = workoutTypeColor(type),
                            leadingIcon = workoutTypeIcon(type),
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
                    onSelectDate = viewModel::selectDate,
                )
            }

            // Séances du jour sélectionné
            item {
                Spacer(Modifier.height(16.dp))
                val dateLabel = uiState.selectedDate.format(DateTimeFormatter.ofPattern("EEEE d MMMM", Locale.FRENCH))
                Text(
                    text = dateLabel.replaceFirstChar { it.uppercase() },
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.padding(horizontal = 16.dp),
                )
                Spacer(Modifier.height(8.dp))
            }

            val hasContent = uiState.filteredSelectedDayWorkouts.isNotEmpty() || uiState.selectedDayInstances.isNotEmpty()
            if (!hasContent) {
                item {
                    Text(
                        "Aucune séance ce jour.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = PandaSubtext,
                        modifier = Modifier.padding(horizontal = 16.dp),
                    )
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
            }
        }
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
            "Affecter une séance",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp),
        )
        HorizontalDivider()
        if (seances.isEmpty()) {
            Text(
                "Aucune séance type disponible. Créez-en une depuis l'onglet Renforcement.",
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
                "Aucun template disponible. Créez-en un depuis l'onglet correspondant.",
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

// ===== Grille calendrier =====

@Composable
private fun MonthNavigationHeader(currentMonth: YearMonth, onPrevious: () -> Unit, onNext: () -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        IconButton(onClick = onPrevious) { Icon(Icons.Default.ChevronLeft, "Mois précédent") }
        Text(
            text = currentMonth.format(DateTimeFormatter.ofPattern("MMMM yyyy", Locale.FRENCH)).replaceFirstChar { it.uppercase() },
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.SemiBold,
        )
        IconButton(onClick = onNext) { Icon(Icons.Default.ChevronRight, "Mois suivant") }
    }
}

@Composable
private fun MonthCalendarGrid(
    currentMonth: YearMonth,
    selectedDate: LocalDate,
    workoutsByDate: Map<LocalDate, List<WorkoutEntity>>,
    instancesByDate: Map<LocalDate, List<InstanceSeanceEntity>>,
    onSelectDate: (LocalDate) -> Unit,
) {
    val today = LocalDate.now()
    val firstDayOfMonth = currentMonth.atDay(1)
    val daysInMonth = currentMonth.lengthOfMonth()
    val firstDayOfWeek = firstDayOfMonth.dayOfWeek.value % 7
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
    workouts: List<WorkoutEntity>, hasStrengthInstance: Boolean,
    onClick: () -> Unit, modifier: Modifier = Modifier,
) {
    Box(
        modifier = modifier.aspectRatio(1f).clip(CircleShape)
            .background(when { isSelected -> PandaGreen; isToday -> PandaGreen.copy(alpha = 0.15f); else -> Color.Transparent })
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                day.toString(),
                style = MaterialTheme.typography.bodySmall,
                fontWeight = if (isSelected || isToday) FontWeight.Bold else FontWeight.Normal,
                color = when { isSelected -> Color.White; isToday -> PandaGreen; else -> MaterialTheme.colorScheme.onSurface },
            )
            if (workouts.isNotEmpty() || hasStrengthInstance) {
                Row(horizontalArrangement = Arrangement.spacedBy(2.dp), modifier = Modifier.padding(top = 2.dp)) {
                    workouts.take(2).forEach { SportDot(color = workoutTypeColor(it.workoutType), size = 5.dp) }
                    if (hasStrengthInstance) SportDot(color = PandaPurple, size = 5.dp)
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
    }

    if (showConfirm) {
        AlertDialog(
            onDismissRequest = { showConfirm = false },
            title = { Text("Supprimer la séance") },
            text = { Text("Supprimer « ${workout.name} » ? Cette action est irréversible.") },
            confirmButton = {
                TextButton(onClick = { showConfirm = false; onDelete() }) {
                    Text("Supprimer", color = MaterialTheme.colorScheme.error)
                }
            },
            dismissButton = {
                TextButton(onClick = { showConfirm = false }) { Text("Annuler") }
            },
        )
    }

    PandaCard(onClick = onClick, modifier = modifier.fillMaxWidth()) {
        Row(modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
            SportIconBadge(icon = icon, contentDescription = null, accentColor = accentColor, size = 40.dp, iconSize = 20.dp)
            Spacer(Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(workout.name, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Medium)
                if (workout.objective.isNotBlank()) {
                    Text(workout.objective, style = MaterialTheme.typography.bodySmall, color = PandaSubtext)
                }
            }
            if (workout.isCompleted) {
                Icon(Icons.Default.CheckCircle, "Complétée", tint = accentColor, modifier = Modifier.size(18.dp))
            } else if (onReschedule != null) {
                IconButton(onClick = onReschedule, modifier = Modifier.size(32.dp)) {
                    Icon(Icons.Default.DateRange, "Changer la date", tint = PandaSubtext, modifier = Modifier.size(16.dp))
                }
            }
            Spacer(Modifier.width(4.dp))
            IconButton(onClick = { showConfirm = true }, modifier = Modifier.size(32.dp)) {
                Icon(Icons.Default.Delete, "Supprimer", tint = MaterialTheme.colorScheme.error, modifier = Modifier.size(16.dp))
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
            title = { Text("Supprimer la séance") },
            text = { Text("Supprimer « ${seance?.nom ?: "cette séance"} » ? Cette action est irréversible.") },
            confirmButton = {
                TextButton(onClick = { showConfirm = false; onDelete() }) {
                    Text("Supprimer", color = MaterialTheme.colorScheme.error)
                }
            },
            dismissButton = {
                TextButton(onClick = { showConfirm = false }) { Text("Annuler") }
            },
        )
    }

    PandaCard(onClick = onClick, modifier = modifier.fillMaxWidth()) {
        Row(modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
            SportIconBadge(icon = Icons.Default.FitnessCenter, contentDescription = null, accentColor = PandaPurple, size = 40.dp, iconSize = 20.dp)
            Spacer(Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(seance?.nom ?: "Séance", style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Medium)
                if (seance?.groupesMusculaires?.isNotEmpty() == true) {
                    Text(seance.groupesMusculaires.joinToString(" · "), style = MaterialTheme.typography.bodySmall, color = PandaSubtext)
                }
            }
            if (instance.isCompleted) {
                Icon(Icons.Default.CheckCircle, "Complétée", tint = PandaPurple, modifier = Modifier.size(18.dp))
            } else {
                if (onReschedule != null) {
                    IconButton(onClick = onReschedule, modifier = Modifier.size(32.dp)) {
                        Icon(Icons.Default.DateRange, "Changer la date", tint = PandaSubtext, modifier = Modifier.size(16.dp))
                    }
                }
                Icon(Icons.Default.PlayArrow, "Démarrer", tint = PandaPurple, modifier = Modifier.size(18.dp))
            }
            Spacer(Modifier.width(4.dp))
            IconButton(onClick = { showConfirm = true }, modifier = Modifier.size(32.dp)) {
                Icon(Icons.Default.Delete, "Supprimer", tint = MaterialTheme.colorScheme.error, modifier = Modifier.size(16.dp))
            }
        }
    }
}

private fun workoutTypeLabel(type: WorkoutType) = when (type) {
    WorkoutType.RUNNING -> "Running"; WorkoutType.CYCLING -> "Vélo"; WorkoutType.STRENGTH -> "Renfort"
}
private fun workoutTypeColor(type: WorkoutType) = when (type) {
    WorkoutType.RUNNING -> PandaGreen; WorkoutType.CYCLING -> PandaBlue; WorkoutType.STRENGTH -> PandaPurple
}
private fun workoutTypeIcon(type: WorkoutType) = when (type) {
    WorkoutType.RUNNING -> Icons.AutoMirrored.Filled.DirectionsRun
    WorkoutType.CYCLING -> Icons.AutoMirrored.Filled.DirectionsBike
    WorkoutType.STRENGTH -> Icons.Default.FitnessCenter
}
