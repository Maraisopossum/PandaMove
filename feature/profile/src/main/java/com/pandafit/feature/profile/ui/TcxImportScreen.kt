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
import androidx.compose.material.icons.filled.Error
import androidx.compose.material.icons.filled.FileOpen
import androidx.compose.material.icons.filled.RadioButtonChecked
import androidx.compose.material.icons.filled.RadioButtonUnchecked
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
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
import com.pandafit.feature.profile.viewmodel.TcxImportMode
import com.pandafit.feature.profile.viewmodel.TcxImportStep
import com.pandafit.feature.profile.viewmodel.TcxImportViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TcxImportScreen(
    onNavigateBack: () -> Unit,
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
                title = { Text("Import Garmin (.tcx)") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Retour")
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
                val label = if (s is TcxImportStep.Parsing) "Lecture du fichier…" else "Import en cours…"
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
                    onConfirm             = viewModel::confirm,
                    onPickAnother         = { viewModel.reset(); fileLauncher.launch("*/*") },
                )
            }

            // ── Done ──────────────────────────────────────────────────────────
            is TcxImportStep.Done -> {
                DoneContent(
                    result   = s,
                    modifier = Modifier.padding(innerPadding),
                    onImportAnother = viewModel::reset,
                    onBack          = onNavigateBack,
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
            "Importer depuis Garmin",
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.Bold,
        )
        Spacer(Modifier.height(8.dp))
        Text(
            "Sélectionnez un fichier .tcx exporté depuis Garmin Connect ou Garmin Express.",
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
            Text("Choisir un fichier .tcx")
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
    onConfirm: () -> Unit,
    onPickAnother: () -> Unit,
) {
    val a = preview.activity

    // Computed global stats for display
    val distKm   = a.totalDistanceM / 1000.0
    val durMin   = a.totalDurationSec.toInt() / 60
    val durSec   = a.totalDurationSec.toInt() % 60
    val paceStr  = if (a.totalDistanceM > 1) {
        val paceMinKm = (a.totalDurationSec / 60.0) / (a.totalDistanceM / 1000.0)
        val pm = paceMinKm.toInt(); val ps = ((paceMinKm - pm) * 60).toInt()
        "$pm:${ps.toString().padStart(2, '0')}/km"
    } else "—"

    LazyColumn(
        modifier = modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {

        // ── Global stats card ──────────────────────────────────────────────
        item {
            Text("Aperçu de l'activité", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
            Spacer(Modifier.height(8.dp))
            PandaCard(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    StatRow("Distance", "%.2f km".format(distKm))
                    StatRow("Durée", "%d:%02d".format(durMin, durSec))
                    StatRow("Allure moy.", paceStr)
                    if (a.avgHrBpm != null) StatRow("FC moy.", "${a.avgHrBpm} bpm")
                    if (a.maxHrBpm != null) StatRow("FC max", "${a.maxHrBpm} bpm")
                    if (a.elevationGainM != null) StatRow("Dénivelé +", "${a.elevationGainM} m")
                    StatRow("Splits", "${a.laps.size} lap${if (a.laps.size > 1) "s" else ""}")
                    StatRow("Points GPS", "${a.rawTrackPoints.size} bruts → ~${estimateSimplified(a.rawTrackPoints.size)} après simplification")
                }
            }
        }

        // ── Sport type ─────────────────────────────────────────────────────
        item {
            Text("Type de sport", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
            Spacer(Modifier.height(8.dp))
            PandaCard(modifier = Modifier.fillMaxWidth()) {
                Row(
                    modifier = Modifier.padding(8.dp).selectableGroup(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    listOf(
                        WorkoutType.RUNNING to ("Course à pied" to Icons.Default.DirectionsRun),
                        WorkoutType.CYCLING to ("Vélo" to Icons.Default.DirectionsBike),
                    ).forEach { (type, labelIcon) ->
                        val (label, icon) = labelIcon
                        val selected = preview.workoutType == type
                        Row(
                            modifier = Modifier
                                .weight(1f)
                                .selectable(selected = selected, role = Role.RadioButton, onClick = { onUpdateType(type) })
                                .padding(horizontal = 12.dp, vertical = 10.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                        ) {
                            RadioButton(selected = selected, onClick = null)
                            Icon(icon, null, modifier = Modifier.size(18.dp), tint = if (selected) KalyptusGreen else PandaSubtext)
                            Text(label, style = MaterialTheme.typography.bodyMedium, fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Normal)
                        }
                    }
                }
            }
        }

        // ── Import mode ────────────────────────────────────────────────────
        item {
            Text("Importer comme…", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
            Spacer(Modifier.height(8.dp))
            PandaCard(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(4.dp)) {
                    ImportModeRow(
                        label    = "Nouvelle séance libre",
                        subtitle = "Crée une séance terminée avec les résultats du TCX",
                        selected = preview.mode == TcxImportMode.NEW,
                        onClick  = { onUpdateMode(TcxImportMode.NEW) },
                    )
                    HorizontalDivider(modifier = Modifier.padding(horizontal = 16.dp))
                    ImportModeRow(
                        label    = "Lier à une séance planifiée",
                        subtitle = if (preview.plannedWorkouts.isEmpty())
                            "Aucune séance planifiée de ce type"
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
                Text("Choisir la séance", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
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
                    label         = { Text("Nom de la séance") },
                    singleLine    = true,
                    modifier      = Modifier.fillMaxWidth(),
                )
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
                ) { Text("Importer") }
                androidx.compose.material3.OutlinedButton(
                    onClick  = onPickAnother,
                    modifier = Modifier.fillMaxWidth(),
                ) { Text("Choisir un autre fichier") }
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
) {
    Column(
        modifier = modifier.fillMaxSize().padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Icon(Icons.Default.CheckCircle, null, modifier = Modifier.size(64.dp), tint = KalyptusGreen)
        Spacer(Modifier.height(24.dp))
        Text("Import réussi !", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(12.dp))
        Text(
            "${result.result.lapsImported} split${if (result.result.lapsImported > 1) "s" else ""} · ${result.result.gpsPointsImported} points GPS",
            style = MaterialTheme.typography.bodyMedium,
            color = PandaSubtext,
        )
        Spacer(Modifier.height(32.dp))
        Button(
            onClick  = onBack,
            modifier = Modifier.fillMaxWidth(0.7f),
            colors   = ButtonDefaults.buttonColors(containerColor = KalyptusGreen),
        ) { Text("Retour au profil") }
        Spacer(Modifier.height(8.dp))
        androidx.compose.material3.OutlinedButton(
            onClick  = onImportAnother,
            modifier = Modifier.fillMaxWidth(0.7f),
        ) { Text("Importer un autre fichier") }
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
        Text("Erreur d'import", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(8.dp))
        Text(message, style = MaterialTheme.typography.bodyMedium, color = PandaSubtext,
            textAlign = androidx.compose.ui.text.style.TextAlign.Center)
        Spacer(Modifier.height(32.dp))
        Button(
            onClick  = onRetry,
            modifier = Modifier.fillMaxWidth(0.7f),
            colors   = ButtonDefaults.buttonColors(containerColor = KalyptusGreen),
        ) { Text("Réessayer") }
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
