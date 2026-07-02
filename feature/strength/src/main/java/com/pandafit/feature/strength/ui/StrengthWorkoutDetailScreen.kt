package com.pandafit.feature.strength.ui

import com.pandafit.core.common.normalizeSearch
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.expandVertically
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.ExpandLess
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material.icons.filled.FitnessCenter
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Save
import androidx.compose.material3.BottomAppBar
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Divider
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.FloatingActionButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.material3.rememberTopAppBarState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.pandafit.core.database.entities.ExerciseEntity
import com.pandafit.designsystem.components.PandaCard
import com.pandafit.designsystem.components.PandaTopBar
import com.pandafit.designsystem.theme.PandaPurple
import com.pandafit.designsystem.theme.PandaSubtext
import com.pandafit.feature.strength.model.StrengthExerciseDraft
import com.pandafit.feature.strength.model.StrengthSetDraft
import com.pandafit.feature.strength.model.StrengthWorkoutMode
import com.pandafit.feature.strength.R
import com.pandafit.feature.strength.viewmodel.StrengthDetailViewModel
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun StrengthWorkoutDetailScreen(
    workoutId: Long?,
    onNavigateBack: () -> Unit,
    onNavigateToExecute: (Long) -> Unit,
    viewModel: StrengthDetailViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val scrollBehavior = TopAppBarDefaults.pinnedScrollBehavior(rememberTopAppBarState())
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val scope = rememberCoroutineScope()
    var navigateToExecute by remember { mutableStateOf(false) }

    LaunchedEffect(uiState.savedWorkoutId) {
        if (navigateToExecute && uiState.savedWorkoutId != null) onNavigateToExecute(uiState.savedWorkoutId!!)
    }

    if (uiState.showExercisePicker) {
        ModalBottomSheet(
            onDismissRequest = viewModel::hideExercisePicker,
            sheetState = sheetState,
        ) {
            ExercisePickerSheet(
                exercises = uiState.availableExercises,
                onSelect = { viewModel.addExercise(it) },
                onDismiss = viewModel::hideExercisePicker,
            )
        }
    }

    Scaffold(
        modifier = Modifier.nestedScroll(scrollBehavior.nestedScrollConnection),
        topBar = {
            PandaTopBar(
                title = if (uiState.isNew) stringResource(R.string.seance_create_title_new) else stringResource(R.string.seance_create_title_edit),
                onNavigateBack = onNavigateBack,
                scrollBehavior = scrollBehavior,
            )
        },
        bottomBar = {
            BottomAppBar(
                actions = {
                    IconButton(onClick = viewModel::showExercisePicker) {
                        Icon(Icons.Default.Add, stringResource(R.string.strength_detail_add_exercise_cd))
                    }
                    Text(stringResource(R.string.strength_detail_add_exercise_label), style = MaterialTheme.typography.labelMedium, color = PandaSubtext)
                },
                floatingActionButton = {
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        FloatingActionButton(
                            onClick = viewModel::save,
                            containerColor = MaterialTheme.colorScheme.secondaryContainer,
                            contentColor = MaterialTheme.colorScheme.onSecondaryContainer,
                            elevation = FloatingActionButtonDefaults.bottomAppBarFabElevation(),
                        ) { Icon(Icons.Default.Save, stringResource(R.string.common_save_cd)) }
                        FloatingActionButton(
                            onClick = { navigateToExecute = true; viewModel.save() },
                            containerColor = PandaPurple,
                            contentColor = MaterialTheme.colorScheme.onPrimary,
                            elevation = FloatingActionButtonDefaults.bottomAppBarFabElevation(),
                        ) { Icon(Icons.Default.PlayArrow, stringResource(R.string.strength_detail_start_cd)) }
                    }
                },
            )
        },
        containerColor = MaterialTheme.colorScheme.background,
    ) { innerPadding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(innerPadding),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            // Infos générales
            item {
                PandaCard(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        OutlinedTextField(
                            value = uiState.name, onValueChange = viewModel::updateName,
                            label = { Text(stringResource(R.string.common_seance_name_label)) }, modifier = Modifier.fillMaxWidth(), singleLine = true,
                        )
                        OutlinedTextField(
                            value = uiState.notes, onValueChange = viewModel::updateNotes,
                            label = { Text(stringResource(R.string.common_notes_label)) }, modifier = Modifier.fillMaxWidth(), maxLines = 3,
                        )
                    }
                }
            }

            // Mode de séance
            item {
                Column {
                    Text(stringResource(R.string.strength_detail_type_title), style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                    Spacer(Modifier.height(8.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        StrengthWorkoutMode.entries.forEach { mode ->
                            FilterChip(
                                selected = uiState.mode == mode,
                                onClick = { viewModel.updateMode(mode) },
                                label = { Text(modeNameRes(mode)) },
                            )
                        }
                    }
                }
            }

            item {
                Text(
                    text = stringResource(R.string.strength_detail_exercises_section_title, uiState.exercises.size),
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                )
            }

            if (uiState.exercises.isEmpty()) {
                item {
                    TextButton(onClick = viewModel::showExercisePicker, modifier = Modifier.fillMaxWidth()) {
                        Icon(Icons.Default.FitnessCenter, null)
                        Text(stringResource(R.string.strength_detail_add_exercise_button))
                    }
                }
            }

            itemsIndexed(uiState.exercises, key = { i, e -> "${e.exercise.id}_$i" }) { index, exerciseDraft ->
                StrengthExerciseCard(
                    exercise = exerciseDraft,
                    onUpdate = { viewModel.updateExercise(index, it) },
                    onDuplicate = { viewModel.duplicateExercise(index) },
                    onDelete = { viewModel.removeExercise(index) },
                    onAddSet = { viewModel.addSet(index) },
                    onRemoveSet = { setIdx -> viewModel.removeSet(index, setIdx) },
                    onUpdateSet = { setIdx, set -> viewModel.updateSet(index, setIdx, set) },
                )
            }

            item { Spacer(Modifier.height(88.dp)) }
        }
    }
}

@Composable
private fun StrengthExerciseCard(
    exercise: StrengthExerciseDraft,
    onUpdate: (StrengthExerciseDraft) -> Unit,
    onDuplicate: () -> Unit,
    onDelete: () -> Unit,
    onAddSet: () -> Unit,
    onRemoveSet: (Int) -> Unit,
    onUpdateSet: (Int, StrengthSetDraft) -> Unit,
) {
    var expanded by remember { mutableStateOf(true) }

    PandaCard(modifier = Modifier.fillMaxWidth()) {
        Column {
            // Header
            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(Icons.Default.FitnessCenter, null, tint = PandaPurple, modifier = Modifier.size(20.dp))
                Spacer(Modifier.padding(horizontal = 6.dp))
                Column(modifier = Modifier.weight(1f)) {
                    Text(exercise.exercise.name, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                    Text(
                        "${exercise.sets.size} série(s) • ${exercise.exercise.category.name.lowercase().replaceFirstChar { it.uppercase() }}",
                        style = MaterialTheme.typography.labelSmall, color = PandaSubtext,
                    )
                }
                IconButton(onClick = onDuplicate) { Icon(Icons.Default.ContentCopy, stringResource(R.string.common_duplicate_cd), modifier = Modifier.size(18.dp)) }
                IconButton(onClick = onDelete) { Icon(Icons.Default.Delete, stringResource(R.string.common_delete_cd), modifier = Modifier.size(18.dp)) }
                IconButton(onClick = { expanded = !expanded }) {
                    Icon(if (expanded) Icons.Default.ExpandLess else Icons.Default.ExpandMore, stringResource(R.string.strength_detail_expand_toggle_cd))
                }
            }

            AnimatedVisibility(visible = expanded, enter = expandVertically(), exit = shrinkVertically()) {
                Column(modifier = Modifier.padding(horizontal = 16.dp)) {
                    Divider()
                    Spacer(Modifier.height(8.dp))

                    // En-têtes colonnes
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text(stringResource(R.string.strength_detail_col_serie), style = MaterialTheme.typography.labelSmall, modifier = Modifier.width(40.dp))
                        Text(stringResource(R.string.strength_detail_col_reps), style = MaterialTheme.typography.labelSmall, modifier = Modifier.weight(1f))
                        Text(stringResource(R.string.strength_detail_col_charge_kg), style = MaterialTheme.typography.labelSmall, modifier = Modifier.weight(1.5f))
                        Text(stringResource(R.string.strength_detail_col_rpe), style = MaterialTheme.typography.labelSmall, modifier = Modifier.weight(0.8f))
                        Spacer(Modifier.size(36.dp))
                    }
                    Spacer(Modifier.height(4.dp))

                    exercise.sets.forEachIndexed { setIndex, set ->
                        SetRow(
                            set = set,
                            onUpdate = { onUpdateSet(setIndex, it) },
                            onDelete = { onRemoveSet(setIndex) },
                            canDelete = exercise.sets.size > 1,
                        )
                    }

                    Spacer(Modifier.height(8.dp))
                    Button(
                        onClick = onAddSet,
                        modifier = Modifier.fillMaxWidth(),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = PandaPurple.copy(alpha = 0.1f),
                            contentColor = PandaPurple,
                        ),
                    ) {
                        Icon(Icons.Default.Add, null, modifier = Modifier.size(16.dp))
                        Text(stringResource(R.string.strength_detail_add_set_button))
                    }

                    // Notes exercise
                    Spacer(Modifier.height(8.dp))
                    OutlinedTextField(
                        value = exercise.notes,
                        onValueChange = { onUpdate(exercise.copy(notes = it)) },
                        label = { Text(stringResource(R.string.common_notes_label)) },
                        modifier = Modifier.fillMaxWidth(),
                        maxLines = 2,
                    )

                    // Repos entre séries
                    Spacer(Modifier.height(8.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                        Text(stringResource(R.string.strength_detail_rest_between_sets_label), style = MaterialTheme.typography.bodySmall, color = PandaSubtext)
                        OutlinedTextField(
                            value = exercise.restBetweenSetsSeconds.toString(),
                            onValueChange = { it.toIntOrNull()?.let { v -> onUpdate(exercise.copy(restBetweenSetsSeconds = v)) } },
                            label = { Text(stringResource(R.string.strength_detail_rest_sec_label)) },
                            modifier = Modifier.width(80.dp),
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                            singleLine = true,
                        )
                    }
                    Spacer(Modifier.height(12.dp))
                }
            }
        }
    }
}

@Composable
private fun SetRow(
    set: StrengthSetDraft,
    onUpdate: (StrengthSetDraft) -> Unit,
    onDelete: () -> Unit,
    canDelete: Boolean,
) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = "${set.setNumber}",
            style = MaterialTheme.typography.bodyMedium,
            fontWeight = FontWeight.Bold,
            color = PandaPurple,
            modifier = Modifier.width(40.dp),
        )
        OutlinedTextField(
            value = set.targetReps?.toString() ?: "",
            onValueChange = { onUpdate(set.copy(targetReps = it.toIntOrNull())) },
            modifier = Modifier.weight(1f),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
            singleLine = true,
        )
        OutlinedTextField(
            value = set.targetWeightKg?.toString() ?: "",
            onValueChange = { onUpdate(set.copy(targetWeightKg = it.toDoubleOrNull())) },
            modifier = Modifier.weight(1.5f),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
            singleLine = true,
        )
        OutlinedTextField(
            value = set.targetRpe?.toString() ?: "",
            onValueChange = { onUpdate(set.copy(targetRpe = it.toIntOrNull()?.coerceIn(1, 10))) },
            modifier = Modifier.weight(0.8f),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
            singleLine = true,
        )
        IconButton(onClick = onDelete, enabled = canDelete, modifier = Modifier.size(36.dp)) {
            Icon(Icons.Default.Delete, stringResource(R.string.common_delete_cd), modifier = Modifier.size(16.dp), tint = if (canDelete) MaterialTheme.colorScheme.error else PandaSubtext)
        }
    }
}

@Composable
private fun ExercisePickerSheet(
    exercises: List<ExerciseEntity>,
    onSelect: (ExerciseEntity) -> Unit,
    onDismiss: () -> Unit,
) {
    var query by remember { mutableStateOf("") }
    val filtered = remember(query, exercises) {
        if (query.isBlank()) exercises
        else exercises.filter { it.name.normalizeSearch().contains(query.normalizeSearch()) }
    }

    Column(modifier = Modifier.padding(16.dp)) {
        Text(stringResource(R.string.strength_detail_picker_title), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
        Spacer(Modifier.height(12.dp))
        OutlinedTextField(
            value = query, onValueChange = { query = it },
            label = { Text(stringResource(R.string.common_search_label)) }, modifier = Modifier.fillMaxWidth(), singleLine = true,
        )
        Spacer(Modifier.height(12.dp))
        if (filtered.isEmpty()) {
            Text(stringResource(R.string.strength_detail_picker_empty), style = MaterialTheme.typography.bodySmall, color = PandaSubtext)
        }
        filtered.take(30).forEach { exercise ->
            TextButton(
                onClick = { onSelect(exercise) },
                modifier = Modifier.fillMaxWidth(),
            ) {
                Icon(Icons.Default.FitnessCenter, null, tint = PandaPurple, modifier = Modifier.size(18.dp))
                Spacer(Modifier.padding(horizontal = 4.dp))
                Text(exercise.name, modifier = Modifier.weight(1f))
            }
            Divider()
        }
        Spacer(Modifier.height(24.dp))
    }
}

@Composable
private fun modeNameRes(mode: StrengthWorkoutMode) = when (mode) {
    StrengthWorkoutMode.CLASSIC -> stringResource(R.string.strength_mode_classic)
    StrengthWorkoutMode.SUPERSET -> stringResource(R.string.strength_mode_superset)
    StrengthWorkoutMode.CIRCUIT -> stringResource(R.string.strength_mode_circuit)
}
