package com.pandafit.feature.running.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.res.stringResource
import com.pandafit.feature.running.R
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.pandafit.core.database.entities.RunEndType
import com.pandafit.core.database.entities.RunEndUnit
import com.pandafit.core.database.entities.RunStepEntity
import com.pandafit.core.database.entities.RunStepType
import com.pandafit.core.database.entities.RunTargetType
import com.pandafit.designsystem.components.PandaLoadingIndicator
import com.pandafit.designsystem.theme.PandaPurple
import com.pandafit.designsystem.theme.PandaSubtext
import com.pandafit.feature.running.model.FreeStepExecution
import com.pandafit.feature.running.model.FreeStepResult
import com.pandafit.core.database.model.IntervalRepResult
import com.pandafit.feature.running.model.RunRepeatExecution
import com.pandafit.feature.running.viewmodel.RunningExecuteViewModel
import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.graphics.DashPathEffect
import android.graphics.drawable.BitmapDrawable
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import com.pandafit.core.database.catalog.LiveTrackState
import java.time.format.DateTimeFormatter
import java.util.Locale
import org.osmdroid.config.Configuration
import org.osmdroid.tileprovider.tilesource.TileSourceFactory
import org.osmdroid.util.GeoPoint
import org.osmdroid.views.MapView
import org.osmdroid.views.overlay.Marker
import org.osmdroid.views.overlay.Polyline

/** Découpe le tracé en segments contigus pleins / pointillés (signal GPS faible) pour l'affichage carte. */
private fun trackSegments(
    points: List<Pair<Double, Double>>,
    weakSignalAt: List<Boolean>,
): List<Pair<Boolean, List<Pair<Double, Double>>>> {
    if (points.size < 2) return emptyList()
    val segments = mutableListOf<Pair<Boolean, List<Pair<Double, Double>>>>()
    var currentWeak = false
    var currentSeg = mutableListOf(points[0])
    for (i in 1 until points.size) {
        val weak = weakSignalAt.getOrElse(i) { false }
        if (weak != currentWeak) {
            segments.add(currentWeak to currentSeg)
            currentSeg = mutableListOf(points[i - 1])
        }
        currentSeg.add(points[i])
        currentWeak = weak
    }
    segments.add(currentWeak to currentSeg)
    return segments
}

private val OrangeBorder    = Color(0xFFFFCC80)
private val OrangeBg        = Color(0xFFFFF8F0)
private val OrangeRowBorder = Color(0xFFFFE0B2)
private val OrangeText      = Color(0xFFE65100)
private val GrayBg          = Color(0xFFF4F4F7)
private val DarkColor       = Color(0xFF1A1A2E)
private val RedColor        = Color(0xFFE53935)

private const val GPS_READY_ACCURACY_M = 20f

private enum class GpsPhase { IDLE, CALIBRATING, RUNNING, PAUSED }

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RunningWorkoutExecuteScreen(
    workoutId: Long,
    onNavigateBack: () -> Unit,
    onNavigateToReport: (Long) -> Unit = { onNavigateBack() },
    viewModel: RunningExecuteViewModel = hiltViewModel(),
) {
    val uiState by viewModel.screenState.collectAsStateWithLifecycle()
    val liveTrackState by viewModel.liveTrackState.collectAsStateWithLifecycle()
    var showFinishDialog by remember { mutableStateOf(false) }
    var showOverflowMenu by remember { mutableStateOf(false) }
    var showDetailsSheet by remember { mutableStateOf(false) }
    val ctx = LocalContext.current
    var locationPermissionGranted by remember {
        mutableStateOf(
            ContextCompat.checkSelfPermission(ctx, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
        )
    }
    val permissionLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        locationPermissionGranted = granted
    }

    LaunchedEffect(uiState.isCompleted) {
        if (uiState.isCompleted) onNavigateToReport(uiState.workoutId ?: workoutId)
    }

    LaunchedEffect(locationPermissionGranted) {
        if (locationPermissionGranted) viewModel.startCalibration()
    }

    if (showFinishDialog) {
        AlertDialog(
            onDismissRequest = { showFinishDialog = false },
            title = { Text(stringResource(R.string.running_execute_finish_dialog_title), fontWeight = FontWeight.Bold) },
            text = { Text(stringResource(R.string.running_execute_finish_dialog_body)) },
            confirmButton = {
                TextButton(onClick = { viewModel.finishWorkout(); showFinishDialog = false }) {
                    Text(stringResource(R.string.running_execute_finish_button), color = RedColor, fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = { TextButton(onClick = { showFinishDialog = false }) { Text(stringResource(R.string.running_execute_cancel_button)) } },
        )
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(
                            uiState.workout?.name ?: stringResource(R.string.running_execute_title_fallback),
                            style = MaterialTheme.typography.titleSmall,
                            fontWeight = FontWeight.ExtraBold,
                        )
                        val dateStr = uiState.workout?.scheduledDate
                            ?.format(DateTimeFormatter.ofPattern("EEEE d MMMM", Locale.FRENCH))
                            ?.replaceFirstChar { it.uppercase() } ?: ""
                        if (dateStr.isNotBlank()) {
                            Text(dateStr, style = MaterialTheme.typography.labelSmall, color = PandaSubtext)
                        }
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, stringResource(R.string.running_execute_navigate_back_cd))
                    }
                },
                actions = {
                    Box {
                        IconButton(onClick = { showOverflowMenu = true }) {
                            Icon(Icons.Filled.MoreVert, contentDescription = stringResource(R.string.running_execute_overflow_menu_cd))
                        }
                        DropdownMenu(expanded = showOverflowMenu, onDismissRequest = { showOverflowMenu = false }) {
                            DropdownMenuItem(
                                text = { Text(stringResource(R.string.running_execute_finish_button), color = RedColor, fontWeight = FontWeight.Bold) },
                                onClick = { showOverflowMenu = false; showFinishDialog = true },
                            )
                        }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.surface),
            )
        },
        containerColor = MaterialTheme.colorScheme.background,
    ) { innerPadding ->
        if (uiState.isLoading) { PandaLoadingIndicator(); return@Scaffold }

        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(innerPadding),
            contentPadding = PaddingValues(start = 16.dp, end = 16.dp, bottom = 32.dp),
        ) {
            // ── Carte GPS live ──
            item {
                Spacer(Modifier.height(12.dp))
                GpsTrackBlock(
                    state = liveTrackState,
                    permissionGranted = locationPermissionGranted,
                    onStart = { viewModel.startGpsTracking() },
                    onPause = { viewModel.pauseGpsTracking() },
                    onResume = { viewModel.resumeGpsTracking() },
                    onRequestPermission = { permissionLauncher.launch(Manifest.permission.ACCESS_FINE_LOCATION) },
                )
                Spacer(Modifier.height(16.dp))
            }

            // ── Cockpit live : phase active + timeline + accès au détail ──
            uiState.livePhase?.let { phase ->
                item {
                    LiveWorkoutPhaseCard(phase = phase)
                    Spacer(Modifier.height(12.dp))
                    WorkoutProgressTimeline(steps = uiState.timeline)
                    Spacer(Modifier.height(16.dp))
                }
            }
            item {
                OutlinedButton(
                    onClick = { showDetailsSheet = true },
                    modifier = Modifier.fillMaxWidth().height(48.dp),
                    shape = RoundedCornerShape(14.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, com.pandafit.designsystem.theme.PandaGreen),
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = com.pandafit.designsystem.theme.PandaGreen),
                ) {
                    Text(stringResource(R.string.running_execute_view_details_button), fontWeight = FontWeight.Bold)
                    Spacer(Modifier.width(6.dp))
                    Icon(Icons.Filled.ExpandMore, contentDescription = null)
                }
            }
        }
    }

    if (showDetailsSheet) {
        WorkoutDetailsBottomSheet(
            uiState = uiState,
            onUpdateOverallResult = viewModel::updateOverallResult,
            onUpdateFreeStep = viewModel::updateFreeStep,
            onUpdateIntervalRep = viewModel::updateIntervalRep,
            onDismiss = { showDetailsSheet = false },
        )
    }
}

// ── Bottom sheet détail : résultats globaux, intervalles, note (retirés du flux live principal) ──

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun WorkoutDetailsBottomSheet(
    uiState: com.pandafit.feature.running.model.RunningExecuteUiState,
    onUpdateOverallResult: (String, String) -> Unit,
    onUpdateFreeStep: (Int, FreeStepResult) -> Unit,
    onUpdateIntervalRep: (Int, Int, IntervalRepResult) -> Unit,
    onDismiss: () -> Unit,
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = sheetState) {
        LazyColumn(
            modifier = Modifier.fillMaxWidth(),
            contentPadding = PaddingValues(start = 16.dp, end = 16.dp, bottom = 32.dp),
        ) {
            // ── Résultats globaux ──
            item {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(GrayBg, RoundedCornerShape(14.dp))
                        .padding(14.dp),
                ) {
                    Text(
                        stringResource(R.string.running_execute_global_results_label),
                        style = MaterialTheme.typography.labelSmall,
                        color = PandaSubtext,
                        fontWeight = FontWeight.Bold,
                    )
                    Spacer(Modifier.height(10.dp))
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        ResultInputCell(stringResource(R.string.running_execute_cell_distance), uiState.resultDistanceKm, { onUpdateOverallResult("distanceKm", it) }, KeyboardType.Decimal, Modifier.weight(1f))
                        ResultInputCell(stringResource(R.string.running_execute_cell_time), uiState.resultDurationStr, { onUpdateOverallResult("duration", it) }, KeyboardType.Text, Modifier.weight(1f))
                        ReadOnlyCell(stringResource(R.string.running_execute_cell_pace), uiState.resultPaceStr, Modifier.weight(1f))
                    }
                    Spacer(Modifier.height(8.dp))
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        ResultInputCell(stringResource(R.string.running_execute_cell_hr_avg), uiState.resultHrAvg, { onUpdateOverallResult("hr", it) }, KeyboardType.Number, Modifier.weight(1f))
                        ResultInputCell(stringResource(R.string.running_execute_cell_hr_max), uiState.resultHrMax, { onUpdateOverallResult("hrMax", it) }, KeyboardType.Number, Modifier.weight(1f))
                        ResultInputCell(stringResource(R.string.running_execute_cell_rpe), uiState.resultRpe, { onUpdateOverallResult("rpe", it) }, KeyboardType.Number, Modifier.weight(1f))
                    }
                    Spacer(Modifier.height(8.dp))
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        ResultInputCell(stringResource(R.string.running_execute_cell_elevation), uiState.resultElevationM, { onUpdateOverallResult("elevation", it) }, KeyboardType.Number, Modifier.weight(1f))
                        ResultInputCell(stringResource(R.string.running_execute_cell_calories), uiState.resultCalories, { onUpdateOverallResult("calories", it) }, KeyboardType.Number, Modifier.weight(1f))
                        ResultInputCell(stringResource(R.string.running_execute_cell_cadence), uiState.resultCadenceAvgPpm, { onUpdateOverallResult("cadence", it) }, KeyboardType.Number, Modifier.weight(1f))
                    }
                }
                Spacer(Modifier.height(16.dp))
            }

            // ── Étapes libres et blocs répétition, intercalés selon leur position ──
            // (ex : échauffement avant les intervalles, récupération après)
            val firstRepeatPosition = uiState.repeatBlocks.minOfOrNull { it.repeat.position }
            val stepsBeforeRepeats = if (firstRepeatPosition != null)
                uiState.freeSteps.withIndex().filter { it.value.step.position < firstRepeatPosition }
            else uiState.freeSteps.withIndex().toList()
            val stepsAfterRepeats = if (firstRepeatPosition != null)
                uiState.freeSteps.withIndex().filter { it.value.step.position >= firstRepeatPosition }
            else emptyList()

            if (stepsBeforeRepeats.isNotEmpty()) {
                items(stepsBeforeRepeats, key = { "free_${it.index}" }) { (idx, execution) ->
                    FreeStepSection(
                        execution = execution,
                        onUpdate = { updated -> onUpdateFreeStep(idx, updated) },
                    )
                    Spacer(Modifier.height(14.dp))
                }
            }

            if (uiState.repeatBlocks.isNotEmpty()) {
                items(uiState.repeatBlocks, key = { it.repeat.id }) { execution ->
                    RepeatIntervalSection(
                        execution = execution,
                        onRepUpdate = { repIdx, updated ->
                            val blockIdx = uiState.repeatBlocks.indexOf(execution)
                            onUpdateIntervalRep(blockIdx, repIdx, updated)
                        },
                    )
                    Spacer(Modifier.height(14.dp))
                }
            }

            if (stepsAfterRepeats.isNotEmpty()) {
                items(stepsAfterRepeats, key = { "free_${it.index}" }) { (idx, execution) ->
                    FreeStepSection(
                        execution = execution,
                        onUpdate = { updated -> onUpdateFreeStep(idx, updated) },
                    )
                    Spacer(Modifier.height(14.dp))
                }
            }

            // ── Note de séance ──
            item {
                Text(
                    stringResource(R.string.running_execute_session_note_label),
                    style = MaterialTheme.typography.labelSmall,
                    color = PandaSubtext,
                    fontWeight = FontWeight.Bold,
                )
                Spacer(Modifier.height(6.dp))
                OutlinedTextField(
                    value = uiState.resultNotes,
                    onValueChange = { onUpdateOverallResult("notes", it) },
                    modifier = Modifier.fillMaxWidth(),
                    minLines = 3,
                    placeholder = { Text(stringResource(R.string.running_execute_session_note_placeholder)) },
                    shape = RoundedCornerShape(12.dp),
                )
            }
        }
    }
}

// ── Tableau de répétitions ────────────────────────────────────────────────────

@Composable
private fun RepeatIntervalSection(
    execution: RunRepeatExecution,
    onRepUpdate: (Int, IntervalRepResult) -> Unit,
) {
    val target = execution.targetStep
    val hasRecovery = execution.recoveryStep != null
    val intensityLabel = intensityColumnLabel(target)
    val hasIntensity = intensityLabel != null
    val intensityKeyboard = if (target?.targetType == RunTargetType.PACE) KeyboardType.Text else KeyboardType.Decimal

    val distStr = target?.let { s ->
        when (s.endType) {
            RunEndType.DISTANCE -> "${s.endValue} ${if (s.endUnit == RunEndUnit.METERS) "m" else "km"}"
            RunEndType.DURATION -> "${s.endValue / 60}:${(s.endValue % 60).toString().padStart(2, '0')}"
        }
    } ?: ""

    val targetStr = buildString {
        if (distStr.isNotBlank()) append(distStr)
        target?.let { s ->
            val cible = when (s.targetType) {
                RunTargetType.PACE -> {
                    val mn = s.targetMin?.let { "${it / 60}:${(it % 60).toString().padStart(2, '0')}" }
                    val mx = s.targetMax?.let { "${it / 60}:${(it % 60).toString().padStart(2, '0')}" }
                    if (mn != null && mx != null) "$mn→$mx/km" else ""
                }
                RunTargetType.HR_CUSTOM -> if (s.targetMin != null && s.targetMax != null) "${s.targetMin}→${s.targetMax} bpm" else ""
                RunTargetType.CADENCE   -> if (s.targetMin != null && s.targetMax != null) "${s.targetMin}→${s.targetMax} spm" else ""
                RunTargetType.HR_ZONE   -> if (s.targetMin != null) "Zone FC Z${s.targetMin}" else ""
                else -> ""
            }
            if (cible.isNotBlank()) { if (isNotEmpty()) append(" · "); append(cible) }
        }
    }

    val recoveryStr = execution.recoveryStep?.let { s ->
        val amount = when (s.endType) {
            RunEndType.DISTANCE -> "${s.endValue} ${if (s.endUnit == RunEndUnit.METERS) "m" else "km"}"
            RunEndType.DURATION -> "${s.endValue / 60}:${(s.endValue % 60).toString().padStart(2, '0')}"
        }
        "${stepLabel(s.stepType)} $amount"
    }

    Text(
        stringResource(R.string.running_execute_interval_label, execution.repeat.repeatCount),
        style = MaterialTheme.typography.labelSmall,
        color = PandaSubtext,
        fontWeight = FontWeight.Bold,
    )
    if (recoveryStr != null) {
        Text(
            recoveryStr,
            style = MaterialTheme.typography.labelSmall,
            color = PandaSubtext,
        )
    }
    Spacer(Modifier.height(8.dp))
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .border(1.dp, OrangeBorder, RoundedCornerShape(14.dp))
            .background(OrangeBg, RoundedCornerShape(14.dp)),
    ) {
        Row(modifier = Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 8.dp)) {
            Text(stringResource(R.string.running_table_col_num), style = MaterialTheme.typography.labelSmall, color = PandaSubtext, fontWeight = FontWeight.SemiBold, modifier = Modifier.width(30.dp))
            Text(stringResource(R.string.running_table_col_cible), style = MaterialTheme.typography.labelSmall, color = PandaSubtext, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f), textAlign = TextAlign.Center)
            Text(stringResource(R.string.running_table_col_tps), style = MaterialTheme.typography.labelSmall, color = PandaSubtext, fontWeight = FontWeight.SemiBold, modifier = Modifier.width(40.dp), textAlign = TextAlign.Center)
            if (hasIntensity) Text(intensityLabel!!, style = MaterialTheme.typography.labelSmall, color = PandaSubtext, fontWeight = FontWeight.SemiBold, modifier = Modifier.width(52.dp), textAlign = TextAlign.Center)
            Text(stringResource(R.string.running_table_col_rpe), style = MaterialTheme.typography.labelSmall, color = PandaSubtext, fontWeight = FontWeight.SemiBold, modifier = Modifier.width(30.dp), textAlign = TextAlign.Center)
            if (hasRecovery) {
                Text(stringResource(R.string.running_table_col_check_course), style = MaterialTheme.typography.labelSmall, color = PandaSubtext, fontWeight = FontWeight.SemiBold, modifier = Modifier.width(28.dp), textAlign = TextAlign.Center)
                Text(stringResource(R.string.running_table_col_check_recup), style = MaterialTheme.typography.labelSmall, color = PandaSubtext, fontWeight = FontWeight.SemiBold, modifier = Modifier.width(28.dp), textAlign = TextAlign.Center)
            } else {
                Text(stringResource(R.string.running_table_col_check), style = MaterialTheme.typography.labelSmall, color = PandaSubtext, fontWeight = FontWeight.SemiBold, modifier = Modifier.width(28.dp), textAlign = TextAlign.Center)
            }
        }

        execution.reps.forEachIndexed { idx, rep ->
            HorizontalDivider(color = OrangeRowBorder)
            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    distStr.ifBlank { "#${rep.repNumber}" },
                    style = MaterialTheme.typography.labelSmall,
                    fontWeight = FontWeight.Bold,
                    color = OrangeText,
                    modifier = Modifier.width(30.dp),
                )
                Text(
                    targetStr.ifBlank { "—" },
                    style = MaterialTheme.typography.labelSmall,
                    color = PandaSubtext,
                    modifier = Modifier.weight(1f),
                    textAlign = TextAlign.Center,
                    maxLines = 1,
                )
                RepBasicField(rep.timeStr, Modifier.width(40.dp)) { onRepUpdate(idx, rep.copy(timeStr = it)) }
                if (hasIntensity) {
                    RepBasicField(rep.actualIntensity, Modifier.width(52.dp), keyboardType = intensityKeyboard) { onRepUpdate(idx, rep.copy(actualIntensity = it)) }
                }
                RepBasicField(rep.rpeStr, Modifier.width(30.dp), keyboardType = KeyboardType.Number) { onRepUpdate(idx, rep.copy(rpeStr = it)) }
                if (hasRecovery) {
                    Checkbox(
                        checked = rep.runningDone,
                        onCheckedChange = { checked ->
                            // Décocher la course décoche aussi la récup (elle ne peut pas être faite sans la course).
                            onRepUpdate(idx, rep.copy(runningDone = checked, done = checked && rep.done))
                        },
                        modifier = Modifier.size(28.dp),
                        colors = CheckboxDefaults.colors(checkedColor = Color(0xFF7C5CBF), uncheckedColor = Color(0xFFE0E0E0)),
                    )
                    Checkbox(
                        checked = rep.done,
                        onCheckedChange = { checked ->
                            onRepUpdate(idx, rep.copy(done = checked, runningDone = rep.runningDone || checked))
                        },
                        modifier = Modifier.size(28.dp),
                        colors = CheckboxDefaults.colors(checkedColor = Color(0xFF7C5CBF), uncheckedColor = Color(0xFFE0E0E0)),
                    )
                } else {
                    Checkbox(
                        checked = rep.done,
                        onCheckedChange = { onRepUpdate(idx, rep.copy(done = it, runningDone = it)) },
                        modifier = Modifier.size(28.dp),
                        colors = CheckboxDefaults.colors(checkedColor = Color(0xFF7C5CBF), uncheckedColor = Color(0xFFE0E0E0)),
                    )
                }
            }
        }
    }
}

@Composable
private fun RepBasicField(value: String, modifier: Modifier, keyboardType: KeyboardType = KeyboardType.Text, onValueChange: (String) -> Unit) {
    BasicTextField(
        value = value,
        onValueChange = onValueChange,
        textStyle = TextStyle(fontSize = 13.sp, fontWeight = FontWeight.Bold, color = DarkColor, textAlign = TextAlign.Center),
        singleLine = true,
        keyboardOptions = KeyboardOptions(keyboardType = keyboardType),
        modifier = modifier,
        decorationBox = { inner ->
            Box(modifier, contentAlignment = Alignment.Center) {
                if (value.isEmpty()) Text("—", style = TextStyle(fontSize = 13.sp, color = PandaSubtext, textAlign = TextAlign.Center))
                inner()
            }
        },
    )
}

// ── Section étape libre ──────────────────────────────────────────────────────

@Composable
private fun FreeStepSection(
    execution: FreeStepExecution,
    onUpdate: (FreeStepResult) -> Unit,
) {
    val step = execution.step
    val result = execution.result
    val intensityLabel = intensityColumnLabel(step)
    val intensityKeyboard = if (step.targetType == RunTargetType.PACE) KeyboardType.Text else KeyboardType.Decimal

    val stepSummary = when (step.endType) {
        RunEndType.DURATION -> {
            val m = step.endValue / 60; val s = step.endValue % 60
            "$m:${s.toString().padStart(2, '0')}"
        }
        RunEndType.DISTANCE -> "${step.endValue} ${if (step.endUnit == RunEndUnit.METERS) "m" else "km"}"
    }

    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.medium,
        color = Color(0xFFF0F4FF),
    ) {
        Column(modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp)) {
            Text(
                "${stepLabel(step.stepType)} — $stepSummary",
                style = MaterialTheme.typography.labelSmall,
                color = PandaSubtext,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp),
            )
            Row(modifier = Modifier.fillMaxWidth().padding(horizontal = 10.dp, vertical = 4.dp)) {
                Text(stringResource(R.string.running_table_col_tps), style = MaterialTheme.typography.labelSmall, color = PandaSubtext, modifier = Modifier.weight(1f), textAlign = TextAlign.Center)
                if (intensityLabel != null) Text(intensityLabel, style = MaterialTheme.typography.labelSmall, color = PandaSubtext, modifier = Modifier.weight(1f), textAlign = TextAlign.Center)
                Text(stringResource(R.string.running_table_col_rpe), style = MaterialTheme.typography.labelSmall, color = PandaSubtext, modifier = Modifier.width(40.dp), textAlign = TextAlign.Center)
                Text(stringResource(R.string.running_table_col_check), style = MaterialTheme.typography.labelSmall, color = PandaSubtext, modifier = Modifier.width(32.dp), textAlign = TextAlign.Center)
            }
            HorizontalDivider(color = Color(0xFFD0D8F0))
            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 10.dp, vertical = 6.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                RepBasicField(result.timeStr, Modifier.weight(1f), KeyboardType.Text) { onUpdate(result.copy(timeStr = it)) }
                if (intensityLabel != null) RepBasicField(result.actualIntensity, Modifier.weight(1f), intensityKeyboard) { onUpdate(result.copy(actualIntensity = it)) }
                RepBasicField(result.rpeStr, Modifier.width(40.dp), KeyboardType.Number) { onUpdate(result.copy(rpeStr = it)) }
                Checkbox(
                    checked = result.done,
                    onCheckedChange = { onUpdate(result.copy(done = it)) },
                    modifier = Modifier.size(32.dp),
                    colors = CheckboxDefaults.colors(checkedColor = PandaPurple),
                )
            }
        }
    }
}

private fun stepLabel(type: RunStepType): String = when (type) {
    RunStepType.WARMUP   -> "Échauffement"
    RunStepType.RUNNING  -> "Course à pied"
    RunStepType.WALKING  -> "Marche"
    RunStepType.RECOVERY -> "Récupération"
    RunStepType.REST     -> "Repos"
    RunStepType.OTHER    -> "Autre"
}

private fun intensityColumnLabel(target: RunStepEntity?): String? = when {
    target?.targetType == RunTargetType.PACE      -> "Allure"
    target?.targetType == RunTargetType.HR_CUSTOM -> "FC"
    target?.targetType == RunTargetType.CADENCE   -> "Cad."
    target?.stepType   == RunStepType.RUNNING     -> "Allure"
    else                                          -> null
}

@Composable
private fun ResultInputCell(label: String, value: String, onValueChange: (String) -> Unit, keyboardType: KeyboardType, modifier: Modifier = Modifier) {
    Column(
        modifier = modifier
            .background(Color.White, RoundedCornerShape(10.dp))
            .padding(horizontal = 10.dp, vertical = 8.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(label, style = MaterialTheme.typography.labelSmall, color = PandaSubtext, textAlign = TextAlign.Center)
        BasicTextField(
            value = value,
            onValueChange = onValueChange,
            textStyle = TextStyle(fontSize = 15.sp, fontWeight = FontWeight.Bold, color = DarkColor, textAlign = TextAlign.Center),
            keyboardOptions = KeyboardOptions(keyboardType = keyboardType),
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
            decorationBox = { inner ->
                Box(modifier = Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                    if (value.isEmpty()) Text("—", style = TextStyle(fontSize = 15.sp, color = PandaSubtext, textAlign = TextAlign.Center))
                    inner()
                }
            },
        )
    }
}

@Composable
private fun ReadOnlyCell(label: String, value: String, modifier: Modifier = Modifier) {
    Column(
        modifier = modifier
            .background(Color(0xFFEAEAEA), RoundedCornerShape(10.dp))
            .padding(horizontal = 10.dp, vertical = 8.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(label, style = MaterialTheme.typography.labelSmall, color = PandaSubtext, textAlign = TextAlign.Center)
        Text(
            text = if (value.isEmpty()) "auto" else value,
            style = TextStyle(
                fontSize = 15.sp,
                fontWeight = FontWeight.Bold,
                color = if (value.isEmpty()) PandaSubtext else DarkColor,
                textAlign = TextAlign.Center,
            ),
            modifier = Modifier.fillMaxWidth(),
            textAlign = TextAlign.Center,
        )
    }
}

// ── GPS live tracking block ───────────────────────────────────────────────────

@Composable
private fun GpsTrackBlock(
    state: LiveTrackState,
    permissionGranted: Boolean,
    onStart: () -> Unit,
    onPause: () -> Unit,
    onResume: () -> Unit,
    onRequestPermission: () -> Unit,
) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(190.dp)
            .clip(RoundedCornerShape(14.dp)),
    ) {
        if (!permissionGranted) {
            Box(
                modifier = Modifier.fillMaxSize().background(GrayBg),
                contentAlignment = Alignment.Center,
            ) {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center,
                ) {
                    Text("GPS non activé", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold, color = DarkColor)
                    Spacer(Modifier.height(8.dp))
                    Text(
                        "Autorisez la localisation pour le suivi du tracé",
                        style = MaterialTheme.typography.bodySmall,
                        color = PandaSubtext,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.padding(horizontal = 24.dp),
                    )
                    Spacer(Modifier.height(12.dp))
                    Button(onClick = onRequestPermission, colors = ButtonDefaults.buttonColors(containerColor = PandaPurple)) {
                        Text("Autoriser la localisation", color = Color.White)
                    }
                }
            }
        } else {
            val ctx = LocalContext.current
            val pandaBitmap = remember(ctx) { loadPandaMarkerBitmap(ctx) }
            val mapView = remember(ctx) {
                MapView(ctx).apply {
                    Configuration.getInstance().load(ctx, ctx.getSharedPreferences("osmdroid", Context.MODE_PRIVATE))
                    setTileSource(TileSourceFactory.MAPNIK)
                    setMultiTouchControls(true)
                    controller.setZoom(16.0)
                }
            }

            DisposableEffect(mapView) {
                mapView.onResume()
                onDispose { mapView.onPause() }
            }

            AndroidView(
                factory = { mapView },
                update = { mv ->
                    mv.overlays.clear()
                    if (state.points.size >= 2) {
                        trackSegments(state.points, state.weakSignalAt).forEach { (isWeakSignal, segPoints) ->
                            val line = Polyline().apply {
                                setPoints(segPoints.map { (lat, lng) -> GeoPoint(lat, lng) })
                                outlinePaint.color = android.graphics.Color.parseColor("#7C5CBF")
                                outlinePaint.strokeWidth = 10f
                                if (isWeakSignal) {
                                    outlinePaint.pathEffect = DashPathEffect(floatArrayOf(20f, 16f), 0f)
                                }
                            }
                            mv.overlays.add(line)
                        }
                    }
                    val markerPos = state.currentPosition ?: state.points.lastOrNull()
                    if (markerPos != null) {
                        val marker = Marker(mv).apply {
                            position = GeoPoint(markerPos.first, markerPos.second)
                            icon = BitmapDrawable(ctx.resources, pandaBitmap)
                            setAnchor(Marker.ANCHOR_CENTER, Marker.ANCHOR_BOTTOM)
                            infoWindow = null
                        }
                        mv.overlays.add(marker)
                        mv.controller.animateTo(GeoPoint(markerPos.first, markerPos.second))
                    }
                    mv.invalidate()
                },
                modifier = Modifier.fillMaxSize(),
            )

            val phase = when {
                state.isTracking && state.isPaused -> GpsPhase.PAUSED
                state.isTracking                  -> GpsPhase.RUNNING
                state.calibrationAccuracyM != null -> GpsPhase.CALIBRATING
                else                              -> GpsPhase.IDLE
            }

            // Pause overlay (centre de la carte)
            if (phase == GpsPhase.PAUSED) {
                Box(
                    modifier = Modifier
                        .align(Alignment.Center)
                        .background(Color(0xAA000000), RoundedCornerShape(8.dp))
                        .padding(horizontal = 20.dp, vertical = 10.dp),
                ) {
                    Text("⏸ PAUSE", style = MaterialTheme.typography.titleMedium, color = Color.White, fontWeight = FontWeight.Bold)
                }
            }

            // Stats bar (bas de la carte)
            Column(
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .fillMaxWidth()
                    .background(Color(0xCC000000))
                    .padding(horizontal = 16.dp, vertical = 8.dp),
            ) {
                when (phase) {
                    GpsPhase.IDLE, GpsPhase.CALIBRATING -> {
                        val calibrationAccuracyM = state.calibrationAccuracyM
                        val accuracyText = when {
                            calibrationAccuracyM == null || calibrationAccuracyM >= Float.MAX_VALUE / 2 ->
                                "Acquisition GPS..."
                            calibrationAccuracyM <= GPS_READY_ACCURACY_M ->
                                "GPS capté · Précision : %.0fm ✓".format(calibrationAccuracyM)
                            else ->
                                "Acquisition GPS... Précision : %.0fm".format(calibrationAccuracyM)
                        }
                        Text(
                            accuracyText,
                            style = MaterialTheme.typography.labelMedium,
                            color = Color.White,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.fillMaxWidth(),
                            textAlign = TextAlign.Center,
                        )
                    }
                    GpsPhase.RUNNING, GpsPhase.PAUSED -> {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .alpha(if (phase == GpsPhase.PAUSED) 0.5f else 1f),
                            horizontalArrangement = Arrangement.SpaceEvenly,
                        ) {
                            GpsStat("Distance", "%.2f km".format(state.distanceM / 1000.0))
                            GpsStat("Durée", fmtGpsDuration(state.durationSec))
                            GpsStat("Allure", fmtGpsPace(state.paceMinkm))
                        }
                    }
                }
            }

            // Bouton d'action (coin haut-droit)
            Box(modifier = Modifier.align(Alignment.TopEnd).padding(8.dp)) {
                when (phase) {
                    GpsPhase.IDLE, GpsPhase.CALIBRATING -> {
                        val calibrationAccuracyM = state.calibrationAccuracyM
                        val ready = calibrationAccuracyM != null &&
                                calibrationAccuracyM <= GPS_READY_ACCURACY_M
                        Button(
                            onClick = onStart,
                            enabled = ready,
                            colors = ButtonDefaults.buttonColors(
                                containerColor = PandaPurple,
                                disabledContainerColor = Color(0xFF666666),
                            ),
                            contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp),
                        ) {
                            Text("▶ Démarrer", style = MaterialTheme.typography.labelMedium, color = Color.White)
                        }
                    }
                    GpsPhase.RUNNING -> {
                        Button(
                            onClick = onPause,
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFFF9800)),
                            contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp),
                        ) {
                            Text("⏸ Pause", style = MaterialTheme.typography.labelMedium, color = Color.White)
                        }
                    }
                    GpsPhase.PAUSED -> {
                        Button(
                            onClick = onResume,
                            colors = ButtonDefaults.buttonColors(containerColor = PandaPurple),
                            contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp),
                        ) {
                            Text("▶ Reprendre", style = MaterialTheme.typography.labelMedium, color = Color.White)
                        }
                    }
                }
            }
        }
    }
}

/** Marqueur carte : le vrai personnage PandaMove (pas un emoji), redimensionné à taille lisible sur la carte. */
private fun loadPandaMarkerBitmap(ctx: Context): android.graphics.Bitmap {
    val source = androidx.core.content.res.ResourcesCompat.getDrawable(ctx.resources, R.drawable.panda_running_male, null)
        ?.let { drawable ->
            val bmp = android.graphics.Bitmap.createBitmap(drawable.intrinsicWidth, drawable.intrinsicHeight, android.graphics.Bitmap.Config.ARGB_8888)
            val canvas = android.graphics.Canvas(bmp)
            drawable.setBounds(0, 0, canvas.width, canvas.height)
            drawable.draw(canvas)
            bmp
        }
        ?: return android.graphics.Bitmap.createBitmap(1, 1, android.graphics.Bitmap.Config.ARGB_8888)
    val density = ctx.resources.displayMetrics.density
    val targetHeightPx = (56 * density).toInt().coerceAtLeast(1)
    val targetWidthPx = (targetHeightPx * source.width / source.height).coerceAtLeast(1)
    return android.graphics.Bitmap.createScaledBitmap(source, targetWidthPx, targetHeightPx, true)
}

@Composable
private fun GpsStat(label: String, value: String) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(label, style = MaterialTheme.typography.labelSmall, color = Color(0xFFBBBBBB))
        Text(value, style = MaterialTheme.typography.titleLarge, color = Color.White, fontWeight = FontWeight.ExtraBold)
    }
}

private fun fmtGpsPace(minkm: Double): String {
    if (minkm <= 0.0) return "--:--"
    val min = minkm.toInt()
    val sec = ((minkm - min) * 60).toInt()
    return "$min:${sec.toString().padStart(2, '0')} /km"
}

private fun fmtGpsDuration(totalSec: Int): String {
    val h = totalSec / 3600
    val m = (totalSec % 3600) / 60
    val s = totalSec % 60
    return if (h > 0) "$h:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}"
    else "$m:${s.toString().padStart(2, '0')}"
}
