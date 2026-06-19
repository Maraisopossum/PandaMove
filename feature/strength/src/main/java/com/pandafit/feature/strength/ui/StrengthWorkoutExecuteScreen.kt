package com.pandafit.feature.strength.ui

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
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Flag
import androidx.compose.material.icons.filled.FitnessCenter
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Divider
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.pandafit.feature.strength.R
import com.pandafit.designsystem.components.PandaCard
import com.pandafit.designsystem.components.PandaLoadingIndicator
import com.pandafit.designsystem.components.PandaTopBar
import com.pandafit.designsystem.theme.PandaPurple
import com.pandafit.designsystem.theme.PandaSubtext
import com.pandafit.feature.strength.model.StrengthExerciseExecution
import com.pandafit.feature.strength.model.StrengthSetDraft
import com.pandafit.feature.strength.viewmodel.StrengthExecuteViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun StrengthWorkoutExecuteScreen(
    workoutId: Long,
    onNavigateBack: () -> Unit,
    viewModel: StrengthExecuteViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

    Scaffold(
        topBar = {
            PandaTopBar(
                title = uiState.workout?.name ?: stringResource(R.string.strength_execute_title_fallback),
                onNavigateBack = onNavigateBack,
            )
        },
        containerColor = MaterialTheme.colorScheme.background,
    ) { innerPadding ->
        if (uiState.isLoading) {
            PandaLoadingIndicator()
            return@Scaffold
        }

        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(innerPadding),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            itemsIndexed(uiState.exercises) { exIdx, execution ->
                StrengthExecutionExerciseCard(
                    execution = execution,
                    isActive = exIdx == uiState.currentExerciseIndex,
                    onSetComplete = { setIdx, set ->
                        viewModel.completeSet(exIdx, setIdx, set)
                    },
                )
            }

            if (uiState.isCompleted) {
                item {
                    Button(
                        onClick = { viewModel.finishWorkout(); onNavigateBack() },
                        modifier = Modifier.fillMaxWidth(),
                        colors = ButtonDefaults.buttonColors(containerColor = PandaPurple),
                    ) {
                        Icon(Icons.Default.Flag, null)
                        Text(stringResource(R.string.strength_execute_finish_button))
                    }
                }
            }
        }
    }
}

@Composable
private fun StrengthExecutionExerciseCard(
    execution: StrengthExerciseExecution,
    isActive: Boolean,
    onSetComplete: (Int, StrengthSetDraft) -> Unit,
) {
    PandaCard(
        modifier = Modifier.fillMaxWidth(),
        containerColor = if (isActive) PandaPurple.copy(alpha = 0.06f) else MaterialTheme.colorScheme.surface,
        elevation = if (isActive) 3.dp else 1.dp,
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Default.FitnessCenter, null, tint = PandaPurple, modifier = Modifier.size(20.dp))
                Spacer(Modifier.padding(horizontal = 6.dp))
                Column(modifier = Modifier.weight(1f)) {
                    Text(execution.draft.exercise.name, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                    Text(stringResource(R.string.strength_execute_exercise_sets_count, execution.draft.sets.size), style = MaterialTheme.typography.labelSmall, color = PandaSubtext)
                }
                if (execution.isCompleted) {
                    Icon(Icons.Default.CheckCircle, stringResource(R.string.strength_execute_exercise_completed_cd), tint = PandaPurple)
                }
            }

            if (isActive) {
                Spacer(Modifier.height(12.dp))
                Divider()
                Spacer(Modifier.height(8.dp))

                // En-têtes
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("#", style = MaterialTheme.typography.labelSmall, modifier = Modifier.width(30.dp))
                    Text(stringResource(R.string.strength_execute_col_target), style = MaterialTheme.typography.labelSmall, modifier = Modifier.weight(1f))
                    Text(stringResource(R.string.strength_execute_col_actual_reps), style = MaterialTheme.typography.labelSmall, modifier = Modifier.weight(1f))
                    Text(stringResource(R.string.strength_execute_col_actual_charge), style = MaterialTheme.typography.labelSmall, modifier = Modifier.weight(1f))
                    Spacer(Modifier.size(48.dp))
                }

                execution.draft.sets.forEachIndexed { setIdx, set ->
                    ExecutionSetRow(
                        set = set,
                        isCompleted = execution.completedSets.any { it.setNumber == set.setNumber },
                        onComplete = { updatedSet -> onSetComplete(setIdx, updatedSet) },
                    )
                }
            }
        }
    }
}

@Composable
private fun ExecutionSetRow(
    set: StrengthSetDraft,
    isCompleted: Boolean,
    onComplete: (StrengthSetDraft) -> Unit,
) {
    var actualReps by remember(set.setNumber) { mutableStateOf(set.actualReps?.toString() ?: "") }
    var actualWeight by remember(set.setNumber) { mutableStateOf(set.actualWeightKg?.toString() ?: "") }

    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            "${set.setNumber}",
            style = MaterialTheme.typography.bodySmall,
            fontWeight = FontWeight.Bold,
            color = PandaPurple,
            modifier = Modifier.width(30.dp),
        )
        Text(
            "${set.targetReps ?: "?"} × ${set.targetWeightKg ?: "?"}kg",
            style = MaterialTheme.typography.bodySmall,
            color = PandaSubtext,
            modifier = Modifier.weight(1f),
        )
        OutlinedTextField(
            value = actualReps,
            onValueChange = { actualReps = it },
            modifier = Modifier.weight(1f),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
            singleLine = true,
            enabled = !isCompleted,
        )
        OutlinedTextField(
            value = actualWeight,
            onValueChange = { actualWeight = it },
            modifier = Modifier.weight(1f),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
            singleLine = true,
            enabled = !isCompleted,
        )
        androidx.compose.material3.IconButton(
            onClick = {
                onComplete(
                    set.copy(
                        actualReps = actualReps.toIntOrNull(),
                        actualWeightKg = actualWeight.toDoubleOrNull(),
                        isCompleted = true,
                    )
                )
            },
            enabled = !isCompleted,
            modifier = Modifier.size(48.dp),
        ) {
            Icon(
                Icons.Default.CheckCircle,
                stringResource(R.string.strength_execute_set_validate_cd),
                tint = if (isCompleted) PandaPurple else PandaSubtext,
            )
        }
    }
}

// Required import for remember
@Composable
private fun <T> remember(key1: Any?, key2: Any? = null, calculation: () -> T) =
    androidx.compose.runtime.remember(key1, key2, calculation = calculation)
