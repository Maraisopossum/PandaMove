package com.pandafit.feature.cycling.ui

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.border
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.NavigateNext
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.DirectionsBike
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material3.*
import androidx.compose.ui.unit.DpOffset
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.pandafit.core.database.entities.WorkoutEntity
import com.pandafit.designsystem.components.*
import com.pandafit.designsystem.theme.PandaBlue
import com.pandafit.designsystem.theme.PandaSubtext
import com.pandafit.feature.cycling.viewmodel.CyclingListViewModel
import java.time.format.DateTimeFormatter
import java.time.format.TextStyle
import java.util.Locale

private const val MAX_COMPLETED_VISIBLE = 5

@OptIn(ExperimentalMaterial3Api::class, ExperimentalFoundationApi::class)
@Composable
fun CyclingScreen(
    onNavigateToDetail: (Long) -> Unit,
    onNavigateToCreate: () -> Unit,
    onNavigateToCreatePlanned: () -> Unit = {},
    onOpenDrawer: () -> Unit = {},
    viewModel: CyclingListViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val scrollBehavior = TopAppBarDefaults.exitUntilCollapsedScrollBehavior(rememberTopAppBarState())
    val isEmpty = uiState.templates.isEmpty() && uiState.planned.isEmpty() && uiState.completed.isEmpty()

    var selectedIds by remember { mutableStateOf(setOf<Long>()) }
    val isSelectionMode = selectedIds.isNotEmpty()
    var showDeleteDialog by remember { mutableStateOf(false) }
    var showFabMenu by remember { mutableStateOf(false) }
    var showAllCompleted by remember { mutableStateOf(false) }
    var assignTarget by remember { mutableStateOf<WorkoutEntity?>(null) }
    var rescheduleTargetId by remember { mutableStateOf<Long?>(null) }
    var showReschedulePicker by remember { mutableStateOf(false) }
    var showAssignMenu by remember { mutableStateOf(false) }
    var showSingleDatePicker by remember { mutableStateOf(false) }
    var showMultiDateDialog by remember { mutableStateOf(false) }
    var showRecurrenceDialog by remember { mutableStateOf(false) }

    fun clearSelection() { selectedIds = emptySet() }
    fun toggle(id: Long) {
        selectedIds = if (id in selectedIds) selectedIds - id else selectedIds + id
    }

    if (showReschedulePicker) {
        AssignSingleDatePickerDialog(
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
            onDismiss = { showMultiDateDialog = false; assignTarget = null },
            onConfirm = { dates -> assignTarget?.id?.let { viewModel.assignToDates(it, dates) }; showMultiDateDialog = false; assignTarget = null },
        )
    }
    if (showRecurrenceDialog) {
        AssignRecurrenceDialog(
            onDismiss = { showRecurrenceDialog = false; assignTarget = null },
            onConfirm = { start, interval, occ -> assignTarget?.id?.let { viewModel.assignRecurring(it, start, interval, occ) }; showRecurrenceDialog = false; assignTarget = null },
        )
    }

    if (showDeleteDialog) {
        val n = selectedIds.size
        AlertDialog(
            onDismissRequest = { showDeleteDialog = false },
            title = { Text("Supprimer $n séance${if (n > 1) "s" else ""} ?") },
            text = { Text("Cette action est irréversible.", style = MaterialTheme.typography.bodySmall) },
            confirmButton = {
                TextButton(onClick = { viewModel.deleteWorkouts(selectedIds); clearSelection(); showDeleteDialog = false }) {
                    Text("Supprimer", color = MaterialTheme.colorScheme.error, fontWeight = FontWeight.SemiBold)
                }
            },
            dismissButton = { TextButton(onClick = { showDeleteDialog = false }) { Text("Annuler") } },
        )
    }

    Scaffold(
        modifier = Modifier.nestedScroll(scrollBehavior.nestedScrollConnection),
        topBar = {
            if (isSelectionMode) {
                TopAppBar(
                    title = { Text("${selectedIds.size} sélectionné${if (selectedIds.size > 1) "s" else ""}", style = MaterialTheme.typography.titleMedium) },
                    navigationIcon = { IconButton(onClick = ::clearSelection) { Icon(Icons.Default.Close, "Annuler") } },
                    actions = { IconButton(onClick = { showDeleteDialog = true }) { Icon(Icons.Default.Delete, "Supprimer", tint = MaterialTheme.colorScheme.error) } },
                    colors = TopAppBarDefaults.topAppBarColors(containerColor = PandaBlue.copy(alpha = 0.08f)),
                )
            } else {
                PandaTopBar(title = "Vélo", onOpenDrawer = onOpenDrawer, scrollBehavior = scrollBehavior)
            }
        },
        floatingActionButton = {
            if (!isSelectionMode) {
                Box {
                    FloatingActionButton(onClick = { showFabMenu = true }, containerColor = PandaBlue, contentColor = MaterialTheme.colorScheme.onPrimary) {
                        Icon(Icons.Default.Add, "Nouvelle séance")
                    }
                    DropdownMenu(
                        expanded = showFabMenu,
                        onDismissRequest = { showFabMenu = false },
                        offset = DpOffset(0.dp, (-8).dp),
                    ) {
                        DropdownMenuItem(
                            text = { Text("Séance type") },
                            leadingIcon = { Icon(Icons.Default.DirectionsBike, null, tint = PandaBlue, modifier = Modifier.size(18.dp)) },
                            onClick = { showFabMenu = false; onNavigateToCreate() },
                        )
                        DropdownMenuItem(
                            text = { Text("Séance directe") },
                            leadingIcon = { Icon(Icons.Default.PlayArrow, null, tint = PandaBlue, modifier = Modifier.size(18.dp)) },
                            onClick = { showFabMenu = false; onNavigateToCreatePlanned() },
                        )
                    }
                }
            }
        },
        containerColor = MaterialTheme.colorScheme.background,
    ) { innerPadding ->
        when {
            uiState.isLoading -> PandaLoadingIndicator()
            uiState.error != null -> PandaErrorState(description = uiState.error!!, modifier = Modifier.padding(innerPadding))
            isEmpty -> PandaEmptyState(
                title = "Aucune séance de vélo",
                description = "Crée ta première sortie à vélo avec le bouton +",
                icon = Icons.Default.DirectionsBike,
                modifier = Modifier.padding(innerPadding),
            )
            else -> {
                val visibleCompleted = if (showAllCompleted) uiState.completed
                else uiState.completed.take(MAX_COMPLETED_VISIBLE)

                LazyColumn(
                    modifier = Modifier.fillMaxSize().padding(innerPadding),
                    contentPadding = PaddingValues(bottom = 88.dp),
                ) {
                    if (uiState.templates.isNotEmpty()) {
                        item { WorkoutSectionHeader("Séances types") }
                        items(uiState.templates, key = { "t_${it.id}" }) { w ->
                            CyclingWorkoutCard(
                                workout = w,
                                trailingIcon = CyclingTrailingIcon.CHEVRON,
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
                        item { WorkoutSectionHeader("Séances planifiées") }
                        items(uiState.planned, key = { "p_${it.id}" }) { w ->
                            CyclingWorkoutCard(
                                workout = w,
                                trailingIcon = CyclingTrailingIcon.PLAY,
                                isSelected = w.id in selectedIds,
                                isSelectionMode = isSelectionMode,
                                onReschedule = if (!isSelectionMode) {
                                    { rescheduleTargetId = w.id; showReschedulePicker = true }
                                } else null,
                                onClick = { if (isSelectionMode) toggle(w.id) else onNavigateToDetail(w.id) },
                                onLongClick = { toggle(w.id) },
                            )
                        }
                    }
                    if (uiState.completed.isNotEmpty()) {
                        item { WorkoutSectionHeader("Séances terminées") }
                        items(visibleCompleted, key = { "c_${it.id}" }) { w ->
                            CyclingWorkoutCard(
                                workout = w,
                                trailingIcon = CyclingTrailingIcon.CHECK,
                                alpha = 0.75f,
                                isSelected = w.id in selectedIds,
                                isSelectionMode = isSelectionMode,
                                onClick = { if (isSelectionMode) toggle(w.id) else onNavigateToDetail(w.id) },
                                onLongClick = { toggle(w.id) },
                            )
                        }
                        if (uiState.completed.size > MAX_COMPLETED_VISIBLE) {
                            item {
                                TextButton(
                                    onClick = { showAllCompleted = !showAllCompleted },
                                    modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
                                ) {
                                    Text(
                                        if (showAllCompleted) "Réduire"
                                        else "Voir les ${uiState.completed.size - MAX_COMPLETED_VISIBLE} autres",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = PandaSubtext,
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

private enum class CyclingTrailingIcon { PLAY, CHECK, CHEVRON }

@Composable
private fun WorkoutSectionHeader(label: String) {
    Text(
        label,
        style = MaterialTheme.typography.labelSmall,
        color = PandaBlue,
        fontWeight = FontWeight.Bold,
        modifier = Modifier.padding(start = 16.dp, top = 16.dp, bottom = 4.dp, end = 16.dp),
    )
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun CyclingWorkoutCard(
    workout: WorkoutEntity,
    trailingIcon: CyclingTrailingIcon,
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
    val borderColor = if (isSelected) PandaBlue else PandaBlue.copy(alpha = 0f)
    val bgColor = if (isSelected) PandaBlue.copy(alpha = 0.1f) else MaterialTheme.colorScheme.surface

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
                    tint = if (isSelected) PandaBlue else PandaSubtext,
                    modifier = Modifier.size(22.dp),
                )
                Spacer(Modifier.width(10.dp))
            } else {
                SportIconBadge(
                    icon = Icons.Default.DirectionsBike,
                    contentDescription = null,
                    accentColor = PandaBlue,
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
                        Icon(Icons.Default.ContentCopy, "Dupliquer", tint = PandaSubtext, modifier = Modifier.size(16.dp))
                    }
                }
                if (onAssign != null) {
                    IconButton(onClick = onAssign, modifier = Modifier.size(32.dp)) {
                        Icon(Icons.Default.CalendarMonth, "Affecter au calendrier", tint = PandaSubtext, modifier = Modifier.size(16.dp))
                    }
                }
                if (onReschedule != null) {
                    IconButton(onClick = onReschedule, modifier = Modifier.size(32.dp)) {
                        Icon(Icons.Default.CalendarMonth, "Changer la date", tint = PandaSubtext, modifier = Modifier.size(16.dp))
                    }
                }
                when (trailingIcon) {
                    CyclingTrailingIcon.PLAY    -> Icon(Icons.Default.PlayArrow, null, tint = PandaBlue, modifier = Modifier.size(18.dp))
                    CyclingTrailingIcon.CHECK   -> Icon(Icons.Default.CheckCircle, null, tint = PandaBlue, modifier = Modifier.size(18.dp))
                    CyclingTrailingIcon.CHEVRON -> Icon(Icons.AutoMirrored.Filled.NavigateNext, null, tint = PandaSubtext, modifier = Modifier.size(18.dp))
                }
            }
        }
    }
}
