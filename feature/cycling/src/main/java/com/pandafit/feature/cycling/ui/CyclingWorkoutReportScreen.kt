package com.pandafit.feature.cycling.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.DirectionsBike
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.pandafit.core.database.entities.BlockType
import com.pandafit.core.database.entities.WorkoutBlockEntity
import com.pandafit.core.database.entities.WorkoutEntity
import com.pandafit.designsystem.components.GpsTrackMapCard
import com.pandafit.designsystem.components.PandaLoadingIndicator
import com.pandafit.designsystem.components.PandaTopBar
import com.pandafit.designsystem.theme.PandaBlue
import com.pandafit.designsystem.theme.PandaSubtext
import com.pandafit.feature.cycling.R
import com.pandafit.feature.cycling.viewmodel.CyclingReportViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CyclingWorkoutReportScreen(
    workoutId: Long,
    onNavigateBack: () -> Unit,
    onNavigateToEdit: (Long) -> Unit,
    onNavigateToExecute: (Long) -> Unit,
    viewModel: CyclingReportViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val scrollBehavior = TopAppBarDefaults.exitUntilCollapsedScrollBehavior(rememberTopAppBarState())

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
    val isTemplate  = workout?.isTemplate  == true

    Scaffold(
        modifier = Modifier.nestedScroll(scrollBehavior.nestedScrollConnection),
        topBar = {
            PandaTopBar(
                title = workout?.name ?: stringResource(R.string.cycling_report_title_fallback),
                onNavigateBack = onNavigateBack,
                scrollBehavior = scrollBehavior,
                containerColor = PandaBlue,
                contentColor = Color.White,
                actions = {
                    IconButton(onClick = {
                        if (isTemplate || !isCompleted) onNavigateToEdit(workoutId)
                        else onNavigateToExecute(workoutId)
                    }) {
                        Icon(Icons.Default.Edit, if (isCompleted) stringResource(R.string.cycling_report_edit_results_cd) else stringResource(R.string.cycling_report_edit_seance_cd))
                    }
                },
            )
        },
        floatingActionButton = {
            if (!isTemplate && !isCompleted) {
                FloatingActionButton(
                    onClick = { onNavigateToExecute(workoutId) },
                    containerColor = PandaBlue,
                ) {
                    Icon(Icons.Default.PlayArrow, stringResource(R.string.cycling_report_encode_cd), tint = Color.White)
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
            // ── En-tête ──────────────────────────────────────────────────────
            item {
                Surface(
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
                    shape = MaterialTheme.shapes.medium,
                    color = MaterialTheme.colorScheme.surface,
                    tonalElevation = 1.dp,
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text(
                            workout?.name ?: "",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                        )
                        if (workout?.objective?.isNotBlank() == true) {
                            Spacer(Modifier.height(4.dp))
                            Text(workout.objective, style = MaterialTheme.typography.bodySmall, color = PandaBlue)
                        }
                        if (workout?.notes?.isNotBlank() == true) {
                            Spacer(Modifier.height(2.dp))
                            Text(workout.notes, style = MaterialTheme.typography.bodySmall, color = PandaSubtext)
                        }
                    }
                }
            }

            // ── Résultats globaux (séances terminées) ─────────────────────────
            if (isCompleted && workout != null) {
                item {
                    CyclingGlobalResultsCard(
                        workout = workout,
                        modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp),
                    )
                }
            }

            // ── Tracé GPS ────────────────────────────────────────────────────
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

            // ── Blocs de la séance ────────────────────────────────────────────
            if (uiState.blocks.isNotEmpty()) {
                item {
                    Text(
                        stringResource(R.string.cycling_report_section_blocks),
                        style = MaterialTheme.typography.labelSmall,
                        color = PandaSubtext,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                    )
                }
                items(uiState.blocks, key = { "block_${it.id}" }) { block ->
                    CyclingBlockReadRow(
                        block = block,
                        modifier = Modifier.padding(horizontal = 16.dp, vertical = 3.dp),
                    )
                }
            }
        }
    }
}

// ── Carte résultats globaux cycling ──────────────────────────────────────────

@Composable
private fun CyclingGlobalResultsCard(
    workout: WorkoutEntity,
    modifier: Modifier = Modifier,
) {
    Surface(modifier = modifier.fillMaxWidth(), shape = MaterialTheme.shapes.medium, color = Color(0xFFF0F4FF)) {
        Column(modifier = Modifier.padding(14.dp)) {
            Text(stringResource(R.string.cycling_report_section_results), style = MaterialTheme.typography.labelSmall, color = PandaSubtext, fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(10.dp))

            // Ligne 1 : Distance / Durée / Vitesse moy
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                CyclingResultCell(stringResource(R.string.cycling_report_cell_distance), workout.resultDistanceKm?.let { "%.1f km".format(it) } ?: "—", Modifier.weight(1f))
                CyclingResultCell(stringResource(R.string.cycling_report_cell_time),     workout.resultDurationSec?.let { formatDurSec(it) } ?: "—",    Modifier.weight(1f))
                CyclingResultCell(stringResource(R.string.cycling_report_cell_speed_avg), workout.resultSpeedAvgKmh?.let { "%.1f km/h".format(it) } ?: "—", Modifier.weight(1f))
            }

            // Ligne 2 : Vitesse max / FC moy / FC max (si présents)
            val hasLine2 = workout.resultSpeedMaxKmh != null || workout.resultHrAvg != null || workout.resultHrMax != null
            if (hasLine2) {
                Spacer(Modifier.height(8.dp))
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    CyclingResultCell(stringResource(R.string.cycling_report_cell_speed_max), workout.resultSpeedMaxKmh?.let { "%.1f km/h".format(it) } ?: "—", Modifier.weight(1f))
                    CyclingResultCell(stringResource(R.string.cycling_report_cell_hr_avg),    workout.resultHrAvg?.let { "$it bpm" } ?: "—",   Modifier.weight(1f))
                    CyclingResultCell(stringResource(R.string.cycling_report_cell_hr_max),    workout.resultHrMax?.let { "$it bpm" } ?: "—",   Modifier.weight(1f))
                }
            }

            // Ligne 3 : Cadence / Dénivelé / Calories / RPE (si au moins un présent)
            val hasLine3 = workout.resultCadenceAvgRpm != null || workout.resultElevationM != null
                || workout.resultCalories != null || workout.resultRpe != null
            if (hasLine3) {
                Spacer(Modifier.height(8.dp))
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    CyclingResultCell(stringResource(R.string.cycling_report_cell_cadence),   workout.resultCadenceAvgRpm?.let { "$it rpm" } ?: "—", Modifier.weight(1f))
                    CyclingResultCell(stringResource(R.string.cycling_report_cell_elevation), workout.resultElevationM?.let { "$it m" } ?: "—",       Modifier.weight(1f))
                    CyclingResultCell(stringResource(R.string.cycling_report_cell_calories),  workout.resultCalories?.let { "$it kcal" } ?: "—",      Modifier.weight(1f))
                }
                if (workout.resultRpe != null) {
                    Spacer(Modifier.height(8.dp))
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        CyclingResultCell(stringResource(R.string.cycling_report_cell_rpe), workout.resultRpe.toString(), Modifier.weight(1f))
                        Spacer(Modifier.weight(1f))
                        Spacer(Modifier.weight(1f))
                    }
                }
            }

            // Note de séance
            if (workout.resultNotes.isNotBlank()) {
                Spacer(Modifier.height(10.dp))
                Text(
                    workout.resultNotes,
                    style = MaterialTheme.typography.bodySmall,
                    color = PandaSubtext,
                )
            }
        }
    }
}

@Composable
private fun CyclingResultCell(label: String, value: String, modifier: Modifier = Modifier) {
    Column(
        modifier = modifier
            .background(Color.White, MaterialTheme.shapes.small)
            .padding(horizontal = 10.dp, vertical = 8.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(label, style = MaterialTheme.typography.labelSmall, color = PandaSubtext, textAlign = TextAlign.Center)
        Text(value, style = MaterialTheme.typography.bodySmall, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center)
    }
}

// ── Ligne bloc (lecture seule) ────────────────────────────────────────────────

@Composable
private fun CyclingBlockReadRow(block: WorkoutBlockEntity, modifier: Modifier = Modifier) {
    val color = blockColor(block.blockType)
    Surface(
        modifier = modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.small,
        color = MaterialTheme.colorScheme.surface,
        tonalElevation = 1.dp,
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(modifier = Modifier.width(4.dp).height(52.dp).background(color))
            Column(modifier = Modifier.weight(1f).padding(horizontal = 12.dp, vertical = 8.dp)) {
                Text(block.name.ifBlank { blockLabel(block.blockType) }, style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.Bold, color = color)
                Text(blockSummary(block), style = MaterialTheme.typography.bodySmall, color = PandaSubtext)
            }
        }
    }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

private fun blockLabel(type: BlockType) = when (type) {
    BlockType.WARMUP   -> "Échauffement"
    BlockType.MAIN     -> "Bloc principal"
    BlockType.INTERVAL -> "Intervalles"
    BlockType.COOLDOWN -> "Retour au calme"
    BlockType.CUSTOM   -> "Bloc"
}

private fun blockColor(type: BlockType): Color = when (type) {
    BlockType.WARMUP   -> Color(0xFFE57373)
    BlockType.MAIN     -> PandaBlue
    BlockType.INTERVAL -> Color(0xFFFF7043)
    BlockType.COOLDOWN -> Color(0xFF66BB6A)
    BlockType.CUSTOM   -> Color(0xFFAB47BC)
}

private fun blockSummary(block: WorkoutBlockEntity): String = buildString {
    block.durationMinutes?.let { append("${it} min") }
    block.distanceKm?.let { if (isNotEmpty()) append(" · "); append("%.1f km".format(it)) }
    block.targetPowerWatts?.let { if (isNotEmpty()) append(" · "); append("${it} W") }
    block.targetCadenceRpm?.let { if (isNotEmpty()) append(" · "); append("${it} rpm") }
    block.targetHeartRateBpm?.let { if (isNotEmpty()) append(" · "); append("${it} bpm") }
    block.repetitions?.let { reps ->
        block.recoveryMinutes?.let { rec ->
            if (isNotEmpty()) append(" · ")
            append("${reps}×, récup. ${rec} min")
        }
    }
    if (isBlank() && block.notes.isNotBlank()) append(block.notes)
}

private fun formatDurSec(sec: Int): String {
    val h = sec / 3600; val m = (sec % 3600) / 60; val s = sec % 60
    return if (h > 0) "$h:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}"
    else "$m:${s.toString().padStart(2, '0')}"
}
