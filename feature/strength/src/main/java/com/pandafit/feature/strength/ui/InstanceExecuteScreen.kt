package com.pandafit.feature.strength.ui

import android.app.Activity
import android.media.AudioManager
import android.media.ToneGenerator
import android.view.WindowManager
import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Stop
import androidx.compose.material.icons.filled.Timer
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.FilledTonalIconButton
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.repeatOnLifecycle
import com.pandafit.core.database.entities.BlocSeanceEntity
import com.pandafit.core.database.entities.BlocType
import com.pandafit.core.database.entities.RepsType
import com.pandafit.core.database.entities.SerieRealiseeEntity
import com.pandafit.core.database.relations.ExerciceSeanceWithExercise
import com.pandafit.designsystem.components.PandaLoadingIndicator
import com.pandafit.designsystem.theme.PandaSubtext
import com.pandafit.feature.strength.model.CircuitPhase
import com.pandafit.feature.strength.model.SerieRealiseeState
import com.pandafit.feature.strength.viewmodel.InstanceExecuteViewModel
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale

// ===== Local types =====

private data class CellFocus(val exerciceId: Long, val serieNum: Int, val column: SerieColumn)

private enum class SerieColumn { REPS, KG, REPOS, RPE }

private data class SerieRowDraft(val reps: String = "", val kg: String = "", val repos: String = "", val rpe: String = "")

private sealed class KeyAction {
    data class Digit(val char: Char) : KeyAction()
    object Comma : KeyAction()
    object Plus30 : KeyAction()
    object Minus30 : KeyAction()
    object Backspace : KeyAction()
    object Next : KeyAction()
    object Close : KeyAction()
}

// ===== Screen =====

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun InstanceExecuteScreen(
    instanceId: Long,
    onNavigateBack: () -> Unit,
    onNavigateToEditInstance: (seanceId: Long, instanceId: Long) -> Unit = { _, _ -> },
    onNavigateToReport: () -> Unit = {},
    viewModel: InstanceExecuteViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val sessionSeconds by viewModel.sessionSeconds.collectAsStateWithLifecycle()
    val restRemaining by viewModel.restRemaining.collectAsStateWithLifecycle()
    val exerciceRemaining by viewModel.exerciceRemaining.collectAsStateWithLifecycle()
    val lastManualTimerSeconds by viewModel.lastManualTimerSeconds.collectAsStateWithLifecycle()
    val keyboardController = LocalSoftwareKeyboardController.current
    val lifecycleOwner = LocalLifecycleOwner.current

    LaunchedEffect(lifecycleOwner) {
        lifecycleOwner.lifecycle.repeatOnLifecycle(Lifecycle.State.RESUMED) {
            viewModel.reload()
        }
    }

    // Naviguer vers le groupe suivant quand le chrono de fin de round se termine (7.2)
    LaunchedEffect(Unit) {
        viewModel.restFinishedEvent.collect {
            viewModel.navigateAfterRest()
        }
    }

    // ── Sons countdown (repos + exercice circuit + exercice seul) ────────────
    val toneRest = remember { ToneGenerator(AudioManager.STREAM_MUSIC, 80) }
    val toneExercice = remember { ToneGenerator(AudioManager.STREAM_MUSIC, 90) }
    val toneExerciceEnd = remember { ToneGenerator(AudioManager.STREAM_MUSIC, 100) }
    DisposableEffect(Unit) { onDispose { toneRest.release(); toneExercice.release(); toneExerciceEnd.release() } }

    // Beep repos — bip simple discret
    LaunchedEffect(Unit) {
        viewModel.restCountdownBeep.collect {
            toneRest.startTone(ToneGenerator.TONE_PROP_BEEP, 120)
        }
    }

    // Beep exercice circuit — double bip rythmique (5 dernières secondes)
    LaunchedEffect(Unit) {
        viewModel.exerciceBeep.collect {
            toneExercice.startTone(ToneGenerator.TONE_PROP_BEEP2, 100)
        }
    }

    // Bip départ exercice seul (fin du décompte 3-2-1)
    LaunchedEffect(Unit) {
        viewModel.exerciceStartBeep.collect {
            toneExerciceEnd.startTone(ToneGenerator.TONE_PROP_BEEP2, 200)
        }
    }

    // Bip fin exercice seul (minuteur atteint 0)
    LaunchedEffect(Unit) {
        viewModel.exerciceEndBeep.collect {
            toneExerciceEnd.startTone(ToneGenerator.TONE_CDMA_ALERT_CALL_GUARD, 800)
        }
    }

    var focusedCell by remember { mutableStateOf<CellFocus?>(null) }
    var inputBuffer by remember { mutableStateOf("") }
    var seriesDraft by remember { mutableStateOf<Map<Long, Map<Int, SerieRowDraft>>>(emptyMap()) }
    var demarrerError by remember { mutableStateOf<String?>(null) }
    var showPencilMenu by remember { mutableStateOf(false) }
    var showRenameDialog by remember { mutableStateOf(false) }
    var showDeleteDialog by remember { mutableStateOf(false) }
    var showRestMenu by remember { mutableStateOf(false) }
    var showExitDialog by remember { mutableStateOf(false) }
    var showReturnDialog by remember { mutableStateOf(false) }
    var showManualTimer by remember { mutableStateOf(false) }

    // ── Empêcher la mise en veille pendant la séance (7.3) ─────────────────────
    val view = LocalView.current
    DisposableEffect(Unit) {
        val window = (view.context as? Activity)?.window
        window?.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        onDispose { window?.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON) }
    }

    val hasProgress = uiState.seriesParExercice.values.any { s -> s.any { it.isCompleted } }
    // Séance en cours non terminée : demander confirmation avant de quitter (même sans série validée)
    BackHandler(enabled = !uiState.isCompleted) { showExitDialog = true }
    // Séance terminée modifiée depuis le rapport : demander confirmation avant de retourner
    BackHandler(enabled = uiState.isCompleted && uiState.isDirty) { showReturnDialog = true }

    if (showReturnDialog) {
        androidx.compose.material3.AlertDialog(
            onDismissRequest = { showReturnDialog = false },
            title = { androidx.compose.material3.Text("Retourner au rapport ?") },
            text = { androidx.compose.material3.Text("Les modifications ont été enregistrées automatiquement.") },
            confirmButton = {
                androidx.compose.material3.TextButton(onClick = { showReturnDialog = false; onNavigateBack() }) {
                    androidx.compose.material3.Text("Retourner", fontWeight = androidx.compose.ui.text.font.FontWeight.SemiBold)
                }
            },
            dismissButton = {
                androidx.compose.material3.TextButton(onClick = { showReturnDialog = false }) {
                    androidx.compose.material3.Text("Continuer à modifier")
                }
            },
        )
    }

    fun applyBuffer(cell: CellFocus, buffer: String) {
        if (buffer.isBlank()) return
        val exDraft = seriesDraft[cell.exerciceId]?.toMutableMap() ?: mutableMapOf()
        val row = exDraft[cell.serieNum] ?: SerieRowDraft()
        exDraft[cell.serieNum] = when (cell.column) {
            SerieColumn.REPS -> row.copy(reps = buffer)
            SerieColumn.KG -> row.copy(kg = buffer)
            SerieColumn.REPOS -> row.copy(repos = buffer)
            SerieColumn.RPE -> row.copy(rpe = buffer)
        }
        val newDraft = seriesDraft.toMutableMap().apply { put(cell.exerciceId, exDraft) }

        // Propager KG aux séries suivantes non-validées
        if (cell.column == SerieColumn.KG) {
            val seriesForEx = uiState.seriesParExercice[cell.exerciceId] ?: emptyList()
            val following = seriesForEx.filter { it.numeroSerie > cell.serieNum && !it.isCompleted }
            following.forEach { serie ->
                val eDraft = newDraft[cell.exerciceId]?.toMutableMap() ?: mutableMapOf()
                val r = eDraft[serie.numeroSerie] ?: SerieRowDraft()
                eDraft[serie.numeroSerie] = r.copy(kg = buffer)
                newDraft[cell.exerciceId] = eDraft
            }
        }
        seriesDraft = newDraft
    }

    fun moveFocusNext() {
        val cell = focusedCell ?: return
        applyBuffer(cell, inputBuffer)
        val nextCol = when (cell.column) {
            SerieColumn.REPS -> SerieColumn.KG
            SerieColumn.KG -> SerieColumn.REPOS
            SerieColumn.REPOS -> SerieColumn.RPE
            SerieColumn.RPE -> null
        }
        if (nextCol != null) {
            val serie = uiState.seriesParExercice[cell.exerciceId]?.find { it.numeroSerie == cell.serieNum }
            val draft = seriesDraft[cell.exerciceId]?.get(cell.serieNum)
            inputBuffer = when (nextCol) {
                SerieColumn.REPS -> draft?.reps ?: serie?.repsRealisees?.toString() ?: ""
                SerieColumn.KG -> draft?.kg ?: serie?.chargeLabel ?: ""
                SerieColumn.REPOS -> draft?.repos ?: run {
                    val sec = uiState.exercices.find { it.exerciceSeance.id == cell.exerciceId }
                        ?.exerciceSeance?.tempsReposSec ?: 0
                    if (sec > 0) sec.toString() else ""
                }
                SerieColumn.RPE -> draft?.rpe ?: ""
            }
            focusedCell = cell.copy(column = nextCol)
        } else {
            focusedCell = null
            inputBuffer = ""
        }
    }

    fun handleKey(action: KeyAction) {
        when (action) {
            is KeyAction.Digit -> inputBuffer += action.char
            KeyAction.Comma -> { if (',' !in inputBuffer) inputBuffer += ',' }
            KeyAction.Plus30 -> inputBuffer = ((inputBuffer.toIntOrNull() ?: 0) + 30).toString()
            KeyAction.Minus30 -> inputBuffer = maxOf(0, (inputBuffer.toIntOrNull() ?: 0) - 30).toString()
            KeyAction.Backspace -> inputBuffer = inputBuffer.dropLast(1)
            KeyAction.Next -> moveFocusNext()
            KeyAction.Close -> {
                focusedCell?.let { applyBuffer(it, inputBuffer) }
                inputBuffer = ""
                focusedCell = null
            }
        }
    }

    fun handleFait(exerciceId: Long, serieNum: Int, exercice: ExerciceSeanceWithExercise) {
        focusedCell?.let { cell ->
            if (cell.exerciceId == exerciceId && cell.serieNum == serieNum) {
                applyBuffer(cell, inputBuffer)
                inputBuffer = ""
                focusedCell = null
            }
        }
        val serie = uiState.seriesParExercice[exerciceId]?.find { it.numeroSerie == serieNum }
        val draft = seriesDraft[exerciceId]?.get(serieNum) ?: SerieRowDraft()

        val repsStr = draft.reps.ifBlank { serie?.repsRealisees?.toString() ?: "" }
        val kgStr = draft.kg.ifBlank { serie?.chargeLabel ?: "" }
        val reposDraftStr = draft.repos.ifBlank { null }
        val rpeStr = draft.rpe.ifBlank { "" }

        val reps = repsStr.toIntOrNull()
        val chargeLabel = kgStr.trim().ifBlank { null }
        val chargeKg = chargeLabel?.replace(" kg", "")?.replace(",", ".")?.toFloatOrNull()
        val rpe = rpeStr.replace(",", ".").toFloatOrNull()?.coerceIn(1f, 10f)

        viewModel.updateSerie(exerciceId, serieNum, reps, chargeLabel, chargeKg, rpe)
        // Navigation automatique + timer de repos gérés entièrement par le ViewModel
        viewModel.navigateToNext(exerciceId, reposOverrideSec = reposDraftStr?.toIntOrNull())
    }

    if (showExitDialog) {
        AlertDialog(
            onDismissRequest = { showExitDialog = false },
            title = { Text("Quitter la séance ?", fontWeight = FontWeight.Bold) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    // Option 1 — Rester
                    TextButton(
                        onClick = { showExitDialog = false },
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Text("Rester ici", style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold)
                    }
                    HorizontalDivider(modifier = Modifier.padding(horizontal = 8.dp))
                    // Option 2 — Aller dans le menu (session reste active si progression)
                    TextButton(
                        onClick = {
                            if (!hasProgress) viewModel.cancelInstance()
                            showExitDialog = false
                            onNavigateBack()
                        },
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Text(
                            if (hasProgress) "Aller dans le menu" else "Quitter sans enregistrer",
                            style = MaterialTheme.typography.bodyMedium,
                        )
                    }
                    HorizontalDivider(modifier = Modifier.padding(horizontal = 8.dp))
                    // Option 3 — Annuler (remet à zéro sans supprimer)
                    TextButton(
                        onClick = { viewModel.cancelInstance(); showExitDialog = false; onNavigateBack() },
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Text("Annuler la séance", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.error)
                    }
                }
            },
            confirmButton = {},
        )
    }

    if (showRenameDialog) {
        var nomInput by remember(uiState.seance?.nom) { mutableStateOf(uiState.seance?.nom ?: "") }
        AlertDialog(
            onDismissRequest = { showRenameDialog = false },
            title = { Text("Modifier le nom") },
            text = {
                OutlinedTextField(
                    value = nomInput,
                    onValueChange = { nomInput = it },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
            },
            confirmButton = {
                TextButton(onClick = { viewModel.updateSeanceName(nomInput); showRenameDialog = false }) {
                    Text("Valider", fontWeight = FontWeight.SemiBold)
                }
            },
            dismissButton = { TextButton(onClick = { showRenameDialog = false }) { Text("Annuler") } },
        )
    }

    if (showDeleteDialog) {
        AlertDialog(
            onDismissRequest = { showDeleteDialog = false },
            title = { Text("Supprimer la séance ?") },
            text = { Text("Cette séance planifiée sera supprimée.", style = MaterialTheme.typography.bodySmall) },
            confirmButton = {
                TextButton(onClick = { viewModel.deleteInstance(); onNavigateBack() }) {
                    Text("Supprimer", color = MaterialTheme.colorScheme.error, fontWeight = FontWeight.SemiBold)
                }
            },
            dismissButton = { TextButton(onClick = { showDeleteDialog = false }) { Text("Annuler") } },
        )
    }

    if (uiState.isLoading) { PandaLoadingIndicator(); return }

    val exercices = uiState.exercices
    val activeIndex = uiState.activeExerciceIndex.coerceIn(0, maxOf(0, exercices.size - 1))
    val activeExercice = exercices.getOrNull(activeIndex)
    val activeExerciceId = activeExercice?.exerciceSeance?.id
    val activeBloc = activeExercice?.exerciceSeance?.blocId?.let { bid -> uiState.blocs.find { it.id == bid } }

    // Dernier exercice du bloc en cours → doit afficher tempsReposFinRoundSec
    val isLastInBloc = run {
        val blocId = activeExercice?.exerciceSeance?.blocId ?: return@run false
        val exercicesInBloc = exercices
            .filter { it.exerciceSeance.blocId == blocId }
            .sortedBy { it.exerciceSeance.position }
        exercicesInBloc.lastOrNull()?.exerciceSeance?.id == activeExerciceId
    }

    Scaffold(
        topBar = {
            InstanceExecuteTopBar(
                seanceName = uiState.seance?.nom ?: "Séance",
                cycleLabel = uiState.seance?.notes?.trim()?.takeIf { it.isNotBlank() },
                sessionSeconds = sessionSeconds,
                restRemaining = restRemaining,
                showPencilMenu = showPencilMenu,
                showRestMenu = showRestMenu,
                onNavigateBack = {
                    if (hasProgress && !uiState.isCompleted) showExitDialog = true else onNavigateBack()
                },
                onPencilClick = { showPencilMenu = true },
                onPencilDismiss = { showPencilMenu = false },
                onRenameClick = { showPencilMenu = false; showRenameDialog = true },
                onEditExercisesClick = {
                    showPencilMenu = false
                    uiState.instance?.let { inst -> onNavigateToEditInstance(inst.seanceId, inst.id) }
                },
                onDeleteClick = { showPencilMenu = false; showDeleteDialog = true },
                onRestTimerClick = { showRestMenu = true },
                onRestMenuDismiss = { showRestMenu = false },
                onRestPlus30 = { viewModel.adjustRestTimer(+30); showRestMenu = false },
                onRestMinus30 = { viewModel.adjustRestTimer(-30); showRestMenu = false },
                onRestStop = { viewModel.stopRestTimer(); showRestMenu = false },
                onFinir = { onNavigateToReport() },
            )
        },
        containerColor = MaterialTheme.colorScheme.background,
    ) { innerPadding ->
        Box(modifier = Modifier.fillMaxSize().padding(innerPadding)) {
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(bottom = if (focusedCell != null) 270.dp else 80.dp),
            ) {
                item {
                    HorizontalExerciseNav(
                        exercices = exercices,
                        blocs = uiState.blocs,
                        activeIndex = activeIndex,
                        onSelect = { viewModel.setActiveExercice(it) },
                    )
                }

                if (activeExercice != null && activeExerciceId != null) {
                    // Consigne de l'exercice (depuis le template)
                    val consigne = activeExercice.exerciceSeance.consigneCle.trim()
                    if (consigne.isNotBlank()) {
                        item {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(horizontal = 16.dp, vertical = 4.dp)
                                    .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f), RoundedCornerShape(6.dp))
                                    .padding(horizontal = 10.dp, vertical = 6.dp),
                            ) {
                                Text("💬 $consigne", style = MaterialTheme.typography.bodySmall, color = PandaSubtext)
                            }
                        }
                    }

                    // Commentaire exercice
                    item {
                        CommentaireExerciceSection(
                            exerciceNom = activeExercice.exercise.name,
                            notes = uiState.exerciceNotesLocal[activeExerciceId] ?: "",
                            onNotesChange = { viewModel.updateExerciceNote(activeExerciceId, it) },
                        )
                    }

                    // En-tête bloc
                    if (activeBloc != null) {
                        item {
                            val color = blocColor(activeBloc.type)
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(start = 16.dp, top = 12.dp, end = 16.dp, bottom = 0.dp)
                                    .background(color.copy(alpha = 0.08f), RoundedCornerShape(6.dp))
                                    .padding(horizontal = 10.dp, vertical = 6.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(6.dp),
                            ) {
                                Box(Modifier.width(3.dp).height(14.dp).background(color, RoundedCornerShape(2.dp)))
                                Column {
                                    Text(
                                        buildString {
                                            append(activeBloc.nom.uppercase())
                                            activeExercice.exerciceSeance.supersetGroupe?.let { append(" — $it") }
                                        },
                                        style = MaterialTheme.typography.labelSmall,
                                        fontWeight = FontWeight.Bold,
                                        color = color,
                                    )
                                    if (activeBloc.type == BlocType.SUPERSET || activeBloc.type == BlocType.CIRCUIT) {
                                        Text(
                                            "Inter: ${formatRestSec(activeBloc.tempsReposInterSec)} · Round: ${formatRestSec(activeBloc.tempsReposFinRoundSec)}",
                                            style = MaterialTheme.typography.labelSmall,
                                            color = color.copy(alpha = 0.8f),
                                        )
                                    }
                                }
                            }
                        }
                    }

                    // ── Bouton de démarrage (CIRCUIT auto-enchaîné ou exercice DURATION seul) ──
                    if (uiState.circuitMode == null && uiState.countdownSeconds == 0 && activeExercice != null) {
                        val isCircuitBloc = activeBloc?.type == BlocType.CIRCUIT
                        if (isCircuitBloc) {
                            val firstDuration = exercices
                                .filter { it.exerciceSeance.blocId == activeBloc!!.id }
                                .sortedBy { it.exerciceSeance.position }
                                .firstOrNull { it.exerciceSeance.repsType == RepsType.DURATION && it.exerciceSeance.repsCibles.toIntOrNull() != null }
                            if (firstDuration != null) {
                                item {
                                    Button(
                                        onClick = { viewModel.startCircuit(firstDuration.exerciceSeance.id) },
                                        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
                                        shape = RoundedCornerShape(12.dp),
                                    ) {
                                        Icon(Icons.Default.PlayArrow, null, modifier = Modifier.size(18.dp))
                                        Spacer(Modifier.width(8.dp))
                                        Text("Lancer le circuit", fontWeight = FontWeight.Bold)
                                    }
                                }
                            }
                        } else if (activeExercice.exerciceSeance.repsType == RepsType.DURATION &&
                            activeExercice.exerciceSeance.repsCibles.toIntOrNull() != null) {
                            // Exercice libre, ECHAUFFEMENT, SUPERSET, RECUPERATION — démarre seul,
                            // sans auto-enchaîner le suivant après le timer
                            item {
                                Button(
                                    onClick = {
                                        val exId = activeExerciceId!!
                                        val firstIncomplete = uiState.seriesForExercice(exId).firstOrNull { !it.isCompleted }
                                        val serieNum = firstIncomplete?.numeroSerie
                                        val activeCellReps = if (
                                            focusedCell?.exerciceId == exId &&
                                            focusedCell?.serieNum == serieNum &&
                                            focusedCell?.column == SerieColumn.REPS
                                        ) inputBuffer else null
                                        val draftReps = serieNum?.let { seriesDraft[exId]?.get(it)?.reps }
                                        val rawValue = activeCellReps?.takeIf { it.isNotBlank() }
                                            ?: draftReps?.takeIf { it.isNotBlank() }
                                            ?: firstIncomplete?.repsRealisees?.toString()
                                        val effectiveSecs = rawValue?.toIntOrNull()
                                        if (effectiveSecs == null || effectiveSecs <= 0) {
                                            demarrerError = "Durée invalide — saisis un nombre de secondes valide"
                                        } else {
                                            demarrerError = null
                                            viewModel.startExerciceSeul(exId, durationOverride = effectiveSecs)
                                        }
                                    },
                                    modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
                                    shape = RoundedCornerShape(12.dp),
                                    colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.secondary),
                                ) {
                                    Icon(Icons.Default.PlayArrow, null, modifier = Modifier.size(18.dp))
                                    Spacer(Modifier.width(8.dp))
                                    Text("Démarrer", fontWeight = FontWeight.Bold)
                                }
                                demarrerError?.let { msg ->
                                    Text(
                                        text = msg,
                                        color = MaterialTheme.colorScheme.error,
                                        style = MaterialTheme.typography.bodySmall,
                                        modifier = Modifier.padding(horizontal = 20.dp, vertical = 2.dp),
                                    )
                                }
                            }
                        }
                    }

                    item {
                        Text(
                            "SÉANCE DU JOUR",
                            style = MaterialTheme.typography.labelSmall,
                            color = PandaSubtext,
                            fontWeight = FontWeight.SemiBold,
                            modifier = Modifier.padding(start = 16.dp, top = 16.dp, end = 16.dp, bottom = 4.dp),
                        )
                    }
                    item {
                        SeriesTableHeader(
                            repsLabel = if (activeExercice?.exerciceSeance?.repsType == RepsType.DURATION) "Temps" else "Reps",
                        )
                    }

                    val seriesForActive = uiState.seriesForExercice(activeExerciceId)
                    items(seriesForActive, key = { "${activeExerciceId}_${it.numeroSerie}" }) { serie ->
                        val draft = seriesDraft[activeExerciceId]?.get(serie.numeroSerie) ?: SerieRowDraft()
                        SerieRow(
                            num = serie.numeroSerie,
                            serie = serie,
                            draft = draft,
                            exercice = activeExercice,
                            activeBloc = activeBloc,
                            isLastInBloc = isLastInBloc,
                            focusedCell = focusedCell,
                            inputBuffer = inputBuffer,
                            onCellTap = { col ->
                                if (!serie.isCompleted) {
                                    focusedCell?.let { applyBuffer(it, inputBuffer) }
                                    val d = seriesDraft[activeExerciceId]?.get(serie.numeroSerie)
                                    inputBuffer = when (col) {
                                        SerieColumn.REPS -> d?.reps ?: serie.repsRealisees?.toString() ?: ""
                                        SerieColumn.KG -> d?.kg ?: serie.chargeLabel ?: ""
                                        SerieColumn.REPOS -> d?.repos ?: run {
                                            val sec = activeExercice.exerciceSeance.tempsReposSec
                                            if (sec > 0) sec.toString() else ""
                                        }
                                        SerieColumn.RPE -> d?.rpe ?: ""
                                    }
                                    keyboardController?.hide()
                                    focusedCell = CellFocus(activeExerciceId, serie.numeroSerie, col)
                                }
                            },
                            onFait = {
                                if (serie.isCompleted) viewModel.unvalidateSerie(activeExerciceId, serie.numeroSerie)
                                else handleFait(activeExerciceId, serie.numeroSerie, activeExercice)
                            },
                        )
                        HorizontalDivider(
                            modifier = Modifier.padding(horizontal = 16.dp),
                            color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.4f),
                        )
                    }

                    item {
                        SerieActionsRow(
                            onSupprimer = { viewModel.removeSerie(activeExerciceId) },
                            onAjouter = { viewModel.addSerie(activeExerciceId) },
                        )
                    }

                    val histo = uiState.historiqueComplet[activeExerciceId] ?: emptyList()
                    if (histo.isNotEmpty()) {
                        item { HistoriqueSection(histo) }
                    }

                    // Commentaire séance (en bas)
                    item {
                        HorizontalDivider(modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp))
                        CommentaireSeanceSection(
                            notes = uiState.instance?.notes ?: "",
                            onNotesChange = { viewModel.updateNotes(it) },
                        )
                    }
                }
            }

            AnimatedVisibility(
                visible = focusedCell != null && uiState.circuitMode == null && uiState.countdownSeconds == 0,
                enter = slideInVertically { it },
                exit = slideOutVertically { it },
                modifier = Modifier.align(Alignment.BottomCenter),
            ) {
                NumericKeyboard(activeColumn = focusedCell?.column, onKey = ::handleKey)
            }

            // ── FAB Minuteur manuel (7.4) ─────────────────────────────────────
            AnimatedVisibility(
                visible = focusedCell == null && uiState.circuitMode == null && uiState.countdownSeconds == 0,
                enter = slideInVertically { it },
                exit = slideOutVertically { it },
                modifier = Modifier
                    .align(Alignment.BottomEnd)
                    .padding(end = 16.dp, bottom = 16.dp),
            ) {
                FloatingActionButton(
                    onClick = { showManualTimer = true },
                    containerColor = MaterialTheme.colorScheme.primaryContainer,
                    modifier = Modifier.size(48.dp),
                ) {
                    Icon(Icons.Default.Timer, "Minuteur manuel", tint = MaterialTheme.colorScheme.onPrimaryContainer, modifier = Modifier.size(22.dp))
                }
            }

            // ── Overlay décompte 3-2-1 ───────────────────────────────────────
            if (uiState.countdownSeconds > 0) {
                CountdownOverlay(
                    seconds = uiState.countdownSeconds,
                    exerciceName = exercices.getOrNull(activeIndex)?.exercise?.name ?: "",
                )
            }

            // ── Overlay circuit automatique ───────────────────────────────────
            uiState.circuitMode?.let { phase ->
                CircuitOverlay(
                    phase = phase,
                    exerciceRemaining = exerciceRemaining,
                    restRemaining = restRemaining,
                    onStop = { viewModel.stopCircuit() },
                )
            }
        }
    }

    // ── Minuteur manuel (bottom sheet, 7.4) ───────────────────────────────────
    if (showManualTimer) {
        ManualTimerSheet(
            initialSeconds = lastManualTimerSeconds,
            restRemaining = restRemaining,
            onStart = { sec -> viewModel.startManualTimer(sec) },
            onStop = { viewModel.stopRestTimer() },
            onAdjust = { delta -> viewModel.adjustRestTimer(delta) },
            onDismiss = { showManualTimer = false },
        )
    }
}

// ── Minuteur manuel (7.4) ─────────────────────────────────────────────────────

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ManualTimerSheet(
    initialSeconds: Int,
    restRemaining: Int,
    onStart: (Int) -> Unit,
    onStop: () -> Unit,
    onAdjust: (Int) -> Unit,
    onDismiss: () -> Unit,
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    var selectedSeconds by remember(initialSeconds) { mutableStateOf(initialSeconds) }
    val isRunning = restRemaining > 0

    val presets = listOf(
        30 to "30s", 60 to "1 min", 90 to "1m30", 120 to "2 min", 180 to "3 min", 300 to "5 min",
    )
    val presetRows = presets.chunked(3)

    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = sheetState) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 24.dp, vertical = 8.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Text(
                "⏱  Minuteur manuel",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
            )
            Spacer(Modifier.height(20.dp))

            // ── Preset chips ──
            presetRows.forEach { row ->
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    row.forEach { (sec, label) ->
                        FilterChip(
                            selected = selectedSeconds == sec,
                            onClick = { selectedSeconds = sec },
                            label = { Text(label, style = MaterialTheme.typography.labelMedium) },
                        )
                    }
                }
                Spacer(Modifier.height(6.dp))
            }

            Spacer(Modifier.height(16.dp))

            // ── Affichage MM:SS avec −/+ (±5s) ──
            val display = if (isRunning) restRemaining else selectedSeconds
            val mm = display / 60
            val ss = display % 60
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.Center,
                modifier = Modifier.fillMaxWidth(),
            ) {
                if (!isRunning) {
                    FilledTonalIconButton(
                        onClick = { if (selectedSeconds > 5) selectedSeconds -= 5 },
                        modifier = Modifier.size(48.dp),
                    ) {
                        Text("−", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                    }
                    Spacer(Modifier.width(16.dp))
                }
                Text(
                    "${mm.toString().padStart(2, '0')}:${ss.toString().padStart(2, '0')}",
                    style = MaterialTheme.typography.displayMedium,
                    fontWeight = FontWeight.Bold,
                    color = when {
                        isRunning && restRemaining <= 10 -> Color.Red
                        isRunning -> MaterialTheme.colorScheme.primary
                        else -> MaterialTheme.colorScheme.onSurface
                    },
                )
                if (!isRunning) {
                    Spacer(Modifier.width(16.dp))
                    FilledTonalIconButton(
                        onClick = { selectedSeconds += 5 },
                        modifier = Modifier.size(48.dp),
                    ) {
                        Text("+", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                    }
                }
            }

            Spacer(Modifier.height(20.dp))

            // ── Contrôles ──
            if (isRunning) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    OutlinedButton(onClick = { onAdjust(-30) }, modifier = Modifier.weight(1f)) {
                        Text("−30s", fontWeight = FontWeight.SemiBold)
                    }
                    OutlinedButton(onClick = { onAdjust(+30) }, modifier = Modifier.weight(1f)) {
                        Text("+30s", fontWeight = FontWeight.SemiBold)
                    }
                    Button(
                        onClick = { onStop(); onDismiss() },
                        modifier = Modifier.weight(1f),
                        colors = ButtonDefaults.buttonColors(containerColor = Color.Red),
                    ) {
                        Icon(Icons.Default.Stop, null, modifier = Modifier.size(16.dp))
                        Spacer(Modifier.width(4.dp))
                        Text("Stop")
                    }
                }
            } else {
                Button(
                    onClick = { onStart(selectedSeconds); onDismiss() },
                    modifier = Modifier.fillMaxWidth().height(52.dp),
                    shape = RoundedCornerShape(14.dp),
                ) {
                    Icon(Icons.Default.PlayArrow, null, modifier = Modifier.size(20.dp))
                    Spacer(Modifier.width(8.dp))
                    Text("Démarrer ${formatRestSec(selectedSeconds)}", fontWeight = FontWeight.Bold)
                }
            }
            Spacer(Modifier.height(28.dp))
        }
    }
}

private fun formatRestSec(seconds: Int): String = when {
    seconds <= 0 -> "—"
    seconds >= 60 -> "${seconds / 60}min${if (seconds % 60 > 0) "${seconds % 60}s" else ""}"
    else -> "${seconds}s"
}

// ===== Top bar =====

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun InstanceExecuteTopBar(
    seanceName: String,
    cycleLabel: String?,
    sessionSeconds: Int,
    restRemaining: Int,
    showPencilMenu: Boolean,
    showRestMenu: Boolean,
    onNavigateBack: () -> Unit,
    onPencilClick: () -> Unit,
    onPencilDismiss: () -> Unit,
    onRenameClick: () -> Unit,
    onEditExercisesClick: () -> Unit,
    onDeleteClick: () -> Unit,
    onRestTimerClick: () -> Unit,
    onRestMenuDismiss: () -> Unit,
    onRestPlus30: () -> Unit,
    onRestMinus30: () -> Unit,
    onRestStop: () -> Unit,
    onFinir: () -> Unit,
) {
    val sessionLabel = "${sessionSeconds / 60}:${(sessionSeconds % 60).toString().padStart(2, '0')}"
    TopAppBar(
        title = {
            Column {
                Text(seanceName, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                if (!cycleLabel.isNullOrBlank()) {
                    Text(cycleLabel, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1, overflow = TextOverflow.Ellipsis)
                }
            }
        },
        navigationIcon = {
            IconButton(onClick = onNavigateBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "Retour") }
        },
        actions = {
            Surface(shape = RoundedCornerShape(12.dp), color = MaterialTheme.colorScheme.surfaceVariant, modifier = Modifier.padding(end = 4.dp)) {
                Text(sessionLabel, style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Medium, modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp))
            }
            if (restRemaining > 0) {
                val restLabel = "${restRemaining / 60}:${(restRemaining % 60).toString().padStart(2, '0')}"
                val isCountdown = restRemaining <= 5
                Box {
                    Surface(
                        shape = RoundedCornerShape(12.dp),
                        color = if (isCountdown) Color.Red.copy(alpha = 0.25f) else Color.Red.copy(alpha = 0.12f),
                        modifier = Modifier.clickable(onClick = onRestTimerClick).padding(end = 4.dp),
                    ) {
                        Text(
                            restLabel,
                            style = MaterialTheme.typography.labelSmall,
                            fontWeight = FontWeight.Bold,
                            color = Color.Red,
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                        )
                    }
                    DropdownMenu(expanded = showRestMenu, onDismissRequest = onRestMenuDismiss) {
                        DropdownMenuItem(text = { Text("Allonger de 30s") }, onClick = onRestPlus30)
                        DropdownMenuItem(text = { Text("Écourter de 30s") }, onClick = onRestMinus30)
                        DropdownMenuItem(text = { Text("Arrêter") }, onClick = onRestStop)
                    }
                }
            }
            Box {
                IconButton(onClick = onPencilClick) { Icon(Icons.Default.Edit, "Éditer", modifier = Modifier.size(20.dp)) }
                DropdownMenu(expanded = showPencilMenu, onDismissRequest = onPencilDismiss) {
                    DropdownMenuItem(text = { Text("Modifier le nom") }, onClick = onRenameClick)
                    DropdownMenuItem(text = { Text("Modifier les exercices") }, onClick = onEditExercisesClick)
                    DropdownMenuItem(text = { Text("Supprimer la séance", color = MaterialTheme.colorScheme.error) }, onClick = onDeleteClick)
                }
            }
            Button(onClick = onFinir, colors = ButtonDefaults.buttonColors(containerColor = Color.Red), contentPadding = PaddingValues(horizontal = 12.dp, vertical = 0.dp), modifier = Modifier.height(32.dp).padding(end = 8.dp)) {
                Text("FINIR", style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold)
            }
        },
        colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.surface),
    )
}

// ===== Navigation horizontale =====

private val SupersetBorderColor = Color(0xFFF59E0B) // PandaOrange

@Composable
private fun HorizontalExerciseNav(
    exercices: List<ExerciceSeanceWithExercise>,
    blocs: List<BlocSeanceEntity>,
    activeIndex: Int,
    onSelect: (Int) -> Unit,
) {
    // Grouper les exercices par blocId pour encadrer les supersets
    data class ExGroup(val bloc: BlocSeanceEntity?, val items: List<Pair<Int, ExerciceSeanceWithExercise>>)

    val groups = buildList<ExGroup> {
        var currentBlocId: Long? = -1L
        var currentItems = mutableListOf<Pair<Int, ExerciceSeanceWithExercise>>()
        var currentBloc: BlocSeanceEntity? = null

        exercices.forEachIndexed { idx, ex ->
            val blocId = ex.exerciceSeance.blocId
            if (blocId != currentBlocId) {
                if (currentItems.isNotEmpty()) add(ExGroup(currentBloc, currentItems))
                currentItems = mutableListOf()
                currentBlocId = blocId
                currentBloc = blocId?.let { bid -> blocs.find { it.id == bid } }
            }
            currentItems.add(idx to ex)
        }
        if (currentItems.isNotEmpty()) add(ExGroup(currentBloc, currentItems))
    }

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .horizontalScroll(rememberScrollState())
            .padding(horizontal = 16.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        groups.forEach { group ->
            val isSuperset = group.bloc?.type == BlocType.SUPERSET || group.bloc?.type == BlocType.CIRCUIT
            val isEchauffement = group.bloc?.type == BlocType.ECHAUFFEMENT
            val color = group.bloc?.let { blocColor(it.type) }

            if ((isSuperset && group.items.size > 1) || isEchauffement) {
                // ── Groupe avec encadrement (superset, circuit, échauffement) ──
                Box(
                    modifier = Modifier
                        .border(2.dp, color ?: SupersetBorderColor, RoundedCornerShape(12.dp))
                        .padding(horizontal = 6.dp, vertical = 4.dp),
                ) {
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        group.items.forEach { (globalIdx, ex) ->
                            ExerciceNavBadge(
                                ex = ex,
                                isActive = globalIdx == activeIndex,
                                accentColor = color,
                                onClick = { onSelect(globalIdx) },
                            )
                        }
                    }
                }
            } else {
                // ── Exercices libres ──
                group.items.forEach { (globalIdx, ex) ->
                    ExerciceNavBadge(
                        ex = ex,
                        isActive = globalIdx == activeIndex,
                        accentColor = color,
                        onClick = { onSelect(globalIdx) },
                    )
                }
            }
        }
    }
}

@Composable
private fun ExerciceNavBadge(
    ex: ExerciceSeanceWithExercise,
    isActive: Boolean,
    accentColor: Color?,
    onClick: () -> Unit,
) {
    val color = accentColor ?: MaterialTheme.colorScheme.primary
    val label = ex.exercise.muscleGroups.firstOrNull()?.split(" ", "-")?.firstOrNull()?.take(4)?.uppercase()
        ?: ex.exercise.name.take(3).uppercase()
    Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.width(64.dp).clickable(onClick = onClick)) {
        Box(modifier = Modifier.size(44.dp).background(if (isActive) color else color.copy(alpha = 0.10f), CircleShape), contentAlignment = Alignment.Center) {
            Text(label, style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold, color = if (isActive) Color.White else color)
        }
        Spacer(Modifier.height(2.dp))
        Text(ex.exercise.name, style = MaterialTheme.typography.labelSmall.copy(fontSize = 9.sp), color = if (isActive) color else PandaSubtext, fontWeight = if (isActive) FontWeight.SemiBold else FontWeight.Normal, maxLines = 2, overflow = TextOverflow.Ellipsis, textAlign = TextAlign.Center)
        if (isActive) {
            Spacer(Modifier.height(2.dp))
            Box(modifier = Modifier.width(20.dp).height(2.dp).background(color, RoundedCornerShape(1.dp)))
        }
    }
}

// ===== Commentaires =====

@Composable
private fun CommentaireExerciceSection(exerciceNom: String, notes: String, onNotesChange: (String) -> Unit) {
    Column(modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp)) {
        Text("NOTE — $exerciceNom".uppercase(), style = MaterialTheme.typography.labelSmall, color = PandaSubtext, fontWeight = FontWeight.SemiBold)
        Spacer(Modifier.height(4.dp))
        OutlinedTextField(
            value = notes,
            onValueChange = onNotesChange,
            modifier = Modifier.fillMaxWidth(),
            placeholder = { Text("Note sur cet exercice...", style = MaterialTheme.typography.bodySmall) },
            minLines = 1,
            maxLines = 2,
            textStyle = MaterialTheme.typography.bodySmall,
        )
    }
}

@Composable
private fun CommentaireSeanceSection(notes: String, onNotesChange: (String) -> Unit) {
    Column(modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp)) {
        Text("NOTE DE SÉANCE", style = MaterialTheme.typography.labelSmall, color = PandaSubtext, fontWeight = FontWeight.SemiBold)
        Spacer(Modifier.height(4.dp))
        OutlinedTextField(
            value = notes,
            onValueChange = onNotesChange,
            modifier = Modifier.fillMaxWidth(),
            placeholder = { Text("Commentaire global de la séance...", style = MaterialTheme.typography.bodySmall) },
            minLines = 2,
            maxLines = 4,
            textStyle = MaterialTheme.typography.bodySmall,
        )
    }
}

// ===== En-têtes tableau =====

@Composable
private fun SeriesTableHeader(repsLabel: String = "Reps") {
    Row(modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp), horizontalArrangement = Arrangement.spacedBy(4.dp), verticalAlignment = Alignment.CenterVertically) {
        Text("#", style = MaterialTheme.typography.labelSmall, color = PandaSubtext, modifier = Modifier.width(24.dp))
        Text(repsLabel, style = MaterialTheme.typography.labelSmall, color = PandaSubtext, modifier = Modifier.weight(1f))
        Text("Kg", style = MaterialTheme.typography.labelSmall, color = PandaSubtext, modifier = Modifier.weight(1.2f))
        Text("Repos", style = MaterialTheme.typography.labelSmall, color = PandaSubtext, modifier = Modifier.weight(1f))
        Text("RPE", style = MaterialTheme.typography.labelSmall, color = PandaSubtext, modifier = Modifier.weight(0.8f))
        Spacer(modifier = Modifier.width(32.dp))
    }
}

// ===== Ligne de série =====

@Composable
private fun SerieRow(
    num: Int,
    serie: SerieRealiseeState,
    draft: SerieRowDraft,
    exercice: ExerciceSeanceWithExercise,
    activeBloc: BlocSeanceEntity?,
    isLastInBloc: Boolean,
    focusedCell: CellFocus?,
    inputBuffer: String,
    onCellTap: (SerieColumn) -> Unit,
    onFait: () -> Unit,
) {
    val exerciceId = exercice.exerciceSeance.id
    val isCompleted = serie.isCompleted
    val isSuperset = activeBloc != null && (activeBloc.type == BlocType.SUPERSET || activeBloc.type == BlocType.CIRCUIT)

    fun cellContent(col: SerieColumn): Pair<String, Boolean> {
        val isFocused = focusedCell?.exerciceId == exerciceId && focusedCell.serieNum == num && focusedCell.column == col
        if (isFocused) return inputBuffer to false
        return when (col) {
            SerieColumn.REPS -> draft.reps.ifBlank { null }?.let { it to false } ?: ((serie.repsRealisees?.toString() ?: "") to serie.isPreFilled)
            SerieColumn.KG -> draft.kg.ifBlank { null }?.let { it to false } ?: ((serie.chargeLabel ?: "") to serie.isPreFilled)
            SerieColumn.REPOS -> draft.repos.ifBlank { null }?.let { "${it}s" to false } ?: run {
                // Superset : dernier exercice du round → repos de fin de round ; sinon repos inter
                val sec = when {
                    isSuperset && isLastInBloc -> activeBloc!!.tempsReposFinRoundSec
                    isSuperset                -> activeBloc!!.tempsReposInterSec
                    else                      -> exercice.exerciceSeance.tempsReposSec
                }
                (if (sec > 0) "${sec}s" else "") to true
            }
            SerieColumn.RPE -> draft.rpe.ifBlank { null }?.let { it to false } ?: ("" to false)
        }
    }

    Row(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 5.dp).alpha(if (isCompleted) 0.45f else 1f),
        horizontalArrangement = Arrangement.spacedBy(4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text("$num", style = MaterialTheme.typography.bodySmall, fontWeight = FontWeight.Bold, color = Color.Red, modifier = Modifier.width(24.dp))
        val weights = mapOf(SerieColumn.REPS to 1f, SerieColumn.KG to 1.2f, SerieColumn.REPOS to 1f, SerieColumn.RPE to 0.8f)
        SerieColumn.entries.forEach { col ->
            val (value, isGrayed) = cellContent(col)
            val isFocused = focusedCell?.exerciceId == exerciceId && focusedCell?.serieNum == num && focusedCell?.column == col
            SerieCell(value = value, isFocused = isFocused, isGrayed = isGrayed, enabled = !isCompleted, onTap = { onCellTap(col) }, modifier = Modifier.weight(weights[col] ?: 1f))
        }
        Box(modifier = Modifier.width(32.dp), contentAlignment = Alignment.Center) {
            IconButton(onClick = onFait, modifier = Modifier.size(28.dp)) {
                Icon(if (isCompleted) Icons.Default.CheckCircle else Icons.Outlined.CheckCircle, "Valider", tint = if (isCompleted) Color.Red else PandaSubtext, modifier = Modifier.size(22.dp))
            }
        }
    }
}

@Composable
private fun SerieCell(value: String, isFocused: Boolean, isGrayed: Boolean, enabled: Boolean, onTap: () -> Unit, modifier: Modifier = Modifier) {
    val borderColor = if (isFocused) Color.Red else MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.6f)
    val textColor = when {
        isFocused -> MaterialTheme.colorScheme.onSurface
        isGrayed -> PandaSubtext.copy(alpha = 0.55f)
        value.isBlank() -> PandaSubtext.copy(alpha = 0.3f)
        else -> MaterialTheme.colorScheme.onSurface
    }
    Box(
        modifier = modifier.height(36.dp).border(if (isFocused) 2.dp else 1.dp, borderColor, RoundedCornerShape(4.dp)).then(if (enabled) Modifier.clickable(onClick = onTap) else Modifier).padding(horizontal = 4.dp, vertical = 2.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(if (value.isBlank() && isFocused) "▌" else value, style = MaterialTheme.typography.bodySmall, color = textColor, maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
}

// ===== Boutons =====

@Composable
private fun SerieActionsRow(onSupprimer: () -> Unit, onAjouter: () -> Unit) {
    Row(modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        OutlinedButton(onClick = onSupprimer, modifier = Modifier.weight(1f), colors = ButtonDefaults.outlinedButtonColors(contentColor = MaterialTheme.colorScheme.error), border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.error)) {
            Text("Supprimer", style = MaterialTheme.typography.labelSmall)
        }
        OutlinedButton(onClick = onAjouter, modifier = Modifier.weight(1f), colors = ButtonDefaults.outlinedButtonColors(contentColor = MaterialTheme.colorScheme.error), border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.error)) {
            Icon(Icons.Default.Add, null, modifier = Modifier.size(14.dp))
            Spacer(Modifier.width(4.dp))
            Text("Ajouter une série", style = MaterialTheme.typography.labelSmall)
        }
    }
}

// ===== Historique =====

@Composable
private fun HistoriqueSection(histoForExercice: List<Pair<LocalDate, List<SerieRealiseeEntity>>>) {
    val formatter = DateTimeFormatter.ofPattern("d MMM", Locale.FRENCH)
    Column(modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)) {
        HorizontalDivider(modifier = Modifier.padding(bottom = 8.dp))
        Text("Historique", style = MaterialTheme.typography.labelSmall, color = PandaSubtext, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(bottom = 6.dp))
        histoForExercice.forEach { (date, series) ->
            val nonEmpty = series.filter { it.repsRealisees != null || it.chargeLabel != null || it.chargeKg != null }
            if (nonEmpty.isEmpty()) return@forEach
            val dateStr = date.format(formatter)
            val allSame = nonEmpty.map { it.repsRealisees }.distinct().size == 1 && nonEmpty.map { it.chargeLabel ?: it.chargeKg?.let { k -> formatKg(k) } }.distinct().size == 1
            if (allSame) {
                val charge = nonEmpty.first().chargeLabel ?: nonEmpty.first().chargeKg?.let { formatKg(it) } ?: ""
                val avgRpe = nonEmpty.mapNotNull { it.rpe }.let { if (it.isEmpty()) null else it.average().toInt() }
                Text(buildString {
                    append("$dateStr — ${nonEmpty.size}×${nonEmpty.first().repsRealisees ?: "?"}")
                    if (charge.isNotBlank()) append(" @ $charge")
                    if (avgRpe != null) append(" — RPE $avgRpe")
                }, style = MaterialTheme.typography.bodySmall, color = PandaSubtext, modifier = Modifier.padding(vertical = 2.dp))
            } else {
                Text(dateStr, style = MaterialTheme.typography.bodySmall, color = PandaSubtext, fontWeight = FontWeight.SemiBold)
                nonEmpty.forEachIndexed { i, s ->
                    val charge = s.chargeLabel ?: s.chargeKg?.let { formatKg(it) } ?: ""
                    Text(buildString {
                        append("  S${i + 1}: ${s.repsRealisees ?: "?"}")
                        if (charge.isNotBlank()) append(" @ $charge")
                        s.rpe?.toInt()?.let { append(" — RPE $it") }
                    }, style = MaterialTheme.typography.bodySmall, color = PandaSubtext, modifier = Modifier.padding(start = 8.dp, top = 1.dp, bottom = 1.dp))
                }
            }
        }
    }
}

private fun formatKg(kg: Float): String = if (kg == kg.toLong().toFloat()) "${kg.toInt()} kg" else "$kg kg"

// ===== Overlay décompte 3-2-1 =====

@Composable
private fun CountdownOverlay(seconds: Int, exerciceName: String) {
    Box(
        modifier = Modifier.fillMaxSize().background(Color.Black.copy(alpha = 0.88f)),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(24.dp),
        ) {
            Text(
                exerciceName,
                style = MaterialTheme.typography.headlineMedium,
                color = Color.White,
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(horizontal = 32.dp),
            )
            Text(
                "$seconds",
                style = MaterialTheme.typography.displayLarge.copy(fontSize = 120.sp),
                fontWeight = FontWeight.Bold,
                color = when (seconds) { 1 -> Color.Red; 2 -> Color(0xFFFF8A65); else -> Color.White },
            )
            Text(
                "Prêt ?",
                style = MaterialTheme.typography.titleMedium,
                color = Color.White.copy(alpha = 0.6f),
            )
        }
    }
}

// ===== Overlay circuit automatique =====

@Composable
private fun CircuitOverlay(
    phase: CircuitPhase,
    exerciceRemaining: Int,
    restRemaining: Int,
    onStop: () -> Unit,
) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black.copy(alpha = 0.92f)),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(20.dp),
            modifier = Modifier.padding(horizontal = 32.dp),
        ) {
            when (phase) {
                is CircuitPhase.ExerciceActif -> {
                    Text(
                        "SÉRIE ${phase.numeroSerie} / ${phase.totalSeries}",
                        style = MaterialTheme.typography.labelLarge,
                        color = Color.White.copy(alpha = 0.65f),
                        fontWeight = FontWeight.Bold,
                    )
                    Text(
                        phase.exerciceName,
                        style = MaterialTheme.typography.headlineMedium,
                        color = Color.White,
                        fontWeight = FontWeight.Bold,
                        textAlign = TextAlign.Center,
                    )
                    // Grand décompte
                    val mm = exerciceRemaining / 60
                    val ss = exerciceRemaining % 60
                    Text(
                        "${mm.toString().padStart(2, '0')}:${ss.toString().padStart(2, '0')}",
                        style = MaterialTheme.typography.displayLarge.copy(fontSize = 88.sp),
                        fontWeight = FontWeight.Bold,
                        color = when {
                            exerciceRemaining <= 3 -> Color.Red
                            exerciceRemaining <= 10 -> Color(0xFFFF8A65)
                            else -> Color.White
                        },
                    )
                    Text(
                        "Exercice ${phase.positionInBloc} / ${phase.totalInBloc}",
                        style = MaterialTheme.typography.titleMedium,
                        color = Color.White.copy(alpha = 0.55f),
                    )
                }

                is CircuitPhase.Repos -> {
                    Text(
                        if (phase.isFinDeRound) "FIN DU ROUND — REPOS" else "REPOS",
                        style = MaterialTheme.typography.labelLarge,
                        color = Color.White.copy(alpha = 0.65f),
                        fontWeight = FontWeight.Bold,
                    )
                    // Grand décompte repos
                    val mm = restRemaining / 60
                    val ss = restRemaining % 60
                    Text(
                        "${mm.toString().padStart(2, '0')}:${ss.toString().padStart(2, '0')}",
                        style = MaterialTheme.typography.displayLarge.copy(fontSize = 88.sp),
                        fontWeight = FontWeight.Bold,
                        color = when {
                            restRemaining <= 3 -> Color.Red
                            restRemaining <= 10 -> Color(0xFFFF8A65)
                            else -> Color(0xFF90CAF9) // bleu doux
                        },
                    )
                    if (!phase.nextExerciceName.isNullOrBlank()) {
                        Text(
                            "Prochain : ${phase.nextExerciceName}",
                            style = MaterialTheme.typography.titleMedium,
                            color = Color.White.copy(alpha = 0.8f),
                            textAlign = TextAlign.Center,
                        )
                    }
                }
            }

            Spacer(Modifier.height(8.dp))
            OutlinedButton(
                onClick = onStop,
                colors = ButtonDefaults.outlinedButtonColors(contentColor = Color.White.copy(alpha = 0.6f)),
                border = androidx.compose.foundation.BorderStroke(1.dp, Color.White.copy(alpha = 0.3f)),
            ) {
                Icon(Icons.Default.Stop, null, modifier = Modifier.size(16.dp))
                Spacer(Modifier.width(6.dp))
                Text("Arrêter le circuit")
            }
        }
    }
}

// ===== Clavier numérique =====

@Composable
private fun NumericKeyboard(activeColumn: SerieColumn?, onKey: (KeyAction) -> Unit) {
    val canUse30 = activeColumn == SerieColumn.REPOS
    Surface(shadowElevation = 12.dp, color = MaterialTheme.colorScheme.surfaceVariant, modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(bottom = 8.dp)) {
            data class KeyDef(val label: String, val action: KeyAction)
            val rows = listOf(
                listOf(KeyDef("1", KeyAction.Digit('1')), KeyDef("2", KeyAction.Digit('2')), KeyDef("3", KeyAction.Digit('3')), KeyDef("⌨", KeyAction.Close)),
                listOf(KeyDef("4", KeyAction.Digit('4')), KeyDef("5", KeyAction.Digit('5')), KeyDef("6", KeyAction.Digit('6')), KeyDef("+30", KeyAction.Plus30)),
                listOf(KeyDef("7", KeyAction.Digit('7')), KeyDef("8", KeyAction.Digit('8')), KeyDef("9", KeyAction.Digit('9')), KeyDef("-30", KeyAction.Minus30)),
                listOf(KeyDef(",", KeyAction.Comma), KeyDef("0", KeyAction.Digit('0')), KeyDef("⌫", KeyAction.Backspace), KeyDef("→", KeyAction.Next)),
            )
            rows.forEach { rowKeys ->
                Row(modifier = Modifier.fillMaxWidth()) {
                    rowKeys.forEach { key ->
                        val is30 = key.action is KeyAction.Plus30 || key.action is KeyAction.Minus30
                        val isNext = key.action is KeyAction.Next
                        val isEnabled = !is30 || canUse30
                        Box(
                            modifier = Modifier.weight(1f).height(52.dp).background(if (isNext) Color.Red else Color.Transparent).then(if (isEnabled) Modifier.clickable { onKey(key.action) } else Modifier),
                            contentAlignment = Alignment.Center,
                        ) {
                            Text(key.label, style = MaterialTheme.typography.bodyMedium, fontWeight = if (isNext) FontWeight.Bold else FontWeight.Normal, color = when {
                                isNext -> Color.White
                                is30 && !isEnabled -> PandaSubtext.copy(alpha = 0.25f)
                                is30 -> Color.Red
                                else -> MaterialTheme.colorScheme.onSurface
                            })
                        }
                    }
                }
            }
        }
    }
}
