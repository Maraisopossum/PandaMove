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
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
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
import com.pandafit.feature.running.model.IntervalRepResult
import com.pandafit.feature.running.model.RunRepeatExecution
import com.pandafit.feature.running.viewmodel.RunningExecuteViewModel
import java.time.format.DateTimeFormatter
import java.util.Locale

private val OrangeBorder  = Color(0xFFFFCC80)
private val OrangeBg      = Color(0xFFFFF8F0)
private val OrangeRowBorder = Color(0xFFFFE0B2)
private val OrangeText    = Color(0xFFE65100)
private val GrayBg        = Color(0xFFF4F4F7)
private val DarkColor     = Color(0xFF1A1A2E)
private val RedColor      = Color(0xFFE53935)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RunningWorkoutExecuteScreen(
    workoutId: Long,
    onNavigateBack: () -> Unit,
    viewModel: RunningExecuteViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    var showFinishDialog by remember { mutableStateOf(false) }

    LaunchedEffect(uiState.isCompleted) {
        if (uiState.isCompleted) onNavigateBack()
    }

    if (showFinishDialog) {
        AlertDialog(
            onDismissRequest = { showFinishDialog = false },
            title = { Text("Terminer la séance ?", fontWeight = FontWeight.Bold) },
            text = { Text("Les résultats seront sauvegardés et la séance marquée comme terminée.") },
            confirmButton = {
                TextButton(onClick = { viewModel.finishWorkout(); showFinishDialog = false }) {
                    Text("Terminer", color = RedColor, fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = { TextButton(onClick = { showFinishDialog = false }) { Text("Annuler") } },
        )
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(
                            uiState.workout?.name ?: "Résultats",
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
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, "Retour")
                    }
                },
                actions = {
                    TextButton(onClick = { showFinishDialog = true }) {
                        Text("Terminer", color = RedColor, fontWeight = FontWeight.Bold)
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
            // ── Résultats globaux ──
            item {
                Spacer(Modifier.height(12.dp))
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(GrayBg, RoundedCornerShape(14.dp))
                        .padding(14.dp),
                ) {
                    Text(
                        "RÉSULTATS GLOBAUX",
                        style = MaterialTheme.typography.labelSmall,
                        color = PandaSubtext,
                        fontWeight = FontWeight.Bold,
                    )
                    Spacer(Modifier.height(10.dp))
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        ResultInputCell("Distance (km)", uiState.resultDistanceKm, { viewModel.updateOverallResult("distanceKm", it) }, KeyboardType.Decimal, Modifier.weight(1f))
                        ResultInputCell("Temps (mm:ss)", uiState.resultDurationStr, { viewModel.updateOverallResult("duration", it) }, KeyboardType.Text, Modifier.weight(1f))
                        ResultInputCell("Allure (/km)", uiState.resultPaceStr, { viewModel.updateOverallResult("pace", it) }, KeyboardType.Text, Modifier.weight(1f))
                    }
                    Spacer(Modifier.height(8.dp))
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        ResultInputCell("FC moy. (bpm)", uiState.resultHrAvg, { viewModel.updateOverallResult("hr", it) }, KeyboardType.Number, Modifier.weight(1f))
                        ResultInputCell("FC max (bpm)", uiState.resultHrMax, { viewModel.updateOverallResult("hrMax", it) }, KeyboardType.Number, Modifier.weight(1f))
                        ResultInputCell("RPE (1–10)", uiState.resultRpe, { viewModel.updateOverallResult("rpe", it) }, KeyboardType.Number, Modifier.weight(1f))
                    }
                    Spacer(Modifier.height(8.dp))
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        ResultInputCell("Dénivelé (m)", uiState.resultElevationM, { viewModel.updateOverallResult("elevation", it) }, KeyboardType.Number, Modifier.weight(1f))
                        Spacer(Modifier.weight(2f))
                    }
                }
                Spacer(Modifier.height(16.dp))
            }

            // ── Étapes libres (séances sans répétition) ──
            if (uiState.freeSteps.isNotEmpty()) {
                items(uiState.freeSteps.indices.toList(), key = { "free_$it" }) { idx ->
                    FreeStepSection(
                        execution = uiState.freeSteps[idx],
                        onUpdate = { updated -> viewModel.updateFreeStep(idx, updated) },
                    )
                    Spacer(Modifier.height(14.dp))
                }
            }

            // ── Blocs répétition (un tableau par repeat) ──
            if (uiState.repeatBlocks.isNotEmpty()) {
                items(uiState.repeatBlocks, key = { it.repeat.id }) { execution ->
                    RepeatIntervalSection(
                        execution = execution,
                        onRepUpdate = { repIdx, updated ->
                            val blockIdx = uiState.repeatBlocks.indexOf(execution)
                            viewModel.updateIntervalRep(blockIdx, repIdx, updated)
                        },
                    )
                    Spacer(Modifier.height(14.dp))
                }
            }

            // ── Note de séance ──
            item {
                Text(
                    "NOTE DE SÉANCE",
                    style = MaterialTheme.typography.labelSmall,
                    color = PandaSubtext,
                    fontWeight = FontWeight.Bold,
                )
                Spacer(Modifier.height(6.dp))
                OutlinedTextField(
                    value = uiState.resultNotes,
                    onValueChange = { viewModel.updateOverallResult("notes", it) },
                    modifier = Modifier.fillMaxWidth(),
                    minLines = 3,
                    placeholder = { Text("Commentaire global de la séance...") },
                    shape = RoundedCornerShape(12.dp),
                )
                Spacer(Modifier.height(16.dp))
            }

            // ── Bouton terminer ──
            item {
                Button(
                    onClick = { showFinishDialog = true },
                    modifier = Modifier.fillMaxWidth().height(52.dp),
                    shape = RoundedCornerShape(14.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = RedColor),
                ) {
                    Text("Terminer la séance", color = Color.White, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.labelLarge)
                }
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
    val intensityLabel = intensityColumnLabel(target)
    val hasIntensity = intensityLabel != null
    // Pour l'allure (mm:ss), utiliser le clavier texte pour avoir accès à ":"
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

    Text(
        "INTERVALLES — ${execution.repeat.repeatCount} fois",
        style = MaterialTheme.typography.labelSmall,
        color = PandaSubtext,
        fontWeight = FontWeight.Bold,
    )
    Spacer(Modifier.height(8.dp))
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .border(1.dp, OrangeBorder, RoundedCornerShape(14.dp))
            .background(OrangeBg, RoundedCornerShape(14.dp)),
    ) {
        // En-tête
        Row(modifier = Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 8.dp)) {
            Text("#", style = MaterialTheme.typography.labelSmall, color = PandaSubtext, fontWeight = FontWeight.SemiBold, modifier = Modifier.width(30.dp))
            Text("Cible", style = MaterialTheme.typography.labelSmall, color = PandaSubtext, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f), textAlign = TextAlign.Center)
            Text("Tps", style = MaterialTheme.typography.labelSmall, color = PandaSubtext, fontWeight = FontWeight.SemiBold, modifier = Modifier.width(40.dp), textAlign = TextAlign.Center)
            if (hasIntensity) Text(intensityLabel!!, style = MaterialTheme.typography.labelSmall, color = PandaSubtext, fontWeight = FontWeight.SemiBold, modifier = Modifier.width(52.dp), textAlign = TextAlign.Center)
            Text("RPE", style = MaterialTheme.typography.labelSmall, color = PandaSubtext, fontWeight = FontWeight.SemiBold, modifier = Modifier.width(30.dp), textAlign = TextAlign.Center)
            Text("✓", style = MaterialTheme.typography.labelSmall, color = PandaSubtext, fontWeight = FontWeight.SemiBold, modifier = Modifier.width(28.dp), textAlign = TextAlign.Center)
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
                Checkbox(
                    checked = rep.done,
                    onCheckedChange = { onRepUpdate(idx, rep.copy(done = it)) },
                    modifier = Modifier.size(28.dp),
                    colors = CheckboxDefaults.colors(checkedColor = Color(0xFF7C5CBF), uncheckedColor = Color(0xFFE0E0E0)),
                )
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
            // En-tête
            Row(modifier = Modifier.fillMaxWidth().padding(horizontal = 10.dp, vertical = 4.dp)) {
                Text("Tps", style = MaterialTheme.typography.labelSmall, color = PandaSubtext, modifier = Modifier.weight(1f), textAlign = TextAlign.Center)
                if (intensityLabel != null) Text(intensityLabel, style = MaterialTheme.typography.labelSmall, color = PandaSubtext, modifier = Modifier.weight(1f), textAlign = TextAlign.Center)
                Text("RPE", style = MaterialTheme.typography.labelSmall, color = PandaSubtext, modifier = Modifier.width(40.dp), textAlign = TextAlign.Center)
                Text("✓", style = MaterialTheme.typography.labelSmall, color = PandaSubtext, modifier = Modifier.width(32.dp), textAlign = TextAlign.Center)
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
