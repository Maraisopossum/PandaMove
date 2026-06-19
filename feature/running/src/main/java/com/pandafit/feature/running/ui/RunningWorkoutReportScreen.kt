package com.pandafit.feature.running.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.res.stringResource
import androidx.lifecycle.Lifecycle
import com.pandafit.feature.running.R
import androidx.lifecycle.LifecycleEventObserver
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.pandafit.core.database.entities.RunEndType
import com.pandafit.core.database.entities.RunEndUnit
import com.pandafit.core.database.entities.RunRepeatEntity
import com.pandafit.core.database.entities.RunStepEntity
import com.pandafit.core.database.entities.RunStepType
import com.pandafit.core.database.entities.RunTargetType
import com.pandafit.designsystem.components.GpsTrackMapCard
import com.pandafit.designsystem.components.PandaCard
import com.pandafit.designsystem.components.PandaLoadingIndicator
import com.pandafit.designsystem.components.PandaTopBar
import com.pandafit.designsystem.theme.*
import com.pandafit.feature.running.viewmodel.RunReportItem
import com.pandafit.feature.running.viewmodel.RunningReportViewModel
import java.time.format.DateTimeFormatter
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RunningWorkoutReportScreen(
    workoutId: Long,
    onNavigateBack: () -> Unit,
    onNavigateToEdit: (Long) -> Unit,
    onNavigateToExecute: (Long) -> Unit,
    viewModel: RunningReportViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val scrollBehavior = TopAppBarDefaults.exitUntilCollapsedScrollBehavior(rememberTopAppBarState())

    // Recharger les données chaque fois que l'écran revient au premier plan
    val lifecycleOwner = LocalLifecycleOwner.current
    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) viewModel.reload()
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

    val workout = uiState.workout
    val isCompleted = workout?.isCompleted == true
    val isTemplate  = workout?.isTemplate == true

    Scaffold(
        modifier = Modifier.nestedScroll(scrollBehavior.nestedScrollConnection),
        topBar = {
            PandaTopBar(
                title = workout?.name ?: stringResource(R.string.running_report_title_fallback),
                onNavigateBack = onNavigateBack,
                scrollBehavior = scrollBehavior,
                actions = {
                    // Crayon : édition pour templates et séances planifiées ; modif résultats si terminée
                    val editCd = if (isCompleted) stringResource(R.string.running_report_edit_results_cd) else stringResource(R.string.running_report_edit_seance_cd)
                    IconButton(onClick = {
                        if (isTemplate || !isCompleted) onNavigateToEdit(workoutId)
                        else onNavigateToExecute(workoutId)
                    }) {
                        Icon(Icons.Default.Edit, editCd)
                    }
                },
            )
        },
        floatingActionButton = {
            if (!isTemplate && !isCompleted) {
                FloatingActionButton(onClick = { onNavigateToExecute(workoutId) }, containerColor = PandaGreen) {
                    Icon(Icons.Default.PlayArrow, stringResource(R.string.running_report_launch_cd), tint = Color.White)
                }
            }
        },
        containerColor = MaterialTheme.colorScheme.background,
    ) { innerPadding ->
        if (uiState.isLoading) { PandaLoadingIndicator(); return@Scaffold }

        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(innerPadding),
            contentPadding = PaddingValues(bottom = 88.dp),
        ) {
            // Carte en-tête
            item {
                PandaCard(modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp)) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text(
                            uiState.workout?.name ?: "",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                        )
                        if (uiState.workout?.notes?.isNotBlank() == true) {
                            Spacer(Modifier.height(4.dp))
                            Text(uiState.workout!!.notes, style = MaterialTheme.typography.bodySmall, color = PandaSubtext)
                        }
                    }
                }
            }

            // ── Résultats globaux (séances terminées) ──
            if (isCompleted && workout != null) {
                item {
                    GlobalResultsCard(workout = workout, modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp))
                }
            }

            // ── Tracé GPS (si disponible) ──
            if (uiState.gpsPoints.size >= 2) {
                item {
                    GpsTrackMapCard(
                        points = uiState.gpsPoints,
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(220.dp)
                            .padding(horizontal = 16.dp, vertical = 4.dp)
                            .clip(MaterialTheme.shapes.medium),
                    )
                }
            }

            if (uiState.items.isNotEmpty()) {
                item {
                    Text(
                        stringResource(R.string.running_report_steps_label),
                        style = MaterialTheme.typography.labelSmall,
                        color = PandaSubtext,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                    )
                }
                items(uiState.items, key = { item ->
                    when (item) {
                        is RunReportItem.Step   -> "step_${item.step.id}"
                        is RunReportItem.Repeat -> "repeat_${item.repeat.id}"
                    }
                }) { item ->
                    when (item) {
                        is RunReportItem.Step ->
                            StepReadRow(item.step, modifier = Modifier.padding(horizontal = 16.dp, vertical = 3.dp))
                        is RunReportItem.Repeat -> {
                            val reps = if (isCompleted) uiState.repeatResults[item.repeat.id] else null
                            RepeatReadBlock(
                                repeat   = item.repeat,
                                steps    = item.steps,
                                repResults = reps,
                                modifier = Modifier.padding(horizontal = 16.dp, vertical = 3.dp),
                            )
                        }
                    }
                }
            }

            // Note de séance (séances terminées)
            if (isCompleted && workout?.resultNotes?.isNotBlank() == true) {
                item {
                    Spacer(Modifier.height(8.dp))
                    Text(stringResource(R.string.running_report_session_note_label), style = MaterialTheme.typography.labelSmall, color = PandaSubtext, fontWeight = FontWeight.Bold, modifier = Modifier.padding(horizontal = 16.dp))
                    Spacer(Modifier.height(4.dp))
                    Text(workout!!.resultNotes, style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(horizontal = 16.dp))
                }
            }

            // Checkbox poussette
            item {
                Spacer(Modifier.height(8.dp))
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { viewModel.updateWithStroller(!uiState.withStroller) }
                        .padding(horizontal = 16.dp, vertical = 4.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Checkbox(
                        checked = uiState.withStroller,
                        onCheckedChange = viewModel::updateWithStroller,
                        colors = CheckboxDefaults.colors(checkedColor = PandaGreen),
                    )
                    Spacer(Modifier.width(8.dp))
                    Text(stringResource(R.string.running_report_with_stroller), style = MaterialTheme.typography.bodyMedium)
                }
            }

            item { Spacer(Modifier.height(88.dp)) }
        }
    }
}

// ── Ligne étape (lecture seule) ───────────────────────────────────────────────

@Composable
private fun StepReadRow(step: RunStepEntity, modifier: Modifier = Modifier) {
    val color = stepColor(step.stepType)
    Surface(
        modifier = modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.small,
        color = MaterialTheme.colorScheme.surface,
        tonalElevation = 1.dp,
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(modifier = Modifier.width(4.dp).height(52.dp).background(color))
            Column(modifier = Modifier.weight(1f).padding(horizontal = 12.dp, vertical = 8.dp)) {
                Text(stepLabel(step.stepType), style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.Bold, color = color)
                Text(endSummaryStep(step), style = MaterialTheme.typography.bodySmall, color = PandaSubtext)
                val target = targetSummary(step)
                if (target.isNotBlank()) Text(target, style = MaterialTheme.typography.bodySmall, color = PandaSubtext)
                step.note?.takeIf { it.isNotBlank() }?.let { Text(it, style = MaterialTheme.typography.bodySmall, color = PandaSubtext) }
            }
        }
    }
}

// ── Résultats globaux ─────────────────────────────────────────────────────────

@Composable
private fun GlobalResultsCard(
    workout: com.pandafit.core.database.entities.WorkoutEntity,
    modifier: Modifier = Modifier,
) {
    Surface(modifier = modifier.fillMaxWidth(), shape = MaterialTheme.shapes.medium, color = Color(0xFFF4F4F7)) {
        Column(modifier = Modifier.padding(14.dp)) {
            Text(stringResource(R.string.running_report_results_label), style = MaterialTheme.typography.labelSmall, color = PandaSubtext, fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(10.dp))
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                ResultCell(stringResource(R.string.running_report_cell_distance), workout.resultDistanceKm?.let { "$it km" } ?: "—", Modifier.weight(1f))
                ResultCell(stringResource(R.string.running_report_cell_time),     workout.resultDurationSec?.let { formatDurSec(it) } ?: "—", Modifier.weight(1f))
                ResultCell(stringResource(R.string.running_report_cell_pace),     workout.resultPaceAvgMinPerKm?.let { formatPaceDisplay(it) + "/km" } ?: "—", Modifier.weight(1f))
            }
            if (workout.resultHrAvg != null || workout.resultHrMax != null || workout.resultRpe != null || workout.resultElevationM != null) {
                Spacer(Modifier.height(8.dp))
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    ResultCell(stringResource(R.string.running_report_cell_hr_avg), workout.resultHrAvg?.let { "$it bpm" } ?: "—", Modifier.weight(1f))
                    ResultCell(stringResource(R.string.running_report_cell_hr_max), workout.resultHrMax?.let { "$it bpm" } ?: "—", Modifier.weight(1f))
                    ResultCell(stringResource(R.string.running_report_cell_rpe),    workout.resultRpe?.toString() ?: "—", Modifier.weight(1f))
                }
            }
            if (workout.resultElevationM != null || workout.resultCalories != null || workout.resultCadenceAvgRpm != null) {
                Spacer(Modifier.height(8.dp))
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    ResultCell(stringResource(R.string.running_report_cell_elevation), workout.resultElevationM?.let { "$it m" } ?: "—", Modifier.weight(1f))
                    ResultCell(stringResource(R.string.running_report_cell_calories),  workout.resultCalories?.let { "$it kcal" } ?: "—", Modifier.weight(1f))
                    ResultCell(stringResource(R.string.running_report_cell_cadence),   workout.resultCadenceAvgRpm?.let { "$it ppm" } ?: "—", Modifier.weight(1f))
                }
            }
        }
    }
}

@Composable
private fun ResultCell(label: String, value: String, modifier: Modifier = Modifier) {
    Column(
        modifier = modifier
            .background(Color.White, MaterialTheme.shapes.small)
            .padding(horizontal = 10.dp, vertical = 8.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(label, style = MaterialTheme.typography.labelSmall, color = PandaSubtext, textAlign = androidx.compose.ui.text.style.TextAlign.Center)
        Text(value, style = MaterialTheme.typography.bodySmall, fontWeight = FontWeight.Bold, textAlign = androidx.compose.ui.text.style.TextAlign.Center)
    }
}

private fun formatDurSec(sec: Int): String {
    val h = sec / 3600; val m = (sec % 3600) / 60; val s = sec % 60
    return if (h > 0) "$h:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}"
    else "$m:${s.toString().padStart(2,'0')}"
}

private fun formatPaceDisplay(d: Double): String {
    val m = d.toInt(); val s = ((d - m) * 60).toInt()
    return "$m:${s.toString().padStart(2,'0')}"
}

// ── Bloc répétition (lecture seule) ──────────────────────────────────────────

@Composable
private fun RepeatReadBlock(
    repeat: RunRepeatEntity,
    steps: List<RunStepEntity>,
    repResults: List<com.pandafit.core.database.model.IntervalRepResult>?,
    modifier: Modifier = Modifier,
) {
    val targetStep = steps.firstOrNull { it.stepType == RunStepType.RUNNING } ?: steps.firstOrNull()
    val intensityLabel = when {
        targetStep?.targetType == RunTargetType.PACE      -> "Allure"
        targetStep?.targetType == RunTargetType.HR_CUSTOM -> "FC"
        targetStep?.targetType == RunTargetType.CADENCE   -> "Cad."
        targetStep?.stepType   == RunStepType.RUNNING     -> "Allure"
        else -> null
    }

    Surface(modifier = modifier.fillMaxWidth(), shape = MaterialTheme.shapes.medium, color = PandaOrangeContainer) {
        Column(modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp)) {
            Text(stringResource(R.string.running_report_repeat_count, repeat.repeatCount), style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.ExtraBold, color = PandaOrange, modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp))
            steps.forEach { step ->
                StepReadRow(step, modifier = Modifier.padding(start = 12.dp, end = 8.dp, top = 2.dp, bottom = 2.dp))
            }
            // Tableau résultats par rep (séances terminées)
            if (!repResults.isNullOrEmpty()) {
                Spacer(Modifier.height(8.dp))
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 12.dp)
                        .background(Color(0xFFFFF8F0), MaterialTheme.shapes.small),
                ) {
                    Row(modifier = Modifier.fillMaxWidth().padding(horizontal = 10.dp, vertical = 6.dp)) {
                        Text(stringResource(R.string.running_table_col_num), style = MaterialTheme.typography.labelSmall, color = PandaSubtext, modifier = Modifier.width(28.dp))
                        Text(stringResource(R.string.running_table_col_temps), style = MaterialTheme.typography.labelSmall, color = PandaSubtext, modifier = Modifier.weight(1f), textAlign = androidx.compose.ui.text.style.TextAlign.Center)
                        if (intensityLabel != null) Text(intensityLabel, style = MaterialTheme.typography.labelSmall, color = PandaSubtext, modifier = Modifier.weight(1f), textAlign = androidx.compose.ui.text.style.TextAlign.Center)
                        Text(stringResource(R.string.running_table_col_rpe), style = MaterialTheme.typography.labelSmall, color = PandaSubtext, modifier = Modifier.width(32.dp), textAlign = androidx.compose.ui.text.style.TextAlign.Center)
                        Text(stringResource(R.string.running_table_col_check), style = MaterialTheme.typography.labelSmall, color = PandaSubtext, modifier = Modifier.width(24.dp), textAlign = androidx.compose.ui.text.style.TextAlign.Center)
                    }
                    repResults.forEach { rep ->
                        HorizontalDivider(color = Color(0xFFFFE0B2))
                        Row(modifier = Modifier.fillMaxWidth().padding(horizontal = 10.dp, vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                            Text("#${rep.repNumber}", style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold, color = PandaOrange, modifier = Modifier.width(28.dp))
                            Text(rep.timeStr.ifBlank { "—" }, style = MaterialTheme.typography.labelSmall, modifier = Modifier.weight(1f), textAlign = androidx.compose.ui.text.style.TextAlign.Center)
                            if (intensityLabel != null) Text(rep.actualIntensity.ifBlank { "—" }, style = MaterialTheme.typography.labelSmall, modifier = Modifier.weight(1f), textAlign = androidx.compose.ui.text.style.TextAlign.Center)
                            Text(rep.rpeStr.ifBlank { "—" }, style = MaterialTheme.typography.labelSmall, modifier = Modifier.width(32.dp), textAlign = androidx.compose.ui.text.style.TextAlign.Center)
                            Text(if (rep.done) "✓" else "·", style = MaterialTheme.typography.labelSmall, color = if (rep.done) PandaPurple else PandaSubtext, modifier = Modifier.width(24.dp), textAlign = androidx.compose.ui.text.style.TextAlign.Center)
                        }
                    }
                }
                Spacer(Modifier.height(4.dp))
            }
        }
    }
}

// ── Helpers affichage ─────────────────────────────────────────────────────────

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

private fun endSummaryStep(step: RunStepEntity): String {
    if (step.endValue == 0) return "—"
    return when (step.endType) {
        RunEndType.DURATION -> {
            val m = step.endValue / 60; val s = step.endValue % 60
            "$m:${s.toString().padStart(2, '0')}"
        }
        RunEndType.DISTANCE -> "${step.endValue} ${if (step.endUnit == RunEndUnit.METERS) "m" else "km"}"
    }
}

private fun targetSummary(step: RunStepEntity): String = when (step.targetType) {
    RunTargetType.NONE      -> ""
    RunTargetType.PACE      -> buildString {
        val minStr = step.targetMin?.let { s -> "${s / 60}:${(s % 60).toString().padStart(2, '0')}/km" } ?: ""
        val maxStr = step.targetMax?.let { s -> "${s / 60}:${(s % 60).toString().padStart(2, '0')}/km" } ?: ""
        if (minStr.isNotBlank() && maxStr.isNotBlank()) append("Allure $minStr → $maxStr")
        else if (minStr.isNotBlank()) append("Allure $minStr")
    }
    RunTargetType.CADENCE   -> {
        val min = step.targetMin; val max = step.targetMax
        if (min != null && max != null) "Cadence $min–$max spm" else ""
    }
    RunTargetType.HR_ZONE   -> if (step.targetMin != null) "Zone FC Z${step.targetMin}" else ""
    RunTargetType.HR_CUSTOM -> {
        val min = step.targetMin; val max = step.targetMax
        if (min != null && max != null) "FC $min–$max bpm" else ""
    }
}

