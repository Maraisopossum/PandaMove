package com.pandafit.feature.running.ui

import androidx.compose.animation.AnimatedContent
import androidx.compose.foundation.border
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.NavigateNext
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.ui.unit.DpOffset
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.DirectionsRun
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.res.stringResource
import com.pandafit.feature.running.R
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.pandafit.core.database.entities.WorkoutEntity
import com.pandafit.designsystem.components.AssignMenuDialog
import com.pandafit.designsystem.components.AssignMultiDatePickerDialog
import com.pandafit.designsystem.components.AssignRecurrenceDialog
import com.pandafit.designsystem.components.AssignSingleDatePickerDialog
import com.pandafit.designsystem.components.PandaEmptyState
import com.pandafit.designsystem.components.PandaErrorState
import com.pandafit.designsystem.components.PandaLoadingIndicator
import com.pandafit.designsystem.components.PandaTopBar
import com.pandafit.designsystem.components.SportIconBadge
import com.pandafit.designsystem.theme.PandaGreen
import com.pandafit.designsystem.theme.PandaSubtext
import com.pandafit.feature.running.viewmodel.RunningListViewModel
import java.time.format.DateTimeFormatter
import java.time.format.TextStyle
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RunningScreen(
    onNavigateToDetail: (Long) -> Unit,
    onNavigateToExecute: (Long) -> Unit,
    onNavigateToCreate: () -> Unit,
    onOpenDrawer: () -> Unit = {},
    viewModel: RunningListViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

    // "Séance directe" : la séance libre est créée en base puis on bascule directement sur l'exécution GPS.
    LaunchedEffect(uiState.quickStartWorkoutId) {
        uiState.quickStartWorkoutId?.let { id ->
            onNavigateToExecute(id)
            viewModel.onQuickStartHandled()
        }
    }
    val isEmpty = uiState.templates.isEmpty() && uiState.planned.isEmpty() && uiState.completed.isEmpty()

    var selectedIds by remember { mutableStateOf(setOf<Long>()) }
    val isSelectionMode = selectedIds.isNotEmpty()
    var showDeleteDialog by remember { mutableStateOf(false) }
    var showFabMenu by remember { mutableStateOf(false) }
    var assignTarget by remember { mutableStateOf<WorkoutEntity?>(null) }
    var rescheduleTargetId by remember { mutableStateOf<Long?>(null) }
    var showReschedulePicker by remember { mutableStateOf(false) }
    var showAssignMenu by remember { mutableStateOf(false) }
    var showSingleDatePicker by remember { mutableStateOf(false) }
    var showMultiDateDialog by remember { mutableStateOf(false) }
    var showRecurrenceDialog by remember { mutableStateOf(false) }

    if (showReschedulePicker) {
        AssignSingleDatePickerDialog(
            title = stringResource(R.string.running_reschedule_title),
            confirmLabel = stringResource(R.string.common_validate),
            minDate = java.time.LocalDate.of(2000, 1, 1),
            onDismiss = { showReschedulePicker = false; rescheduleTargetId = null },
            onConfirm = { date ->
                rescheduleTargetId?.let { id -> viewModel.rescheduleWorkout(id, date) }
                showReschedulePicker = false
                rescheduleTargetId = null
            },
        )
    }

    if (showAssignMenu) {
        AssignMenuDialog(
            onDismiss = { showAssignMenu = false },
            onSingleDate = { showSingleDatePicker = true },
            onMultipleDates = { showMultiDateDialog = true },
            onRecurrence = { showRecurrenceDialog = true },
        )
    }

    if (showSingleDatePicker) {
        AssignSingleDatePickerDialog(
            minDate = java.time.LocalDate.of(2000, 1, 1),
            onDismiss = { showSingleDatePicker = false; assignTarget = null },
            onConfirm = { date ->
                assignTarget?.id?.let { id -> viewModel.assignToDate(id, date) }
                showSingleDatePicker = false
                assignTarget = null
            },
        )
    }

    if (showMultiDateDialog) {
        AssignMultiDatePickerDialog(
            minDate = java.time.LocalDate.of(2000, 1, 1),
            onDismiss = { showMultiDateDialog = false; assignTarget = null },
            onConfirm = { dates ->
                assignTarget?.id?.let { id -> viewModel.assignToDates(id, dates) }
                showMultiDateDialog = false
                assignTarget = null
            },
        )
    }

    if (showRecurrenceDialog) {
        AssignRecurrenceDialog(
            onDismiss = { showRecurrenceDialog = false; assignTarget = null },
            onConfirm = { start, intervalDays, occurrences ->
                assignTarget?.id?.let { id -> viewModel.assignRecurring(id, start, intervalDays, occurrences) }
                showRecurrenceDialog = false
                assignTarget = null
            },
        )
    }

    fun clearSelection() { selectedIds = emptySet() }
    fun toggle(id: Long) {
        selectedIds = if (id in selectedIds) selectedIds - id else selectedIds + id
    }

    if (showDeleteDialog) {
        val n = selectedIds.size
        AlertDialog(
            onDismissRequest = { showDeleteDialog = false },
            title = { Text(stringResource(R.string.running_screen_delete_dialog_title, n)) },
            text = {
                Text(
                    stringResource(R.string.running_screen_delete_dialog_body),
                    style = MaterialTheme.typography.bodySmall,
                )
            },
            confirmButton = {
                TextButton(onClick = {
                    viewModel.deleteWorkouts(selectedIds)
                    clearSelection()
                    showDeleteDialog = false
                }) {
                    Text(stringResource(R.string.common_confirm_delete), color = MaterialTheme.colorScheme.error, fontWeight = FontWeight.SemiBold)
                }
            },
            dismissButton = {
                TextButton(onClick = { showDeleteDialog = false }) { Text(stringResource(R.string.common_cancel)) }
            },
        )
    }

    Scaffold(
        topBar = {
            if (isSelectionMode) {
                TopAppBar(
                    title = {
                        Text(
                            stringResource(R.string.running_screen_selection_count, selectedIds.size),
                            style = MaterialTheme.typography.titleMedium,
                        )
                    },
                    navigationIcon = {
                        IconButton(onClick = ::clearSelection) {
                            Icon(Icons.Default.Close, stringResource(R.string.running_screen_cancel_selection_cd))
                        }
                    },
                    actions = {
                        IconButton(onClick = { showDeleteDialog = true }) {
                            Icon(Icons.Default.Delete, stringResource(R.string.running_screen_delete_selection_cd), tint = MaterialTheme.colorScheme.error)
                        }
                    },
                    colors = TopAppBarDefaults.topAppBarColors(containerColor = PandaGreen.copy(alpha = 0.08f)),
                )
            } else {
                PandaTopBar(
                    title = stringResource(R.string.running_screen_title),
                    onOpenDrawer = onOpenDrawer,
                    containerColor = PandaGreen,
                    contentColor = Color.White,
                )
            }
        },
        floatingActionButton = {
            if (!isSelectionMode) {
                Box {
                    FloatingActionButton(onClick = { showFabMenu = true }, containerColor = PandaGreen, contentColor = MaterialTheme.colorScheme.onPrimary) {
                        Icon(Icons.Default.Add, stringResource(R.string.running_screen_fab_new_seance_cd))
                    }
                    DropdownMenu(
                        expanded = showFabMenu,
                        onDismissRequest = { showFabMenu = false },
                        offset = DpOffset(0.dp, (-8).dp),
                    ) {
                        DropdownMenuItem(
                            text = { Text(stringResource(R.string.running_screen_fab_seance_type)) },
                            leadingIcon = { Icon(Icons.Default.DirectionsRun, null, tint = PandaGreen, modifier = Modifier.size(18.dp)) },
                            onClick = { showFabMenu = false; onNavigateToCreate() },
                        )
                        DropdownMenuItem(
                            text = { Text(stringResource(R.string.running_screen_fab_seance_directe)) },
                            leadingIcon = { Icon(Icons.Default.PlayArrow, null, tint = PandaGreen, modifier = Modifier.size(18.dp)) },
                            onClick = { showFabMenu = false; viewModel.quickStartFreeRun() },
                        )
                    }
                }
            }
        },
        containerColor = MaterialTheme.colorScheme.background,
    ) { innerPadding ->
        AnimatedContent(uiState.isLoading, label = "running_content") { isLoading ->
            if (isLoading) {
                PandaLoadingIndicator()
            } else if (uiState.error != null) {
                PandaErrorState(description = uiState.error!!, modifier = Modifier.padding(innerPadding))
            } else if (isEmpty) {
                PandaEmptyState(
                    title = stringResource(R.string.running_screen_empty_title),
                    description = stringResource(R.string.running_screen_empty_description),
                    icon = Icons.Default.DirectionsRun,
                    modifier = Modifier.padding(innerPadding),
                )
            } else {
                LazyColumn(
                    modifier = Modifier.fillMaxSize().padding(innerPadding),
                    contentPadding = PaddingValues(bottom = 88.dp),
                ) {
                    if (uiState.templates.isNotEmpty()) {
                        item { RunSectionHeader(stringResource(R.string.running_screen_section_templates)) }
                        items(uiState.templates, key = { "t_${it.id}" }) { w ->
                            RunWorkoutCard(
                                workout = w,
                                trailingIcon = TrailingIcon.CHEVRON,
                                isTemplate = true,
                                isSelected = w.id in selectedIds,
                                isSelectionMode = isSelectionMode,
                                onDuplicate = if (!isSelectionMode) { { viewModel.duplicateWorkout(w.id) } } else null,
                                onAssign = if (!isSelectionMode) { { assignTarget = w; showAssignMenu = true } } else null,
                                onClick = { if (isSelectionMode) toggle(w.id) else onNavigateToDetail(w.id) },
                                onLongClick = { toggle(w.id) },
                            )
                        }
                    }
                    if (uiState.planned.isNotEmpty()) {
                        item { RunSectionHeader(stringResource(R.string.running_screen_section_planned)) }
                        items(uiState.planned, key = { "p_${it.id}" }) { w ->
                            RunWorkoutCard(
                                workout = w,
                                trailingIcon = TrailingIcon.PLAY,
                                isSelected = w.id in selectedIds,
                                isSelectionMode = isSelectionMode,
                                onReschedule = if (!isSelectionMode) {
                                    { rescheduleTargetId = w.id; showReschedulePicker = true }
                                } else null,
                                onClick = { if (isSelectionMode) toggle(w.id) else onNavigateToExecute(w.id) },
                                onLongClick = { toggle(w.id) },
                            )
                        }
                    }
                    if (uiState.completed.isNotEmpty()) {
                        item { RunSectionHeader(stringResource(R.string.running_screen_section_completed)) }
                        items(uiState.completed, key = { "c_${it.id}" }) { w ->
                            RunWorkoutCard(
                                workout = w,
                                trailingIcon = TrailingIcon.CHECK,
                                alpha = 0.75f,
                                isSelected = w.id in selectedIds,
                                isSelectionMode = isSelectionMode,
                                onClick = { if (isSelectionMode) toggle(w.id) else onNavigateToDetail(w.id) },
                                onLongClick = { toggle(w.id) },
                            )
                        }
                    }
                }
            }
        }
    }
}

private enum class TrailingIcon { PLAY, CHECK, CHEVRON }

@Composable
private fun RunSectionHeader(label: String) {
    Text(
        label,
        style = MaterialTheme.typography.labelSmall,
        color = PandaGreen,
        fontWeight = FontWeight.Bold,
        modifier = Modifier.padding(start = 16.dp, top = 16.dp, bottom = 4.dp, end = 16.dp),
    )
}

@Composable
private fun RunWorkoutCard(
    workout: WorkoutEntity,
    trailingIcon: TrailingIcon,
    alpha: Float = 1f,
    isTemplate: Boolean = false,
    isSelected: Boolean = false,
    isSelectionMode: Boolean = false,
    onDuplicate: (() -> Unit)? = null,
    onAssign: (() -> Unit)? = null,
    onReschedule: (() -> Unit)? = null,
    onClick: () -> Unit,
    onLongClick: () -> Unit = {},
) {
    val borderColor = if (isSelected) PandaGreen else PandaGreen.copy(alpha = 0f)
    val bgColor = if (isSelected) PandaGreen.copy(alpha = 0.1f) else MaterialTheme.colorScheme.surface

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 4.dp)
            .alpha(alpha)
            .border(if (isSelected) 2.dp else 0.dp, borderColor, MaterialTheme.shapes.medium)
            .combinedClickable(onClick = onClick, onLongClick = onLongClick),
        colors = CardDefaults.cardColors(containerColor = bgColor),
        shape = MaterialTheme.shapes.medium,
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            if (isSelectionMode) {
                Icon(
                    if (isSelected) Icons.Default.CheckCircle else Icons.Outlined.CheckCircle,
                    contentDescription = null,
                    tint = if (isSelected) PandaGreen else PandaSubtext,
                    modifier = Modifier.size(22.dp),
                )
                Spacer(Modifier.width(10.dp))
            } else {
                SportIconBadge(
                    icon = Icons.Default.DirectionsRun,
                    contentDescription = null,
                    accentColor = PandaGreen,
                    size = 40.dp,
                    iconSize = 20.dp,
                )
                Spacer(Modifier.width(12.dp))
            }
            Column(modifier = Modifier.weight(1f)) {
                Text(workout.name, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                if (!isTemplate) {
                    val detail = buildString {
                        val day = workout.scheduledDate.dayOfWeek.getDisplayName(TextStyle.FULL, Locale.FRENCH)
                        append("$day ${workout.scheduledDate.format(DateTimeFormatter.ofPattern("d MMMM", Locale.FRENCH))}")
                        if (workout.objective.isNotBlank()) append(" — ${workout.objective}")
                    }
                    Text(detail, style = MaterialTheme.typography.bodySmall, color = PandaSubtext)
                    if (workout.notes.isNotBlank()) {
                        Text(workout.notes, style = MaterialTheme.typography.bodySmall, color = PandaSubtext)
                    }
                }
            }
            if (!isSelectionMode) {
                if (onDuplicate != null) {
                    IconButton(onClick = onDuplicate, modifier = Modifier.size(32.dp)) {
                        Icon(Icons.Default.ContentCopy, stringResource(R.string.running_screen_card_duplicate_cd), tint = PandaSubtext, modifier = Modifier.size(16.dp))
                    }
                }
                if (onAssign != null) {
                    IconButton(onClick = onAssign, modifier = Modifier.size(32.dp)) {
                        Icon(Icons.Default.CalendarMonth, stringResource(R.string.running_screen_card_assign_cd), tint = PandaSubtext, modifier = Modifier.size(16.dp))
                    }
                }
                if (onReschedule != null) {
                    IconButton(onClick = onReschedule, modifier = Modifier.size(32.dp)) {
                        Icon(Icons.Default.CalendarMonth, stringResource(R.string.running_screen_card_reschedule_cd), tint = PandaSubtext, modifier = Modifier.size(16.dp))
                    }
                }
                when (trailingIcon) {
                    TrailingIcon.PLAY    -> Icon(Icons.Default.PlayArrow, null, tint = PandaGreen, modifier = Modifier.size(18.dp))
                    TrailingIcon.CHECK   -> Icon(Icons.Default.CheckCircle, null, tint = PandaGreen, modifier = Modifier.size(18.dp))
                    TrailingIcon.CHEVRON -> Icon(Icons.AutoMirrored.Filled.NavigateNext, null, tint = PandaSubtext, modifier = Modifier.size(18.dp))
                }
            }
        }
    }
}
