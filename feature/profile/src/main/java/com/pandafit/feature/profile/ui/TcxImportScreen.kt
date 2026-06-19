package com.pandafit.feature.profile.ui

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
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
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.DirectionsBike
import androidx.compose.material.icons.filled.DirectionsRun
import androidx.compose.material.icons.filled.Landscape
import androidx.compose.material.icons.filled.Error
import androidx.compose.material.icons.filled.FileOpen
import androidx.compose.material.icons.filled.RadioButtonChecked
import androidx.compose.material.icons.filled.RadioButtonUnchecked
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.pandafit.core.database.entities.WorkoutEntity
import com.pandafit.core.database.entities.WorkoutType
import com.pandafit.designsystem.components.PandaCard
import com.pandafit.designsystem.theme.KalyptusGreen
import com.pandafit.designsystem.theme.PandaSubtext
import com.pandafit.feature.profile.R
import com.pandafit.feature.profile.viewmodel.TcxImportMode
import com.pandafit.feature.profile.viewmodel.TcxImportStep
import com.pandafit.feature.profile.viewmodel.TcxImportViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TcxImportScreen(
    onNavigateBack: () -> Unit,
    onNavigateToWorkout: ((workoutId: Long, workoutType: WorkoutType) -> Unit)? = null,
    viewModel: TcxImportViewModel = hiltViewModel(),
) {
    val step by viewModel.step.collectAsStateWithLifecycle()
    val context = LocalContext.current

    val fileLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetContent()
    ) { uri ->
        uri ?: return@rememberLauncherForActivityResult
        val bytes = context.contentResolver.openInputStream(uri)?.readBytes()
            ?: return@rememberLauncherForActivityResult
        viewModel.onFilePicked(bytes)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.tcx_screen_title)) },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = stringResource(R.string.tcx_back_cd))
                    }
                },
            )
        },
        containerColor = MaterialTheme.colorScheme.background,
    ) { innerPadding ->

        when (val s = step) {

            // ── Idle ──────────────────────────────────────────────────────────
            is TcxImportStep.Idle -> {
                IdleContent(
                    modifier = Modifier.padding(innerPadding),
                    onPickFile = { fileLauncher.launch("*/*") },
                )
            }

            // ── Parsing / Importing ───────────────────────────────────────────
            is TcxImportStep.Parsing, is TcxImportStep.Importing -> {
                val label = if (s is TcxImportStep.Parsing) stringResource(R.string.tcx_parsing_label) else stringResource(R.string.tcx_importing_label)
                LoadingContent(modifier = Modifier.padding(innerPadding), label = label)
            }

            // ── Preview ───────────────────────────────────────────────────────
            is TcxImportStep.Preview -> {
                PreviewContent(
                    preview  = s,
                    modifier = Modifier.padding(innerPadding),
                    onUpdateName          = viewModel::updateName,
                    onUpdateType          = viewModel::updateType,
                    onUpdateMode          = viewModel::updateMode,
                    onUpdateTargetWorkout = viewModel::updateTargetWorkout,
                    onUpdateWithStroller  = viewModel::updateWithStroller,
                    onConfirm             = viewModel::confirm,
                    onPickAnother         = { viewModel.reset(); fileLauncher.launch("*/*") },
                )
            }

            // ── Done ──────────────────────────────────────────────────────────
            is TcxImportStep.Done -> {
                DoneContent(
                    result   = s,
                    modifier = Modifier.padding(innerPadding),
                    onImportAnother    = viewModel::reset,
                    onBack             = onNavigateBack,
                    onNavigateToWorkout = onNavigateToWorkout?.let { cb ->
                        { cb(s.result.workoutId, s.result.workoutType) }
                    },
                )
            }

            // ── Error ─────────────────────────────────────────────────────────
            is TcxImportStep.Failure -> {
                ErrorContent(
                    message  = s.message,
                    modifier = Modifier.padding(innerPadding),
                    onRetry  = viewModel::reset,
                )
            }
        }
    }
}

// ── Idle ──────────────────────────────────────────────────────────────────────

@Composable
private fun IdleContent(modifier: Modifier, onPickFile: () -> Unit) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Icon(
            Icons.Default.FileOpen,
            contentDescription = null,
            modifier = Modifier.size(64.dp),
            tint = KalyptusGreen,
        )
        Spacer(Modifier.height(24.dp))
        Text(
            stringResource(R.string.tcx_idle_title),
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.Bold,
        )
        Spacer(Modifier.height(8.dp))
        Text(
            stringResource(R.string.tcx_idle_description),
            style = MaterialTheme.typography.bodyMedium,
            color = PandaSubtext,
            textAlign = androidx.compose.ui.text.style.TextAlign.Center,
        )
        Spacer(Modifier.height(32.dp))
        Button(
            onClick = onPickFile,
            colors = ButtonDefaults.buttonColors(containerColor = KalyptusGreen),
            modifier = Modifier.fillMaxWidth(0.7f),
        ) {
            Icon(Icons.Default.FileOpen, null, modifier = Modifier.size(18.dp))
            Spacer(Modifier.width(8.dp))
            Text(stringResource(R.string.tcx_pick_file_button))
        }
    }
}

// ── Loading ───────────────────────────────────────────────────────────────────

@Composable
private fun LoadingContent(modifier: Modifier, label: String) {
    Box(
        modifier = modifier.fillMaxSize(),
        contentAlignment = Alignment.Center,
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(16.dp)) {
            CircularProgressIndicator(color = KalyptusGreen)
            Text(label, style = MaterialTheme.typography.bodyMedium, color = PandaSubtext)
        }
    }
}

// ── Preview ───────────────────────────────────────────────────────────────────

@Composable
private fun PreviewContent(
    preview: TcxImportStep.Preview,
    modifier: Modifier,
    onUpdateName: (String) -> Unit,
    onUpdateType: (WorkoutType) -> Unit,
    onUpdateMode: (TcxImportMode) -> Unit,
    onUpdateTargetWorkout: (Long?) -> Unit,
    onUpdateWithStroller: (Boolean) -> Unit,
    onConfirm: () -> Unit,
    onPickAnother: () -> Unit,
) {
    val a = preview.activity
    val isSpeedBased = preview.workoutType == WorkoutType.CYCLING || preview.workoutType == WorkoutType.HIKING

    // Computed global stats for display
    val distKm   = a.totalDistanceM / 1000.0
    val durMin   = a.totalDurationSec.toInt() / 60
    val durSec   = a.totalDurationSec.toInt() % 60
    val speedOrPaceLabel = if (isSpeedBased) "Vitesse moy." else "Allure moy."
    val speedOrPaceStr = if (a.totalDistanceM > 1) {
        if (isSpeedBased) {
            val speedKmh = (a.totalDistanceM / 1000.0) / (a.totalDurationSec / 3600.0)
            "%.1f km/h".format(speedKmh)
        } else {
            val paceMinKm = (a.totalDurationSec / 60.0) / (a.totalDistanceM / 1000.0)
            val pm = paceMinKm.toInt(); val ps = ((paceMinKm - pm) * 60).toInt()
            "$pm:${ps.toString().padStart(2, '0')}/km"
        }
    } else "—"

    LazyColumn(
        modifier = modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {

        // ── Global stats card ──────────────────────────────────────────────
        item {
            Text(stringResource(R.string.tcx_preview_title), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
            Spacer(Modifier.height(8.dp))
            PandaCard(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    StatRow(stringResource(R.string.tcx_stat_distance), "%.2f km".format(distKm))
                    StatRow(stringResource(R.string.tcx_stat_duration), "%d:%02d".format(durMin, durSec))
                    StatRow(speedOrPaceLabel, speedOrPaceStr)
                    if (a.avgHrBpm != null) StatRow(stringResource(R.string.tcx_stat_avg_hr), "${a.avgHrBpm} bpm")
                    if (a.maxHrBpm != null) StatRow(stringResource(R.string.tcx_stat_max_hr), "${a.maxHrBpm} bpm")
                    if (a.elevationGainM != null) StatRow(stringResource(R.string.tcx_stat_elevation), "${a.elevationGainM} m")
                    StatRow(stringResource(R.string.tcx_stat_splits), "${a.laps.size} lap${if (a.laps.size > 1) "s" else ""}")
                    StatRow(stringResource(R.string.tcx_stat_gps_points), "${a.rawTrackPoints.size} bruts → ~${estimateSimplified(a.rawTrackPoints.size)} après simplification")
                }
            }
        }

        // ── Sport type ─────────────────────────────────────────────────────
        item {
            Text(stringResource(R.string.tcx_sport_type_title), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
            Spacer(Modifier.height(8.dp))
            PandaCard(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.selectableGroup()) {
                    listOf(
                        Triple(WorkoutType.RUNNING, stringResource(R.string.tcx_sport_running), Icons.Default.DirectionsRun),
                        Triple(WorkoutType.CYCLING, stringResource(R.string.tcx_sport_cycling), Icons.Default.DirectionsBike),
                        Triple(WorkoutType.HIKING,  stringResource(R.string.tcx_sport_hiking),  Icons.Default.Landscape),
                    ).forEachIndexed { index, (type, label, icon) ->
                        if (index > 0) HorizontalDivider(modifier = Modifier.padding(horizontal = 16.dp))
                        val selected = preview.workoutType == type
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .selectable(selected = selected, role = Role.RadioButton, onClick = { onUpdateType(type) })
                                .padding(horizontal = 16.dp, vertical = 12.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(12.dp),
                        ) {
                            RadioButton(selected = selected, onClick = null)
                            Icon(icon, null, modifier = Modifier.size(20.dp), tint = if (selected) KalyptusGreen else PandaSubtext)
                            Text(label, style = MaterialTheme.typography.bodyMedium, fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Normal)
                        }
                    }
                }
            }
        }

        // ── Import mode ────────────────────────────────────────────────────
        item {
            Text(stringResource(R.string.tcx_import_as_title), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
            Spacer(Modifier.height(8.dp))
            PandaCard(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(4.dp)) {
                    ImportModeRow(
                        label    = stringResource(R.string.tcx_mode_new_label),
                        subtitle = stringResource(R.string.tcx_mode_new_subtitle),
                        selected = preview.mode == TcxImportMode.NEW,
                        onClick  = { onUpdateMode(TcxImportMode.NEW) },
                    )
                    HorizontalDivider(modifier = Modifier.padding(horizontal = 16.dp))
                    ImportModeRow(
                        label    = stringResource(R.string.tcx_mode_existing_label),
                        subtitle = if (preview.plannedWorkouts.isEmpty())
                            stringResource(R.string.tcx_mode_no_planned)
                        else
                            "${preview.plannedWorkouts.size} séance${if (preview.plannedWorkouts.size > 1) "s" else ""} disponible${if (preview.plannedWorkouts.size > 1) "s" else ""}",
                        selected = preview.mode == TcxImportMode.EXISTING,
                        enabled  = preview.plannedWorkouts.isNotEmpty(),
                        onClick  = { onUpdateMode(TcxImportMode.EXISTING) },
                    )
                }
            }
        }

        // ── Planned workouts picker (only when EXISTING) ───────────────────
        if (preview.mode == TcxImportMode.EXISTING && preview.plannedWorkouts.isNotEmpty()) {
            item {
                Text(stringResource(R.string.tcx_choose_session_title), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                Spacer(Modifier.height(8.dp))
            }
            items(preview.plannedWorkouts) { workout ->
                PlannedWorkoutRow(
                    workout  = workout,
                    selected = workout.id == preview.targetWorkoutId,
                    onClick  = { onUpdateTargetWorkout(workout.id) },
                )
            }
        }

        // ── Name field (only for NEW) ──────────────────────────────────────
        if (preview.mode == TcxImportMode.NEW) {
            item {
                OutlinedTextField(
                    value         = preview.name,
                    onValueChange = onUpdateName,
                    label         = { Text(stringResource(R.string.tcx_session_name_label)) },
                    singleLine    = true,
                    modifier      = Modifier.fillMaxWidth(),
                )
            }
        }

        // ── Avec la poussette (RUNNING uniquement) ────────────────────────
        if (preview.workoutType == WorkoutType.RUNNING) {
            item {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { onUpdateWithStroller(!preview.withStroller) }
                        .padding(vertical = 4.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Checkbox(
                        checked = preview.withStroller,
                        onCheckedChange = onUpdateWithStroller,
                        colors = CheckboxDefaults.colors(checkedColor = KalyptusGreen),
                    )
                    Spacer(Modifier.width(8.dp))
                    Text(stringResource(R.string.tcx_with_stroller), style = MaterialTheme.typography.bodyMedium)
                }
            }
        }

        // ── Confirm / pick another ─────────────────────────────────────────
        item {
            val canConfirm = when (preview.mode) {
                TcxImportMode.NEW      -> preview.name.isNotBlank()
                TcxImportMode.EXISTING -> preview.targetWorkoutId != null
            }
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(
                    onClick  = onConfirm,
                    enabled  = canConfirm,
                    modifier = Modifier.fillMaxWidth(),
                    colors   = ButtonDefaults.buttonColors(containerColor = KalyptusGreen),
                ) { Text(stringResource(R.string.tcx_import_button)) }
                androidx.compose.material3.OutlinedButton(
                    onClick  = onPickAnother,
                    modifier = Modifier.fillMaxWidth(),
                ) { Text(stringResource(R.string.tcx_pick_another_button)) }
            }
            Spacer(Modifier.height(16.dp))
        }
    }
}

// ── Done ──────────────────────────────────────────────────────────────────────

@Composable
private fun DoneContent(
    result: TcxImportStep.Done,
    modifier: Modifier,
    onImportAnother: () -> Unit,
    onBack: () -> Unit,
    onNavigateToWorkout: (() -> Unit)? = null,
) {
    Column(
        modifier = modifier.fillMaxSize().padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Icon(Icons.Default.CheckCircle, null, modifier = Modifier.size(64.dp), tint = KalyptusGreen)
        Spacer(Modifier.height(24.dp))
        Text(stringResource(R.string.tcx_done_title), style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(12.dp))
        Text(
            "${result.result.lapsImported} split${if (result.result.lapsImported > 1) "s" else ""} · ${result.result.gpsPointsImported} points GPS",
            style = MaterialTheme.typography.bodyMedium,
            color = PandaSubtext,
        )
        Spacer(Modifier.height(32.dp))
        if (onNavigateToWorkout != null) {
            Button(
                onClick  = onNavigateToWorkout,
                modifier = Modifier.fillMaxWidth(0.7f),
                colors   = ButtonDefaults.buttonColors(containerColor = KalyptusGreen),
            ) { Text(stringResource(R.string.tcx_view_session_button)) }
            Spacer(Modifier.height(8.dp))
        }
        Button(
            onClick  = onBack,
            modifier = Modifier.fillMaxWidth(0.7f),
            colors   = ButtonDefaults.buttonColors(containerColor = if (onNavigateToWorkout != null) MaterialTheme.colorScheme.secondary else KalyptusGreen),
        ) { Text(stringResource(R.string.tcx_back_to_profile_button)) }
        Spacer(Modifier.height(8.dp))
        androidx.compose.material3.OutlinedButton(
            onClick  = onImportAnother,
            modifier = Modifier.fillMaxWidth(0.7f),
        ) { Text(stringResource(R.string.tcx_import_another_button)) }
    }
}

// ── Error ─────────────────────────────────────────────────────────────────────

@Composable
private fun ErrorContent(message: String, modifier: Modifier, onRetry: () -> Unit) {
    Column(
        modifier = modifier.fillMaxSize().padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Icon(Icons.Default.Error, null, modifier = Modifier.size(64.dp), tint = MaterialTheme.colorScheme.error)
        Spacer(Modifier.height(24.dp))
        Text(stringResource(R.string.tcx_error_title), style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(8.dp))
        Text(message, style = MaterialTheme.typography.bodyMedium, color = PandaSubtext,
            textAlign = androidx.compose.ui.text.style.TextAlign.Center)
        Spacer(Modifier.height(32.dp))
        Button(
            onClick  = onRetry,
            modifier = Modifier.fillMaxWidth(0.7f),
            colors   = ButtonDefaults.buttonColors(containerColor = KalyptusGreen),
        ) { Text(stringResource(R.string.tcx_retry_button)) }
    }
}

// ── Sub-components ────────────────────────────────────────────────────────────

@Composable
private fun StatRow(label: String, value: String) {
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(label, style = MaterialTheme.typography.bodySmall, color = PandaSubtext)
        Text(value, style = MaterialTheme.typography.bodySmall, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
private fun ImportModeRow(
    label: String,
    subtitle: String,
    selected: Boolean,
    enabled: Boolean = true,
    onClick: () -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(enabled = enabled, onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(
            if (selected) Icons.Default.RadioButtonChecked else Icons.Default.RadioButtonUnchecked,
            contentDescription = null,
            tint = if (selected && enabled) KalyptusGreen else PandaSubtext,
            modifier = Modifier.size(20.dp),
        )
        Spacer(Modifier.width(12.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(label, style = MaterialTheme.typography.bodyMedium,
                color = if (enabled) MaterialTheme.colorScheme.onSurface else PandaSubtext)
            Text(subtitle, style = MaterialTheme.typography.bodySmall, color = PandaSubtext)
        }
    }
}

@Composable
private fun PlannedWorkoutRow(workout: WorkoutEntity, selected: Boolean, onClick: () -> Unit) {
    PandaCard(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick),
        containerColor = if (selected) KalyptusGreen.copy(alpha = 0.08f) else MaterialTheme.colorScheme.surface,
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(
                if (selected) Icons.Default.RadioButtonChecked else Icons.Default.RadioButtonUnchecked,
                null,
                tint = if (selected) KalyptusGreen else PandaSubtext,
                modifier = Modifier.size(20.dp),
            )
            Spacer(Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(workout.name, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold)
                Text(
                    workout.scheduledDate.toString(),
                    style = MaterialTheme.typography.bodySmall,
                    color = PandaSubtext,
                )
            }
        }
    }
}

private fun estimateSimplified(rawCount: Int): String {
    // Rough estimate of Douglas-Peucker output (~5-10% of raw points for 5m epsilon)
    val low = (rawCount * 0.05).toInt().coerceAtLeast(2)
    val high = (rawCount * 0.12).toInt().coerceAtLeast(low + 1)
    return "$low–$high"
}
