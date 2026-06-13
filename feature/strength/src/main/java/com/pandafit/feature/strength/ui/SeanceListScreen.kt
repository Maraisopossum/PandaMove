package com.pandafit.feature.strength.ui

import androidx.compose.foundation.border
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.NavigateNext
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.ExpandLess
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material.icons.filled.FitnessCenter
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.rememberTopAppBarState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.compose.ui.unit.DpOffset
import com.pandafit.core.database.entities.InstanceSeanceEntity
import com.pandafit.core.database.entities.SeanceEntity
import com.pandafit.designsystem.components.AssignMenuDialog
import com.pandafit.designsystem.components.AssignMultiDatePickerDialog
import com.pandafit.designsystem.components.AssignRecurrenceDialog
import com.pandafit.designsystem.components.AssignSingleDatePickerDialog
import com.pandafit.designsystem.components.AppButton
import com.pandafit.designsystem.components.PandaEmptyState
import com.pandafit.designsystem.components.PandaErrorState
import com.pandafit.designsystem.components.PandaLoadingIndicator
import com.pandafit.designsystem.components.PandaTopBar
import com.pandafit.designsystem.components.SportIconBadge
import com.pandafit.designsystem.theme.PandaPurple
import com.pandafit.designsystem.theme.PandaSubtext
import com.pandafit.feature.strength.viewmodel.SeanceListViewModel
import java.time.format.DateTimeFormatter
import java.time.format.TextStyle
import java.util.Locale

private const val MAX_COMPLETED_VISIBLE = 5

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SeanceListScreen(
    onNavigateToDetail: (Long) -> Unit,
    onNavigateToCreate: () -> Unit,
    onNavigateToInstance: (Long) -> Unit,
    onNavigateToInstanceReport: (Long) -> Unit = {},
    onOpenDrawer: () -> Unit = {},
    viewModel: SeanceListViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val scrollBehavior = TopAppBarDefaults.exitUntilCollapsedScrollBehavior(rememberTopAppBarState())

    // Navigation après création one-shot
    LaunchedEffect(Unit) {
        viewModel.navigateToInstance.collect { instanceId ->
            onNavigateToInstance(instanceId)
        }
    }

    var selectedSeanceIds by remember { mutableStateOf(setOf<Long>()) }
    var selectedInstanceIds by remember { mutableStateOf(setOf<Long>()) }
    val isSelectionMode = selectedSeanceIds.isNotEmpty() || selectedInstanceIds.isNotEmpty()
    val totalSelected = selectedSeanceIds.size + selectedInstanceIds.size
    var showDeleteDialog by remember { mutableStateOf(false) }
    var showAllCompleted by remember { mutableStateOf(false) }
    var showFabMenu by remember { mutableStateOf(false) }
    var showOneShotDialog by remember { mutableStateOf(false) }
    var oneShotNom by remember { mutableStateOf("") }
    var oneShotDate by remember { mutableStateOf(java.time.LocalDate.now()) }
    var rescheduleTargetId by remember { mutableStateOf<Long?>(null) }
    var showReschedulePicker by remember { mutableStateOf(false) }
    var assignTargetId by remember { mutableStateOf<Long?>(null) }
    var showAssignMenu by remember { mutableStateOf(false) }
    var showSingleDatePicker by remember { mutableStateOf(false) }
    var showMultiDateDialog by remember { mutableStateOf(false) }
    var showRecurrenceDialog by remember { mutableStateOf(false) }

    fun clearSelection() {
        selectedSeanceIds = emptySet()
        selectedInstanceIds = emptySet()
    }

    fun toggleSeance(id: Long) {
        selectedSeanceIds = if (id in selectedSeanceIds) selectedSeanceIds - id else selectedSeanceIds + id
        if (selectedSeanceIds.isEmpty() && selectedInstanceIds.isEmpty()) clearSelection()
    }

    fun toggleInstance(id: Long) {
        selectedInstanceIds = if (id in selectedInstanceIds) selectedInstanceIds - id else selectedInstanceIds + id
        if (selectedSeanceIds.isEmpty() && selectedInstanceIds.isEmpty()) clearSelection()
    }

    fun deleteSelected() {
        if (selectedSeanceIds.isNotEmpty()) viewModel.deleteSeances(selectedSeanceIds)
        if (selectedInstanceIds.isNotEmpty()) viewModel.deleteInstances(selectedInstanceIds)
        clearSelection()
    }

    if (showDeleteDialog) {
        val label = if (totalSelected == 1) "cet élément" else "ces $totalSelected éléments"
        AlertDialog(
            onDismissRequest = { showDeleteDialog = false },
            title = { Text("Supprimer $label ?") },
            text = {
                val detail = buildString {
                    if (selectedSeanceIds.isNotEmpty()) {
                        append("${selectedSeanceIds.size} séance${if (selectedSeanceIds.size > 1) "s type" else " type"}")
                        if (selectedInstanceIds.isNotEmpty()) append(" et ")
                    }
                    if (selectedInstanceIds.isNotEmpty()) {
                        append("${selectedInstanceIds.size} séance${if (selectedInstanceIds.size > 1) "s planifiées" else " planifiée"}")
                    }
                    append(" seront supprimées.")
                    if (selectedSeanceIds.isNotEmpty()) append("\nAttention : supprimer une séance type supprime aussi toutes ses instances.")
                }
                Text(detail, style = MaterialTheme.typography.bodySmall)
            },
            confirmButton = {
                TextButton(onClick = { deleteSelected(); showDeleteDialog = false }) {
                    Text("Supprimer", color = MaterialTheme.colorScheme.error, fontWeight = FontWeight.SemiBold)
                }
            },
            dismissButton = {
                TextButton(onClick = { showDeleteDialog = false }) { Text("Annuler") }
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
            onDismiss = { showSingleDatePicker = false; assignTargetId = null },
            onConfirm = { date ->
                assignTargetId?.let { id -> viewModel.assignToDate(id, date) }
                showSingleDatePicker = false
                assignTargetId = null
            },
        )
    }

    if (showMultiDateDialog) {
        AssignMultiDatePickerDialog(
            minDate = java.time.LocalDate.of(2000, 1, 1),
            onDismiss = { showMultiDateDialog = false; assignTargetId = null },
            onConfirm = { dates ->
                assignTargetId?.let { id -> viewModel.assignToDates(id, dates) }
                showMultiDateDialog = false
                assignTargetId = null
            },
        )
    }

    if (showRecurrenceDialog) {
        AssignRecurrenceDialog(
            onDismiss = { showRecurrenceDialog = false; assignTargetId = null },
            onConfirm = { start, intervalDays, occurrences ->
                assignTargetId?.let { id -> viewModel.assignRecurring(id, start, intervalDays, occurrences) }
                showRecurrenceDialog = false
                assignTargetId = null
            },
        )
    }

    // Picker reschedule instance strength
    if (showReschedulePicker) {
        AssignSingleDatePickerDialog(
            minDate = java.time.LocalDate.of(2000, 1, 1),
            onDismiss = { showReschedulePicker = false; rescheduleTargetId = null },
            onConfirm = { date ->
                rescheduleTargetId?.let { id -> viewModel.rescheduleInstance(id, date) }
                showReschedulePicker = false
                rescheduleTargetId = null
            },
        )
    }

    // Dialog création one-shot
    if (showOneShotDialog) {
        AlertDialog(
            onDismissRequest = { showOneShotDialog = false; oneShotNom = "" },
            title = { Text("Séance directe") },
            text = {
                androidx.compose.foundation.layout.Column(
                    verticalArrangement = androidx.compose.foundation.layout.Arrangement.spacedBy(12.dp),
                ) {
                    Text(
                        "Crée une séance planifiée indépendante, sans séance type associée.",
                        style = MaterialTheme.typography.bodySmall,
                        color = PandaSubtext,
                    )
                    OutlinedTextField(
                        value = oneShotNom,
                        onValueChange = { oneShotNom = it },
                        label = { Text("Nom de la séance") },
                        placeholder = { Text("Séance du ${oneShotDate.dayOfMonth}/${oneShotDate.monthValue}") },
                        singleLine = true,
                        modifier = androidx.compose.ui.Modifier.fillMaxWidth(),
                    )
                }
            },
            confirmButton = {
                TextButton(onClick = {
                    viewModel.createOneShotInstance(oneShotNom, oneShotDate)
                    showOneShotDialog = false
                    oneShotNom = ""
                }) {
                    Text("Créer", color = PandaPurple, fontWeight = FontWeight.SemiBold)
                }
            },
            dismissButton = {
                TextButton(onClick = { showOneShotDialog = false; oneShotNom = "" }) { Text("Annuler") }
            },
        )
    }

    Scaffold(
        modifier = Modifier.nestedScroll(scrollBehavior.nestedScrollConnection),
        topBar = {
            if (isSelectionMode) {
                TopAppBar(
                    title = {
                        Text(
                            "$totalSelected sélectionné${if (totalSelected > 1) "s" else ""}",
                            style = MaterialTheme.typography.titleMedium,
                        )
                    },
                    navigationIcon = {
                        IconButton(onClick = ::clearSelection) {
                            Icon(Icons.Default.Close, "Annuler la sélection")
                        }
                    },
                    actions = {
                        IconButton(onClick = { showDeleteDialog = true }) {
                            Icon(Icons.Default.Delete, "Supprimer", tint = MaterialTheme.colorScheme.error)
                        }
                    },
                    colors = TopAppBarDefaults.topAppBarColors(
                        containerColor = PandaPurple.copy(alpha = 0.08f),
                    ),
                )
            } else {
                PandaTopBar(title = "Renforcement", onOpenDrawer = onOpenDrawer, scrollBehavior = scrollBehavior)
            }
        },
        floatingActionButton = {
            if (!isSelectionMode) {
                androidx.compose.foundation.layout.Box {
                    FloatingActionButton(onClick = { showFabMenu = true }, containerColor = PandaPurple) {
                        Icon(Icons.Default.Add, "Nouvelle séance", tint = MaterialTheme.colorScheme.onPrimary)
                    }
                    DropdownMenu(
                        expanded = showFabMenu,
                        onDismissRequest = { showFabMenu = false },
                        offset = DpOffset(0.dp, (-8).dp),
                    ) {
                        DropdownMenuItem(
                            text = { Text("Séance type") },
                            leadingIcon = { Icon(Icons.Default.FitnessCenter, null, tint = PandaPurple, modifier = androidx.compose.ui.Modifier.size(18.dp)) },
                            onClick = { showFabMenu = false; onNavigateToCreate() },
                        )
                        DropdownMenuItem(
                            text = { Text("Séance directe") },
                            leadingIcon = { Icon(Icons.Default.PlayArrow, null, tint = PandaPurple, modifier = androidx.compose.ui.Modifier.size(18.dp)) },
                            onClick = { showFabMenu = false; oneShotDate = java.time.LocalDate.now(); showOneShotDialog = true },
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
            uiState.seances.isEmpty() && uiState.instances.isEmpty() -> PandaEmptyState(
                title = "Aucune séance",
                description = "Crée ta première séance de renforcement.",
                icon = Icons.Default.FitnessCenter,
                action = { AppButton(label = "Créer une séance", onClick = onNavigateToCreate) },
                modifier = Modifier.padding(innerPadding),
            )
            else -> {
                val plannedInstances = uiState.instances
                    .filter { !it.isCompleted }
                    .sortedBy { it.date }
                val completedInstances = uiState.instances
                    .filter { it.isCompleted }
                    .sortedByDescending { it.date }
                val visibleCompleted = if (showAllCompleted) completedInstances
                else completedInstances.take(MAX_COMPLETED_VISIBLE)

                LazyColumn(
                    modifier = Modifier.fillMaxSize().padding(innerPadding),
                    contentPadding = PaddingValues(bottom = 88.dp),
                ) {
                    // ===== SÉANCES TYPES =====
                    if (uiState.seances.isNotEmpty()) {
                        item { SeanceSectionHeader("Séances types") }
                        items(uiState.seances, key = { "s_${it.id}" }) { seance ->
                            val isSelected = seance.id in selectedSeanceIds
                            SelectableSeanceTypeCard(
                                seance = seance,
                                isSelected = isSelected,
                                isSelectionMode = isSelectionMode,
                                onDuplicate = if (!isSelectionMode) { { viewModel.duplicateSeance(seance.id) } } else null,
                                onAssign = if (!isSelectionMode) { { assignTargetId = seance.id; showAssignMenu = true } } else null,
                                onClick = {
                                    if (isSelectionMode) toggleSeance(seance.id)
                                    else onNavigateToDetail(seance.id)
                                },
                                onLongClick = { selectedSeanceIds = selectedSeanceIds + seance.id },
                            )
                        }
                    }

                    // ===== SÉANCES PLANIFIÉES =====
                    if (plannedInstances.isNotEmpty()) {
                        item { SeanceSectionHeader("Séances planifiées") }
                        items(plannedInstances, key = { "ip_${it.id}" }) { instance ->
                            val seance = uiState.seancesById[instance.seanceId]
                            val isSelected = instance.id in selectedInstanceIds
                            SelectableInstanceCard(
                                instance = instance,
                                seance = seance,
                                isSelected = isSelected,
                                isSelectionMode = isSelectionMode,
                                onReschedule = if (!isSelectionMode) {
                                    { rescheduleTargetId = instance.id; showReschedulePicker = true }
                                } else null,
                                onClick = {
                                    if (isSelectionMode) toggleInstance(instance.id)
                                    else onNavigateToInstance(instance.id)
                                },
                                onLongClick = { selectedInstanceIds = selectedInstanceIds + instance.id },
                            )
                        }
                    }

                    // ===== SÉANCES TERMINÉES =====
                    if (completedInstances.isNotEmpty()) {
                        item { SeanceSectionHeader("Séances terminées") }
                        items(visibleCompleted, key = { "ic_${it.id}" }) { instance ->
                            val seance = uiState.seancesById[instance.seanceId]
                            val isSelected = instance.id in selectedInstanceIds
                            SelectableInstanceCard(
                                instance = instance,
                                seance = seance,
                                isSelected = isSelected,
                                isSelectionMode = isSelectionMode,
                                onClick = {
                                    if (isSelectionMode) toggleInstance(instance.id)
                                    else onNavigateToInstanceReport(instance.id)
                                },
                                onLongClick = { selectedInstanceIds = selectedInstanceIds + instance.id },
                            )
                        }
                        if (completedInstances.size > MAX_COMPLETED_VISIBLE) {
                            item {
                                TextButton(
                                    onClick = { showAllCompleted = !showAllCompleted },
                                    modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
                                ) {
                                    Icon(
                                        if (showAllCompleted) Icons.Default.ExpandLess else Icons.Default.ExpandMore,
                                        null,
                                        modifier = Modifier.size(16.dp),
                                        tint = PandaSubtext,
                                    )
                                    Spacer(Modifier.width(4.dp))
                                    Text(
                                        if (showAllCompleted) "Réduire"
                                        else "Voir les ${completedInstances.size - MAX_COMPLETED_VISIBLE} autres",
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

@Composable
private fun SeanceSectionHeader(label: String) {
    Text(
        label,
        style = MaterialTheme.typography.labelSmall,
        color = PandaPurple,
        fontWeight = FontWeight.Bold,
        modifier = Modifier.padding(start = 16.dp, top = 16.dp, bottom = 4.dp, end = 16.dp),
    )
}

@Composable
private fun SelectableSeanceTypeCard(
    seance: SeanceEntity,
    isSelected: Boolean,
    isSelectionMode: Boolean,
    onDuplicate: (() -> Unit)? = null,
    onAssign: (() -> Unit)? = null,
    onClick: () -> Unit,
    onLongClick: () -> Unit,
) {
    val borderColor = if (isSelected) PandaPurple else PandaPurple.copy(alpha = 0f)
    val bgColor = if (isSelected) PandaPurple.copy(alpha = 0.1f) else MaterialTheme.colorScheme.surface

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 4.dp)
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
                    tint = if (isSelected) PandaPurple else PandaSubtext,
                    modifier = Modifier.size(22.dp),
                )
                Spacer(Modifier.width(10.dp))
            } else {
                SportIconBadge(icon = Icons.Default.FitnessCenter, contentDescription = null, accentColor = PandaPurple, size = 40.dp, iconSize = 20.dp)
                Spacer(Modifier.width(12.dp))
            }
            Column(modifier = Modifier.weight(1f)) {
                Text(seance.nom, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                if (seance.groupesMusculaires.isNotEmpty()) {
                    Text(seance.groupesMusculaires.joinToString(" · "), style = MaterialTheme.typography.bodySmall, color = PandaSubtext)
                }
                if (seance.notes.isNotBlank()) {
                    Text(
                        seance.notes,
                        style = MaterialTheme.typography.bodySmall.copy(fontStyle = FontStyle.Italic),
                        color = PandaSubtext.copy(alpha = 0.8f),
                        maxLines = 2,
                    )
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
                Icon(Icons.AutoMirrored.Filled.NavigateNext, null, tint = PandaSubtext, modifier = Modifier.size(18.dp))
            }
        }
    }
}

@Composable
private fun SelectableInstanceCard(
    instance: InstanceSeanceEntity,
    seance: SeanceEntity?,
    isSelected: Boolean,
    isSelectionMode: Boolean,
    onReschedule: (() -> Unit)? = null,
    onClick: () -> Unit,
    onLongClick: () -> Unit,
) {
    val isCompleted = instance.isCompleted
    val bgColor = when {
        isSelected -> PandaPurple.copy(alpha = 0.1f)
        else -> MaterialTheme.colorScheme.surface
    }
    val dateFormatter = DateTimeFormatter.ofPattern("d MMMM", Locale.FRENCH)
    val dayName = instance.date.dayOfWeek.getDisplayName(TextStyle.FULL, Locale.FRENCH).replaceFirstChar { it.uppercase() }

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 4.dp)
            .alpha(if (isCompleted && !isSelectionMode) 0.75f else 1f)
            .border(if (isSelected) 2.dp else 0.dp, PandaPurple, MaterialTheme.shapes.medium)
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
                    tint = if (isSelected) PandaPurple else PandaSubtext,
                    modifier = Modifier.size(22.dp),
                )
                Spacer(Modifier.width(10.dp))
            } else {
                SportIconBadge(icon = Icons.Default.FitnessCenter, contentDescription = null, accentColor = PandaPurple, size = 40.dp, iconSize = 20.dp)
                Spacer(Modifier.width(12.dp))
            }
            Column(modifier = Modifier.weight(1f)) {
                Text(seance?.nom ?: "Séance", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                Text("$dayName ${instance.date.format(dateFormatter)}", style = MaterialTheme.typography.bodySmall, color = PandaSubtext)
            }
            if (!isSelectionMode) {
                if (isCompleted) {
                    Icon(Icons.Default.CheckCircle, null, tint = PandaPurple, modifier = Modifier.size(18.dp))
                } else {
                    // Bouton décalage de date (uniquement sur les séances non terminées)
                    if (onReschedule != null) {
                        IconButton(onClick = onReschedule, modifier = Modifier.size(32.dp)) {
                            Icon(Icons.Default.CalendarMonth, "Changer la date", tint = PandaSubtext, modifier = Modifier.size(16.dp))
                        }
                    }
                    Icon(Icons.Default.PlayArrow, null, tint = PandaPurple, modifier = Modifier.size(18.dp))
                }
            }
        }
    }
}
