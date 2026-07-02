package com.pandafit.feature.running.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.DragHandle
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.KeyboardArrowUp
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.res.stringResource
import com.pandafit.feature.running.R
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.pandafit.core.database.entities.RunEndType
import com.pandafit.core.database.entities.RunEndUnit
import com.pandafit.core.database.entities.RunStepType
import com.pandafit.core.database.entities.RunTargetType
import com.pandafit.designsystem.theme.*
import com.pandafit.feature.running.model.RunItemDraft
import com.pandafit.feature.running.viewmodel.RunningDetailViewModel
import sh.calvin.reorderable.ReorderableItem
import sh.calvin.reorderable.rememberReorderableLazyListState

private const val HEADER_ITEMS = 3 // header row + name field + section label

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RunningWorkoutDetailScreen(
    workoutId: Long?,
    isPlanned: Boolean = false,
    onNavigateBack: () -> Unit,
    onNavigateToExecute: (Long) -> Unit,
    viewModel: RunningDetailViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val lazyListState = rememberLazyListState()

    // Pour une nouvelle séance planifiée directe, informer le VM (overrides le default isTemplate=true)
    LaunchedEffect(isPlanned) {
        if (isPlanned && workoutId == null) viewModel.setAsPlanned()
    }

    val reorderState = rememberReorderableLazyListState(lazyListState = lazyListState) { from, to ->
        val fromIdx = from.index - HEADER_ITEMS
        val toIdx   = to.index   - HEADER_ITEMS
        if (fromIdx >= 0 && toIdx >= 0 && toIdx < uiState.items.size) {
            viewModel.reorderItems(fromIdx, toIdx)
        }
    }

    LaunchedEffect(uiState.savedWorkoutId) {
        if (uiState.savedWorkoutId != null) onNavigateBack()
    }

    Scaffold(containerColor = MaterialTheme.colorScheme.background) { innerPadding ->
        LazyColumn(
            state = lazyListState,
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .imePadding(),
            contentPadding = PaddingValues(start = 16.dp, end = 16.dp, bottom = 48.dp),
        ) {
            // ── Header ──
            item(key = "header") {
                Spacer(Modifier.height(16.dp))
                Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, stringResource(R.string.common_navigate_back_cd), tint = MaterialTheme.colorScheme.onSurface)
                    }
                    val screenTitle = if (uiState.isNew) stringResource(R.string.running_detail_title_new) else stringResource(R.string.running_detail_title_edit)
                    Text(
                        screenTitle,
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.weight(1f).padding(horizontal = 8.dp),
                    )
                    TextButton(onClick = { viewModel.save() }, enabled = !uiState.isSaving) {
                        Text(stringResource(R.string.running_detail_save_button), color = PandaGreen, fontWeight = FontWeight.Bold)
                    }
                }
            }

            // ── Nom ──
            item(key = "name_field") {
                Spacer(Modifier.height(8.dp))
                val nameError = uiState.error != null && uiState.name.isBlank()
                OutlinedTextField(
                    value = uiState.name,
                    onValueChange = viewModel::updateName,
                    label = { Text(stringResource(R.string.running_detail_name_label)) },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    placeholder = { Text(stringResource(R.string.running_detail_name_placeholder)) },
                    isError = nameError,
                    supportingText = if (nameError) {
                        { Text(stringResource(R.string.running_detail_name_error), color = MaterialTheme.colorScheme.error) }
                    } else null,
                )
                if (!nameError) Spacer(Modifier.height(4.dp))
                Text(
                    stringResource(R.string.running_detail_template_info),
                    style = MaterialTheme.typography.bodySmall,
                    color = PandaSubtext,
                )
                // Checkbox poussette — uniquement pour les séances planifiées (pas les templates)
                if (!uiState.isTemplate) {
                    Spacer(Modifier.height(8.dp))
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { viewModel.updateWithStroller(!uiState.withStroller) }
                            .padding(vertical = 4.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Checkbox(
                            checked = uiState.withStroller,
                            onCheckedChange = viewModel::updateWithStroller,
                            colors = CheckboxDefaults.colors(checkedColor = PandaGreen),
                        )
                        Spacer(Modifier.width(8.dp))
                        Text(stringResource(R.string.running_detail_with_stroller), style = MaterialTheme.typography.bodyMedium)
                    }
                }
                Spacer(Modifier.height(16.dp))
            }

            // ── Section label ──
            item(key = "section_label") {
                Text(
                    stringResource(R.string.running_detail_section_steps),
                    style = MaterialTheme.typography.labelSmall,
                    color = PandaGreen,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(bottom = 8.dp),
                )
            }

            // ── Items (étapes + répétitions) ──
            itemsIndexed(
                items = uiState.items,
                key = { idx, item ->
                    when (item) {
                        is RunItemDraft.Step   -> "step_${item.id}_$idx"
                        is RunItemDraft.Repeat -> "repeat_${item.id}_$idx"
                    }
                },
            ) { idx, item ->
                ReorderableItem(
                    state = reorderState,
                    key = when (item) {
                        is RunItemDraft.Step   -> "step_${item.id}_$idx"
                        is RunItemDraft.Repeat -> "repeat_${item.id}_$idx"
                    },
                ) { isDragging ->
                    val elevation = if (isDragging) 8.dp else 0.dp
                    Box(modifier = Modifier.fillMaxWidth()) {
                        when (item) {
                            is RunItemDraft.Step -> RunStepCard(
                                step = item,
                                dragHandleModifier = Modifier.draggableHandle(),
                                onUpdate = { viewModel.updateItem(idx, it) },
                                onDelete = { viewModel.removeItem(idx) },
                                elevation = elevation,
                            )
                            is RunItemDraft.Repeat -> RunRepeatCard(
                                repeat = item,
                                dragHandleModifier = Modifier.draggableHandle(),
                                onUpdate = { viewModel.updateItem(idx, it) },
                                onDelete = { viewModel.removeItem(idx) },
                                onUpdateChild = { sIdx, s -> viewModel.updateChildStep(idx, sIdx, s) },
                                onDeleteChild = { sIdx -> viewModel.removeChildStep(idx, sIdx) },
                                onAddChild = { viewModel.addChildStep(idx) },
                                onMoveChildUp = { sIdx -> if (sIdx > 0) viewModel.reorderChildSteps(idx, sIdx, sIdx - 1) },
                                onMoveChildDown = { sIdx -> if (sIdx < item.steps.lastIndex) viewModel.reorderChildSteps(idx, sIdx, sIdx + 1) },
                                elevation = elevation,
                            )
                        }
                    }
                    Spacer(Modifier.height(16.dp))
                }
            }

            // ── Footer ──
            item(key = "footer") {
                Spacer(Modifier.height(4.dp))
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    OutlinedButton(
                        onClick = { viewModel.addStep() },
                        modifier = Modifier.weight(1f),
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = PandaGreen),
                    ) {
                        Icon(Icons.Default.Add, null, modifier = Modifier.size(14.dp))
                        Spacer(Modifier.width(4.dp))
                        Text(stringResource(R.string.running_detail_add_step), style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.SemiBold)
                    }
                    OutlinedButton(
                        onClick = { viewModel.addRepeat() },
                        modifier = Modifier.weight(1f),
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = PandaOrange),
                    ) {
                        Icon(Icons.Default.Add, null, modifier = Modifier.size(14.dp))
                        Spacer(Modifier.width(4.dp))
                        Text(stringResource(R.string.running_detail_add_repeat), style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.SemiBold)
                    }
                }
            }
        }
    }
}

// ── Carte étape ───────────────────────────────────────────────────────────────

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun RunStepCard(
    step: RunItemDraft.Step,
    dragHandleModifier: Modifier = Modifier,
    onUpdate: (RunItemDraft.Step) -> Unit,
    onDelete: () -> Unit,
    isChild: Boolean = false,
    showUpDown: Boolean = false,
    onMoveUp: () -> Unit = {},
    onMoveDown: () -> Unit = {},
    elevation: androidx.compose.ui.unit.Dp = 0.dp,
) {
    var expanded by remember { mutableStateOf(false) }
    val stripeColor = stepColor(step.stepType)

    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(10.dp)),
        shadowElevation = elevation,
        shape = RoundedCornerShape(10.dp),
        color = MaterialTheme.colorScheme.surface,
        tonalElevation = 0.dp,
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .border(1.dp, PandaOutline, RoundedCornerShape(10.dp)),
        ) {
            // ── Ligne collapsed ──
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { expanded = !expanded },
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Box(
                    modifier = Modifier
                        .width(4.dp)
                        .height(56.dp)
                        .background(stripeColor, RoundedCornerShape(topStart = 10.dp, bottomStart = 10.dp)),
                )
                Column(modifier = Modifier.weight(1f).padding(horizontal = 12.dp, vertical = 8.dp)) {
                    Text(stepLabel(step.stepType), style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.Bold, color = stripeColor)
                    Text(endSummary(step), style = MaterialTheme.typography.bodySmall, color = PandaSubtext)
                }
                if (showUpDown) {
                    IconButton(onClick = onMoveUp, modifier = Modifier.size(32.dp)) {
                        Icon(Icons.Default.KeyboardArrowUp, stringResource(R.string.running_detail_step_move_up_cd), tint = PandaSubtext, modifier = Modifier.size(16.dp))
                    }
                    IconButton(onClick = onMoveDown, modifier = Modifier.size(32.dp)) {
                        Icon(Icons.Default.KeyboardArrowDown, stringResource(R.string.running_detail_step_move_down_cd), tint = PandaSubtext, modifier = Modifier.size(16.dp))
                    }
                } else {
                    Icon(
                        Icons.Default.DragHandle, stringResource(R.string.running_detail_step_reorder_cd),
                        tint = PandaSubtext,
                        modifier = dragHandleModifier.padding(horizontal = 8.dp).size(20.dp),
                    )
                }
                IconButton(onClick = onDelete, modifier = Modifier.size(36.dp)) {
                    Icon(Icons.Default.Delete, stringResource(R.string.running_detail_step_delete_cd), tint = PandaRed, modifier = Modifier.size(18.dp))
                }
            }

            // ── Champs expandés ──
            if (expanded) {
                Column(modifier = Modifier.padding(horizontal = 12.dp).padding(bottom = 12.dp)) {
                    HorizontalDivider(color = PandaOutline)
                    Spacer(Modifier.height(10.dp))

                    // Type d'étape
                    StepDropdown(
                        label = stringResource(R.string.running_detail_step_type_label),
                        options = RunStepType.entries.map { it to stepLabel(it) },
                        selected = step.stepType,
                        onSelect = { onUpdate(step.copy(stepType = it)) },
                    )
                    Spacer(Modifier.height(10.dp))

                    // Fin d'étape
                    EndTypeField(
                        step = step,
                        onUpdate = onUpdate,
                    )
                    Spacer(Modifier.height(10.dp))

                    // Note
                    OutlinedTextField(
                        value = step.note,
                        onValueChange = { if (it.length <= 200) onUpdate(step.copy(note = it)) },
                        label = { Text(stringResource(R.string.running_detail_note_label)) },
                        modifier = Modifier.fillMaxWidth(),
                        maxLines = 3,
                        supportingText = { Text(stringResource(R.string.running_detail_note_counter, step.note.length), color = PandaSubtext) },
                    )
                    Spacer(Modifier.height(10.dp))

                    // Objectif d'intensité
                    TargetField(step = step, onUpdate = onUpdate)
                }
            }
        }
    }
}

// ── Carte répétition ──────────────────────────────────────────────────────────

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun RunRepeatCard(
    repeat: RunItemDraft.Repeat,
    dragHandleModifier: Modifier = Modifier,
    onUpdate: (RunItemDraft.Repeat) -> Unit,
    onDelete: () -> Unit,
    onUpdateChild: (Int, RunItemDraft.Step) -> Unit,
    onDeleteChild: (Int) -> Unit,
    onAddChild: () -> Unit,
    onMoveChildUp: (Int) -> Unit,
    onMoveChildDown: (Int) -> Unit,
    elevation: androidx.compose.ui.unit.Dp = 0.dp,
) {
    var countExpanded by remember { mutableStateOf(false) }

    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp)),
        shadowElevation = elevation,
        shape = RoundedCornerShape(12.dp),
        color = PandaOrangeContainer,
        tonalElevation = 0.dp,
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .border(1.5.dp, PandaOrangeBorder, RoundedCornerShape(12.dp))
                .padding(bottom = 8.dp),
        ) {
            // ── En-tête ──
            Row(
                modifier = Modifier.fillMaxWidth().padding(start = 12.dp, end = 4.dp, top = 4.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                ExposedDropdownMenuBox(
                    expanded = countExpanded,
                    onExpandedChange = { countExpanded = it },
                    modifier = Modifier.weight(1f),
                ) {
                    Row(
                        modifier = Modifier.menuAnchor().clickable { countExpanded = true },
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            stringResource(R.string.running_detail_repeat_count, repeat.repeatCount),
                            style = MaterialTheme.typography.titleSmall,
                            fontWeight = FontWeight.ExtraBold,
                            color = PandaOrange,
                        )
                        Icon(Icons.Default.KeyboardArrowDown, null, tint = PandaOrange, modifier = Modifier.size(16.dp))
                    }
                    ExposedDropdownMenu(expanded = countExpanded, onDismissRequest = { countExpanded = false }) {
                        (2..20).forEach { n ->
                            DropdownMenuItem(
                                text = { Text("$n fois") },
                                onClick = { onUpdate(repeat.copy(repeatCount = n)); countExpanded = false },
                            )
                        }
                    }
                }
                Icon(
                    Icons.Default.DragHandle, stringResource(R.string.running_detail_repeat_reorder_cd),
                    tint = PandaSubtext,
                    modifier = dragHandleModifier.padding(horizontal = 8.dp).size(20.dp),
                )
                IconButton(onClick = onDelete, modifier = Modifier.size(36.dp)) {
                    Icon(Icons.Default.Delete, stringResource(R.string.running_detail_repeat_delete_cd), tint = PandaRed, modifier = Modifier.size(18.dp))
                }
            }

            // ── Étapes enfants ──
            repeat.steps.forEachIndexed { sIdx, step ->
                Box(
                    modifier = Modifier
                        .padding(start = 12.dp, end = 8.dp, top = 4.dp),
                ) {
                    RunStepCard(
                        step = step,
                        onUpdate = { onUpdateChild(sIdx, it) },
                        onDelete = { onDeleteChild(sIdx) },
                        isChild = true,
                        showUpDown = repeat.steps.size > 1,
                        onMoveUp = { onMoveChildUp(sIdx) },
                        onMoveDown = { onMoveChildDown(sIdx) },
                    )
                }
            }

            // ── Bouton ajout étape enfant ──
            TextButton(
                onClick = onAddChild,
                modifier = Modifier.padding(start = 8.dp, top = 4.dp),
                colors = ButtonDefaults.textButtonColors(contentColor = PandaOrange),
            ) {
                Icon(Icons.Default.Add, null, modifier = Modifier.size(14.dp))
                Spacer(Modifier.width(4.dp))
                Text(stringResource(R.string.running_detail_add_step), style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.SemiBold)
            }
        }
    }
}

// ── Champ fin d'étape ─────────────────────────────────────────────────────────

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun EndTypeField(step: RunItemDraft.Step, onUpdate: (RunItemDraft.Step) -> Unit) {
    var endTypeExpanded by remember { mutableStateOf(false) }
    var unitExpanded by remember { mutableStateOf(false) }

    Column {
        ExposedDropdownMenuBox(expanded = endTypeExpanded, onExpandedChange = { endTypeExpanded = it }) {
            val endTypeLabel = if (step.endType == RunEndType.DURATION) stringResource(R.string.running_detail_end_type_duration) else stringResource(R.string.running_detail_end_type_distance)
            OutlinedTextField(
                value = endTypeLabel,
                onValueChange = {},
                readOnly = true,
                label = { Text(stringResource(R.string.running_detail_step_end_label)) },
                trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = endTypeExpanded) },
                modifier = Modifier.fillMaxWidth().menuAnchor(),
            )
            ExposedDropdownMenu(expanded = endTypeExpanded, onDismissRequest = { endTypeExpanded = false }) {
                DropdownMenuItem(text = { Text(stringResource(R.string.running_detail_end_type_duration)) }, onClick = {
                    onUpdate(step.copy(endType = RunEndType.DURATION, endUnit = RunEndUnit.SECONDS, endValue = ""))
                    endTypeExpanded = false
                })
                DropdownMenuItem(text = { Text(stringResource(R.string.running_detail_end_type_distance)) }, onClick = {
                    onUpdate(step.copy(endType = RunEndType.DISTANCE, endUnit = RunEndUnit.METERS, endValue = ""))
                    endTypeExpanded = false
                })
            }
        }
        Spacer(Modifier.height(8.dp))

        if (step.endType == RunEndType.DURATION) {
            MmSsSplitField(
                label = stringResource(R.string.running_detail_duration_label),
                totalSeconds = step.endValue.toIntOrNull() ?: 0,
                onValueChange = { onUpdate(step.copy(endValue = it.toString())) },
            )
        } else {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = step.endValue,
                    onValueChange = { v -> if (v.all { it.isDigit() }) onUpdate(step.copy(endValue = v)) },
                    label = { Text(stringResource(R.string.running_detail_distance_label)) },
                    modifier = Modifier.weight(1f),
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                )
                ExposedDropdownMenuBox(
                    expanded = unitExpanded,
                    onExpandedChange = { unitExpanded = it },
                    modifier = Modifier.width(90.dp),
                ) {
                    OutlinedTextField(
                        value = if (step.endUnit == RunEndUnit.METERS) "m" else "km",
                        onValueChange = {},
                        readOnly = true,
                        label = { Text(stringResource(R.string.running_detail_unit_label)) },
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = unitExpanded) },
                        modifier = Modifier.menuAnchor(),
                    )
                    ExposedDropdownMenu(expanded = unitExpanded, onDismissRequest = { unitExpanded = false }) {
                        DropdownMenuItem(text = { Text("m") }, onClick = { onUpdate(step.copy(endUnit = RunEndUnit.METERS)); unitExpanded = false })
                        DropdownMenuItem(text = { Text("km") }, onClick = { onUpdate(step.copy(endUnit = RunEndUnit.KM)); unitExpanded = false })
                    }
                }
            }
        }
    }
}

// ── Champ objectif d'intensité ────────────────────────────────────────────────

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun TargetField(step: RunItemDraft.Step, onUpdate: (RunItemDraft.Step) -> Unit) {
    val targetOptions = listOf(
        RunTargetType.NONE       to stringResource(R.string.running_detail_target_none),
        RunTargetType.PACE       to stringResource(R.string.running_detail_target_pace),
        RunTargetType.CADENCE    to stringResource(R.string.running_detail_target_cadence),
        RunTargetType.HR_ZONE    to stringResource(R.string.running_detail_target_hr_zone),
        RunTargetType.HR_CUSTOM  to stringResource(R.string.running_detail_target_hr_custom),
    )
    var expanded by remember { mutableStateOf(false) }

    ExposedDropdownMenuBox(expanded = expanded, onExpandedChange = { expanded = it }) {
        OutlinedTextField(
            value = targetOptions.find { it.first == step.targetType }?.second ?: stringResource(R.string.running_detail_target_none),
            onValueChange = {},
            readOnly = true,
            label = { Text(stringResource(R.string.running_detail_target_label)) },
            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
            modifier = Modifier.fillMaxWidth().menuAnchor(),
        )
        ExposedDropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            targetOptions.forEach { (type, label) ->
                DropdownMenuItem(
                    text = { Text(label) },
                    onClick = {
                        onUpdate(step.copy(targetType = type, targetMin = "", targetMax = ""))
                        expanded = false
                    },
                )
            }
        }
    }

    Spacer(Modifier.height(8.dp))

    when (step.targetType) {
        RunTargetType.PACE -> {
            // allure stockée en sec/km — max (allure lente) doit être > min (allure rapide)
            val minSec = step.targetMin.toIntOrNull() ?: 0
            val maxSec = step.targetMax.toIntOrNull() ?: 0
            val paceError = step.targetMin.isNotBlank() && step.targetMax.isNotBlank() && maxSec <= minSec
            Column(modifier = Modifier.fillMaxWidth()) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.Top) {
                    MmSsSplitField(
                        label = stringResource(R.string.running_detail_pace_min_label),
                        totalSeconds = minSec,
                        onValueChange = { onUpdate(step.copy(targetMin = if (it > 0) it.toString() else "")) },
                        modifier = Modifier.weight(1f),
                        isError = paceError,
                    )
                    Text("→", modifier = Modifier.padding(top = 20.dp))
                    MmSsSplitField(
                        label = stringResource(R.string.running_detail_pace_max_label),
                        totalSeconds = maxSec,
                        onValueChange = { onUpdate(step.copy(targetMax = if (it > 0) it.toString() else "")) },
                        modifier = Modifier.weight(1f),
                        isError = paceError,
                    )
                }
                if (paceError) {
                    Text(
                        stringResource(R.string.running_detail_pace_error),
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.error,
                        modifier = Modifier.padding(top = 2.dp),
                    )
                }
            }
        }
        RunTargetType.CADENCE -> {
            val minVal = step.targetMin.toIntOrNull() ?: 0
            val maxVal = step.targetMax.toIntOrNull() ?: 0
            val cadenceError = step.targetMin.isNotBlank() && step.targetMax.isNotBlank() && maxVal <= minVal
            Column(modifier = Modifier.fillMaxWidth()) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                    StepIntField(stringResource(R.string.running_detail_cadence_min_label), step.targetMin, Modifier.weight(1f), isError = cadenceError) { onUpdate(step.copy(targetMin = it)) }
                    Text("→", modifier = Modifier.align(Alignment.CenterVertically))
                    StepIntField(stringResource(R.string.running_detail_cadence_max_label), step.targetMax, Modifier.weight(1f), isError = cadenceError) { onUpdate(step.copy(targetMax = it)) }
                }
                if (cadenceError) {
                    Text(
                        stringResource(R.string.running_detail_cadence_error),
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.error,
                        modifier = Modifier.padding(top = 2.dp),
                    )
                }
            }
        }
        RunTargetType.HR_ZONE -> {
            var zoneExpanded by remember { mutableStateOf(false) }
            ExposedDropdownMenuBox(expanded = zoneExpanded, onExpandedChange = { zoneExpanded = it }) {
                OutlinedTextField(
                    value = if (step.targetMin.isNotBlank()) "Z${step.targetMin}" else stringResource(R.string.running_detail_hr_zone_placeholder),
                    onValueChange = {},
                    readOnly = true,
                    label = { Text(stringResource(R.string.running_detail_hr_zone_label)) },
                    trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = zoneExpanded) },
                    modifier = Modifier.fillMaxWidth().menuAnchor(),
                )
                ExposedDropdownMenu(expanded = zoneExpanded, onDismissRequest = { zoneExpanded = false }) {
                    (1..5).forEach { z ->
                        DropdownMenuItem(text = { Text("Z$z") }, onClick = { onUpdate(step.copy(targetMin = z.toString(), targetMax = "")); zoneExpanded = false })
                    }
                }
            }
        }
        RunTargetType.HR_CUSTOM -> {
            val minVal = step.targetMin.toIntOrNull() ?: 0
            val maxVal = step.targetMax.toIntOrNull() ?: 0
            val hrError = step.targetMin.isNotBlank() && step.targetMax.isNotBlank() && maxVal <= minVal
            Column(modifier = Modifier.fillMaxWidth()) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                    StepIntField(stringResource(R.string.running_detail_hr_min_label), step.targetMin, Modifier.weight(1f), isError = hrError) { onUpdate(step.copy(targetMin = it)) }
                    Text("→", modifier = Modifier.align(Alignment.CenterVertically))
                    StepIntField(stringResource(R.string.running_detail_hr_max_label), step.targetMax, Modifier.weight(1f), isError = hrError) { onUpdate(step.copy(targetMax = it)) }
                }
                if (hrError) {
                    Text(
                        stringResource(R.string.running_detail_hr_error),
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.error,
                        modifier = Modifier.padding(top = 2.dp),
                    )
                }
            }
        }
        RunTargetType.NONE -> Unit
    }
}

// ── Dropdown générique pour les enums ─────────────────────────────────────────

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun <T> StepDropdown(
    label: String,
    options: List<Pair<T, String>>,
    selected: T,
    onSelect: (T) -> Unit,
) {
    var expanded by remember { mutableStateOf(false) }
    ExposedDropdownMenuBox(expanded = expanded, onExpandedChange = { expanded = it }) {
        OutlinedTextField(
            value = options.find { it.first == selected }?.second ?: "",
            onValueChange = {},
            readOnly = true,
            label = { Text(label) },
            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
            modifier = Modifier.fillMaxWidth().menuAnchor(),
        )
        ExposedDropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            options.forEach { (value, name) ->
                DropdownMenuItem(
                    text = { Text(name) },
                    onClick = { onSelect(value); expanded = false },
                )
            }
        }
    }
}

@Composable
private fun StepIntField(
    label: String,
    value: String,
    modifier: Modifier = Modifier,
    isError: Boolean = false,
    onValueChange: (String) -> Unit,
) {
    OutlinedTextField(
        value = value,
        onValueChange = { if (it.all { c -> c.isDigit() }) onValueChange(it) },
        label = { Text(label) },
        modifier = modifier,
        singleLine = true,
        isError = isError,
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
    )
}

// Saisie min + sec séparés — chaque champ utilise KeyboardType.Number (pas de colon)
@Composable
private fun MmSsSplitField(
    label: String,
    totalSeconds: Int,
    onValueChange: (Int) -> Unit,
    modifier: Modifier = Modifier,
    isError: Boolean = false,
) {
    var minStr by remember { mutableStateOf(if (totalSeconds > 0) (totalSeconds / 60).toString() else "") }
    var secStr by remember { mutableStateOf(if (totalSeconds > 0) (totalSeconds % 60).toString().padStart(2, '0') else "") }

    Column(modifier = modifier) {
        Text(
            label,
            style = MaterialTheme.typography.labelSmall,
            color = if (isError) MaterialTheme.colorScheme.error else PandaSubtext,
        )
        Spacer(Modifier.height(4.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
            OutlinedTextField(
                value = minStr,
                onValueChange = { v ->
                    if (v.length <= 3 && v.all { it.isDigit() }) {
                        minStr = v
                        onValueChange((v.toIntOrNull() ?: 0) * 60 + (secStr.toIntOrNull() ?: 0))
                    }
                },
                label = { Text(stringResource(R.string.running_detail_mm_label)) },
                modifier = Modifier.weight(1f),
                singleLine = true,
                isError = isError,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
            )
            Text(":", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleMedium)
            OutlinedTextField(
                value = secStr,
                onValueChange = { v ->
                    if (v.length <= 2 && v.all { it.isDigit() }) {
                        val s = v.toIntOrNull() ?: 0
                        if (v.isEmpty() || s <= 59) {
                            secStr = v
                            onValueChange((minStr.toIntOrNull() ?: 0) * 60 + s)
                        }
                    }
                },
                label = { Text(stringResource(R.string.running_detail_ss_label)) },
                modifier = Modifier.weight(1f),
                singleLine = true,
                isError = isError,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
            )
        }
    }
}

// ── Helpers locaux ────────────────────────────────────────────────────────────

private fun stepLabel(type: RunStepType) = when (type) {
    RunStepType.WARMUP   -> "Échauffement"
    RunStepType.RUNNING  -> "Course à pied"
    RunStepType.WALKING  -> "Marche"
    RunStepType.RECOVERY -> "Récupération"
    RunStepType.REST     -> "Repos"
    RunStepType.OTHER    -> "Autre"
}

private fun stepColor(type: RunStepType): Color = when (type) {
    RunStepType.WARMUP   -> PandaRed
    RunStepType.RUNNING  -> PandaBlue
    RunStepType.WALKING  -> PandaSubtext
    RunStepType.RECOVERY -> PandaGreen
    RunStepType.REST     -> PandaSubtextLight
    RunStepType.OTHER    -> PandaPurple
}

private fun endSummary(step: RunItemDraft.Step): String {
    if (step.endValue.isBlank()) return "—"
    return when (step.endType) {
        RunEndType.DURATION -> formatMmSs(step.endValue.toIntOrNull() ?: 0)
        RunEndType.DISTANCE -> "${step.endValue} ${if (step.endUnit == RunEndUnit.METERS) "m" else "km"}"
    }
}

private fun formatMmSs(totalSeconds: Int): String {
    val m = totalSeconds / 60
    val s = totalSeconds % 60
    return "$m:${s.toString().padStart(2, '0')}"
}
