package com.pandafit.feature.timer.ui

import android.content.Context
import android.media.AudioManager
import android.media.ToneGenerator
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.VibrationEffect
import android.os.Vibrator
import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.wrapContentHeight
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState

import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.BookmarkBorder
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.EditCalendar
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.pandafit.designsystem.components.PandaTopBar
import com.pandafit.feature.timer.model.LapRecord
import com.pandafit.feature.timer.model.TimerConfig
import com.pandafit.feature.timer.model.TimerMode
import com.pandafit.feature.timer.model.TimerPhase
import com.pandafit.feature.timer.model.TimerUiState
import com.pandafit.feature.timer.viewmodel.TimerViewModel
import kotlin.math.abs

// ── Couleurs ──────────────────────────────────────────────────────────────────
private val StopwatchColor = Color(0xFF00BCD4)
private val CountdownColor = Color(0xFFEF5350)
private val TabataColor    = Color(0xFF3FA26A)
private val EmomColor      = Color(0xFF8B5CF6)
private val AmrapColor     = Color(0xFFF59E0B)
private val ForTimeColor   = Color(0xFF4A90E2)

private fun modeColor(mode: TimerMode): Color = when (mode) {
    TimerMode.STOPWATCH -> StopwatchColor
    TimerMode.COUNTDOWN -> CountdownColor
    TimerMode.TABATA    -> TabataColor
    TimerMode.EMOM      -> EmomColor
    TimerMode.AMRAP     -> AmrapColor
    TimerMode.FOR_TIME  -> ForTimeColor
    else                -> AmrapColor
}

private enum class TimerPage { HOME, CONFIG, RUNNING }

// ══════════════════════════════════════════════════════════════════════════════
// Écran principal
// ══════════════════════════════════════════════════════════════════════════════

@OptIn(ExperimentalMaterial3Api::class, ExperimentalFoundationApi::class)
@Composable
fun TimerScreen(
    onOpenDrawer: () -> Unit = {},
    viewModel: TimerViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val context = LocalContext.current
    var page by rememberSaveable { mutableStateOf(TimerPage.HOME) }

    // Sons
    LaunchedEffect(Unit) {
        viewModel.beepEvent.collect { type ->
            try {
                val vol = when (type) {
                    TimerViewModel.BeepType.GONG           -> ToneGenerator.MAX_VOLUME
                    TimerViewModel.BeepType.COUNTDOWN_BEEP -> (ToneGenerator.MAX_VOLUME * 0.6).toInt()
                    else                                   -> (ToneGenerator.MAX_VOLUME * 0.5).toInt()
                }
                val tone = when (type) {
                    TimerViewModel.BeepType.GONG           -> ToneGenerator.TONE_CDMA_ALERT_CALL_GUARD
                    TimerViewModel.BeepType.COUNTDOWN_BEEP -> ToneGenerator.TONE_PROP_BEEP
                    TimerViewModel.BeepType.PHASE_CHANGE   -> ToneGenerator.TONE_CDMA_ANSWER
                    else                                   -> ToneGenerator.TONE_PROP_BEEP2
                }
                val duration = if (type == TimerViewModel.BeepType.GONG) 1500 else 200
                val tg = ToneGenerator(AudioManager.STREAM_ALARM, vol)
                tg.startTone(tone, duration)
                Handler(Looper.getMainLooper()).postDelayed({ tg.release() }, duration + 100L)
            } catch (_: Exception) {}
        }
    }

    // Vibration fin de décompte
    LaunchedEffect(Unit) {
        viewModel.finishEvent.collect {
            try {
                @Suppress("DEPRECATION")
                val vib = context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    vib?.vibrate(VibrationEffect.createWaveform(longArrayOf(0L, 500L, 100L, 300L), -1))
                } else {
                    @Suppress("DEPRECATION")
                    vib?.vibrate(longArrayOf(0L, 500L, 100L, 300L), -1)
                }
            } catch (_: Exception) {}
        }
    }

    // Navigation automatique selon phase
    LaunchedEffect(uiState.phase, uiState.config.mode) {
        val mode = uiState.config.mode
        when (uiState.phase) {
            TimerPhase.IDLE -> {
                if (page == TimerPage.RUNNING) {
                    page = when (mode) {
                        TimerMode.STOPWATCH -> TimerPage.RUNNING  // reste sur place, prêt à démarrer
                        TimerMode.COUNTDOWN -> TimerPage.CONFIG   // retour config pour rechoisir durée
                        else                -> TimerPage.HOME     // HIIT : retour accueil
                    }
                }
            }
            TimerPhase.DONE -> {
                // COUNTDOWN : rester sur RUNNING pour afficher "Terminé !"
                if (page == TimerPage.RUNNING && mode != TimerMode.COUNTDOWN) {
                    page = TimerPage.HOME
                }
            }
            else -> if (page != TimerPage.RUNNING) page = TimerPage.RUNNING
        }
    }

    // BackHandler global
    BackHandler(enabled = page != TimerPage.HOME) {
        val mode = uiState.config.mode
        viewModel.exitPresetDeleteMode()
        when {
            page == TimerPage.RUNNING -> {
                if (uiState.phase != TimerPhase.IDLE && uiState.phase != TimerPhase.DONE) viewModel.pause()
                page = if (mode == TimerMode.STOPWATCH) TimerPage.HOME else TimerPage.CONFIG
            }
            else -> page = TimerPage.HOME
        }
    }

    Scaffold(
        topBar = { if (page == TimerPage.HOME) PandaTopBar(title = "Minuteur", onOpenDrawer = onOpenDrawer) },
        containerColor = MaterialTheme.colorScheme.background,
    ) { innerPadding ->
        AnimatedContent(
            targetState = page,
            transitionSpec = {
                val enter = if (targetState.ordinal > initialState.ordinal) slideInHorizontally { it } + fadeIn()
                else slideInHorizontally { -it } + fadeIn()
                val exit = if (targetState.ordinal > initialState.ordinal) slideOutHorizontally { -it } + fadeOut()
                else slideOutHorizontally { it } + fadeOut()
                enter togetherWith exit
            },
            label = "timer_page",
            modifier = Modifier.padding(innerPadding),
        ) { currentPage ->
            when (currentPage) {
                TimerPage.HOME -> TimerHomeView(
                    onSelectMode = { mode ->
                        viewModel.exitPresetDeleteMode()
                        when (mode) {
                            TimerMode.STOPWATCH -> { viewModel.selectMode(mode); page = TimerPage.RUNNING }
                            else -> { viewModel.updateConfig(uiState.config.copy(mode = mode)); page = TimerPage.CONFIG }
                        }
                    },
                )
                TimerPage.CONFIG -> TimerConfigView(
                    uiState = uiState,
                    onConfigChange = viewModel::updateConfig,
                    onBack = { viewModel.exitPresetDeleteMode(); page = TimerPage.HOME },
                    onStart = { viewModel.start() },
                    onSavePreset = { viewModel.saveCountdownPreset(uiState.config.countdownSeconds) },
                    onDeletePreset = viewModel::deleteCountdownPreset,
                    onTogglePresetDeleteMode = viewModel::togglePresetDeleteMode,
                    onExitPresetDeleteMode = viewModel::exitPresetDeleteMode,
                )
                TimerPage.RUNNING -> ActiveTimerView(
                    uiState = uiState,
                    onPause = viewModel::pause,
                    onResume = viewModel::resume,
                    // Reset sans navigation : le LaunchedEffect(phase) gère la redirection
                    onReset = viewModel::reset,
                    onSettings = { viewModel.reset(); page = TimerPage.CONFIG },
                    onBack = {
                        val mode = uiState.config.mode
                        if (uiState.phase != TimerPhase.IDLE && uiState.phase != TimerPhase.DONE) viewModel.pause()
                        page = if (mode == TimerMode.STOPWATCH) TimerPage.HOME else TimerPage.CONFIG
                    },
                    onLap = viewModel::stopwatchLap,
                )
            }
        }
    }
}

// ══════════════════════════════════════════════════════════════════════════════
// Home
// ══════════════════════════════════════════════════════════════════════════════

@Composable
private fun TimerHomeView(onSelectMode: (TimerMode) -> Unit) {
    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Spacer(Modifier.height(32.dp))
        // Text("Minuteur", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
        // Spacer(Modifier.height(8.dp))
        // Text("Choisis ton mode", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        // Spacer(Modifier.height(36.dp))

        TimerSectionLabel("BASIQUE")
        Spacer(Modifier.height(12.dp))
        TimerModePillButton("CHRONOMÈTRE", StopwatchColor) { onSelectMode(TimerMode.STOPWATCH) }
        Spacer(Modifier.height(12.dp))
        TimerModePillButton("MINUTEUR", CountdownColor) { onSelectMode(TimerMode.COUNTDOWN) }
        Spacer(Modifier.height(28.dp))

        TimerSectionLabel("ENTRAÎNEMENT")
        Spacer(Modifier.height(12.dp))
        listOf(
            Triple(TimerMode.TABATA, "TABATA", TabataColor),
            Triple(TimerMode.EMOM, "EMOM", EmomColor),
            Triple(TimerMode.AMRAP, "AMRAP", AmrapColor),
            Triple(TimerMode.FOR_TIME, "FOR TIME", ForTimeColor),
        ).forEach { (mode, label, color) ->
            TimerModePillButton(label, color) { onSelectMode(mode) }
            Spacer(Modifier.height(12.dp))
        }
        Spacer(Modifier.height(32.dp))
    }
}

@Composable
private fun TimerSectionLabel(text: String) {
    Text(text, style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurfaceVariant, letterSpacing = 2.sp, modifier = Modifier.fillMaxWidth())
}

@Composable
private fun TimerModePillButton(label: String, color: Color, onClick: () -> Unit) {
    Box(
        modifier = Modifier.fillMaxWidth().height(68.dp).clip(RoundedCornerShape(50)).background(color).clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Text(label, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold, color = Color.White, letterSpacing = 2.sp)
    }
}

// ══════════════════════════════════════════════════════════════════════════════
// Config
// ══════════════════════════════════════════════════════════════════════════════

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun TimerConfigView(
    uiState: TimerUiState,
    onConfigChange: (TimerConfig) -> Unit,
    onBack: () -> Unit,
    onStart: () -> Unit,
    onSavePreset: () -> Unit,
    onDeletePreset: (Int) -> Unit,
    onTogglePresetDeleteMode: () -> Unit,
    onExitPresetDeleteMode: () -> Unit,
) {
    val config = uiState.config
    val color = modeColor(config.mode)
    var showNotesDialog by remember { mutableStateOf(false) }
    var notesText by remember { mutableStateOf("") }

    if (showNotesDialog) {
        AlertDialog(
            onDismissRequest = { showNotesDialog = false },
            title = { Text("Ajoute des notes") },
            text = {
                OutlinedTextField(
                    value = notesText,
                    onValueChange = { notesText = it },
                    modifier = Modifier.fillMaxWidth(),
                    placeholder = { Text("Exercices, objectifs...") },
                    minLines = 3,
                )
            },
            confirmButton = { TextButton(onClick = { showNotesDialog = false }) { Text("OK", fontWeight = FontWeight.SemiBold) } },
        )
    }

    Column(modifier = Modifier.fillMaxSize()) {
        // Top bar — IconButton direct pour éviter fillMaxWidth dans un Row enfant
        Row(modifier = Modifier.fillMaxWidth().padding(horizontal = 4.dp, vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = onBack) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Retour")
            }
            Spacer(Modifier.weight(1f))
            if (config.mode != TimerMode.COUNTDOWN) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(Icons.Default.BookmarkBorder, null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(22.dp))
                    Text("PRÉRÉGLAGES", style = MaterialTheme.typography.labelSmall.copy(fontSize = 9.sp), color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                Spacer(Modifier.width(8.dp))
            }
        }

        // COUNTDOWN : pas de verticalScroll car il contient un LazyColumn (wheel picker)
        // Compose interdit l'imbrication LazyColumn dans verticalScroll dans la même direction.
        if (config.mode == TimerMode.COUNTDOWN) {
            Column(modifier = Modifier.weight(1f).padding(horizontal = 24.dp)) {
                Spacer(Modifier.height(16.dp))
                Text(modeTitle(config.mode), style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.ExtraBold, modifier = Modifier.fillMaxWidth(), textAlign = TextAlign.Center)
                Spacer(Modifier.height(28.dp))
                SimpleCountdownConfigContent(
                    config = config,
                    color = color,
                    countdownPresets = uiState.countdownPresets,
                    isPresetDeleteMode = uiState.isPresetDeleteMode,
                    onChange = onConfigChange,
                    onSavePreset = onSavePreset,
                    onDeletePreset = onDeletePreset,
                    onTogglePresetDeleteMode = onTogglePresetDeleteMode,
                    onExitPresetDeleteMode = onExitPresetDeleteMode,
                )
                Spacer(Modifier.height(16.dp))
            }
        } else {
            Column(modifier = Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(horizontal = 24.dp)) {
                Spacer(Modifier.height(16.dp))
                Text(modeTitle(config.mode), style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.ExtraBold, modifier = Modifier.fillMaxWidth(), textAlign = TextAlign.Center)
                Spacer(Modifier.height(28.dp))
                when (config.mode) {
                    TimerMode.TABATA   -> TabataConfigContent(config, color, onConfigChange)
                    TimerMode.EMOM     -> EmomConfigContent(config, color, onConfigChange)
                    TimerMode.AMRAP    -> AmrapConfigContent(config, color, onConfigChange)
                    TimerMode.FOR_TIME -> ForTimeConfigContent(config, color, onConfigChange)
                    else               -> AmrapConfigContent(config, color, onConfigChange)
                }
                Spacer(Modifier.height(24.dp))
                Row(
                    modifier = Modifier.fillMaxWidth().clickable { showNotesDialog = true }.padding(vertical = 8.dp),
                    horizontalArrangement = Arrangement.Center,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(Icons.Default.EditCalendar, null, modifier = Modifier.size(18.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant)
                    Spacer(Modifier.width(6.dp))
                    Text("Ajoute des notes", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                Spacer(Modifier.height(16.dp))
            }
        }

        Box(modifier = Modifier.padding(horizontal = 24.dp, vertical = 16.dp)) {
            TimerStartButton(config, color, onClick = onStart)
        }
    }
}

// ── Décompte simple — WheelPicker + Presets ──────────────────────────────────

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun SimpleCountdownConfigContent(
    config: TimerConfig,
    color: Color,
    countdownPresets: List<Int>,
    isPresetDeleteMode: Boolean,
    onChange: (TimerConfig) -> Unit,
    onSavePreset: () -> Unit,
    onDeletePreset: (Int) -> Unit,
    onTogglePresetDeleteMode: () -> Unit,
    onExitPresetDeleteMode: () -> Unit,
) {
    val minutes = config.countdownSeconds / 60
    val seconds = config.countdownSeconds % 60

    Text("Durée du décompte", style = MaterialTheme.typography.bodyLarge, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.fillMaxWidth(), textAlign = TextAlign.Center)
    Spacer(Modifier.height(24.dp))

    // Wheel picker minutes | secondes
    WheelTimePicker(
        minutes = minutes,
        seconds = seconds,
        color = color,
        onTimeChange = { m, s -> onChange(config.copy(countdownSeconds = m * 60 + s)) },
        modifier = Modifier.fillMaxWidth(),
    )

    Spacer(Modifier.height(24.dp))

    // Presets
    if (countdownPresets.isNotEmpty() || !isPresetDeleteMode) {
        CountdownPresetRow(
            presets = countdownPresets,
            currentSeconds = config.countdownSeconds,
            isDeleteMode = isPresetDeleteMode,
            color = color,
            onPresetClick = { secs ->
                onExitPresetDeleteMode()
                onChange(config.copy(countdownSeconds = secs))
            },
            onDeletePreset = onDeletePreset,
            onSavePreset = onSavePreset,
            onToggleDeleteMode = onTogglePresetDeleteMode,
        )
        Spacer(Modifier.height(8.dp))
        if (isPresetDeleteMode) {
            TextButton(onClick = onExitPresetDeleteMode, modifier = Modifier.fillMaxWidth()) {
                Text("Terminer", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    }
}

// ── WheelTimePicker ───────────────────────────────────────────────────────────

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun WheelTimePicker(
    minutes: Int,
    seconds: Int,
    color: Color,
    onTimeChange: (minutes: Int, seconds: Int) -> Unit,
    modifier: Modifier = Modifier,
) {
    val itemHeight = 56.dp
    val visibleItems = 5

    Row(modifier = modifier, horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically) {
        TimeWheel(
            items = (0..99).toList(),
            selected = minutes,
            color = color,
            itemHeight = itemHeight,
            visibleItems = visibleItems,
            label = "min",
            onSelect = { onTimeChange(it, seconds) },
        )
        Text(":", style = MaterialTheme.typography.displayMedium.copy(fontSize = 48.sp), fontWeight = FontWeight.Thin, color = color.copy(alpha = 0.6f), modifier = Modifier.padding(horizontal = 4.dp))
        TimeWheel(
            items = (0..59).toList(),
            selected = seconds,
            color = color,
            itemHeight = itemHeight,
            visibleItems = visibleItems,
            label = "sec",
            onSelect = { onTimeChange(minutes, it) },
        )
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun TimeWheel(
    items: List<Int>,
    selected: Int,
    color: Color,
    itemHeight: Dp,
    visibleItems: Int,
    label: String,
    onSelect: (Int) -> Unit,
) {
    val listState = rememberLazyListState(
        initialFirstVisibleItemIndex = (selected - visibleItems / 2).coerceAtLeast(0)
    )

    val centeredIndex by remember {
        derivedStateOf { (listState.firstVisibleItemIndex + visibleItems / 2).coerceIn(items.indices) }
    }

    var isUserScrolling by remember { mutableStateOf(false) }

    // Sync externe (ex: clic sur preset)
    LaunchedEffect(selected) {
        val target = (selected - visibleItems / 2).coerceAtLeast(0)
        if (abs(listState.firstVisibleItemIndex - target) > 1) {
            listState.animateScrollToItem(target)
        }
    }

    // Snap manuel + émission de la sélection à la fin du scroll utilisateur
    LaunchedEffect(listState.isScrollInProgress) {
        if (listState.isScrollInProgress) {
            isUserScrolling = true
        } else if (isUserScrolling) {
            isUserScrolling = false
            val ci = centeredIndex
            listState.animateScrollToItem((ci - visibleItems / 2).coerceAtLeast(0))
            onSelect(items[ci])
        }
    }

    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Box(contentAlignment = Alignment.Center) {
            // Fond de la zone de sélection
            Box(
                modifier = Modifier
                    .width(96.dp)
                    .height(itemHeight)
                    .background(color.copy(alpha = 0.08f), RoundedCornerShape(12.dp))
                    .border(1.5.dp, color.copy(alpha = 0.25f), RoundedCornerShape(12.dp))
            )
            LazyColumn(
                state = listState,
                contentPadding = PaddingValues(vertical = itemHeight * (visibleItems / 2)),
                modifier = Modifier.width(96.dp).height(itemHeight * visibleItems),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                itemsIndexed(items, key = { _, v -> v }) { index, value ->
                    val dist = abs(index - centeredIndex)
                    val isCenter = dist == 0
                    val alpha = when (dist) { 0 -> 1f; 1 -> 0.38f; else -> 0.10f }
                    val fontSize = when (dist) { 0 -> 40.sp; 1 -> 26.sp; else -> 18.sp }
                    Text(
                        value.toString().padStart(2, '0'),
                        fontSize = fontSize,
                        fontWeight = if (isCenter) FontWeight.Bold else FontWeight.Normal,
                        color = color.copy(alpha = alpha),
                        textAlign = TextAlign.Center,
                        modifier = Modifier.width(96.dp).height(itemHeight).wrapContentHeight(),
                    )
                }
            }
        }
        Spacer(Modifier.height(4.dp))
        Text(label, style = MaterialTheme.typography.labelSmall, color = color.copy(alpha = 0.6f))
    }
}

// ── Presets countdown ─────────────────────────────────────────────────────────

@Composable
private fun CountdownPresetRow(
    presets: List<Int>,
    currentSeconds: Int,
    isDeleteMode: Boolean,
    color: Color,
    onPresetClick: (Int) -> Unit,
    onDeletePreset: (Int) -> Unit,
    onSavePreset: () -> Unit,
    onToggleDeleteMode: () -> Unit,
) {
    LazyRow(
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        contentPadding = PaddingValues(horizontal = 2.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        items(presets, key = { it }) { secs ->
            Box {
                FilterChip(
                    selected = secs == currentSeconds && !isDeleteMode,
                    onClick = { if (!isDeleteMode) onPresetClick(secs) },
                    label = { Text(formatMmSs(secs), style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold) },
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = color.copy(alpha = 0.18f),
                        selectedLabelColor = color,
                    ),
                    modifier = Modifier.pointerInput(isDeleteMode) {
                        detectTapGestures(
                            onLongPress = { onToggleDeleteMode() },
                            onTap = { if (!isDeleteMode) onPresetClick(secs) },
                        )
                    },
                )
                if (isDeleteMode) {
                    Box(
                        modifier = Modifier
                            .size(20.dp)
                            .align(Alignment.TopEnd)
                            .clip(CircleShape)
                            .background(Color(0xFFE53935))
                            .clickable { onDeletePreset(secs) },
                        contentAlignment = Alignment.Center,
                    ) {
                        Text("−", color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.Bold, lineHeight = 14.sp)
                    }
                }
            }
        }
        // Bouton enregistrer preset
        if (!isDeleteMode && presets.size < 5) {
            item {
                Box(
                    modifier = Modifier
                        .height(32.dp)
                        .clip(RoundedCornerShape(50))
                        .border(1.dp, color.copy(alpha = 0.4f), RoundedCornerShape(50))
                        .clickable(onClick = onSavePreset)
                        .padding(horizontal = 12.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        Icon(Icons.Default.Add, null, modifier = Modifier.size(14.dp), tint = color)
                        Text("Enregistrer", style = MaterialTheme.typography.labelMedium, color = color)
                    }
                }
            }
        }
    }
}

// ── Configs HIIT (inchangées) ─────────────────────────────────────────────────

@Composable
private fun TabataConfigContent(config: TimerConfig, color: Color, onChange: (TimerConfig) -> Unit) {
    var showPicker by remember { mutableStateOf<String?>(null) }
    Text("Programme ton Tabata", style = MaterialTheme.typography.bodyLarge, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.fillMaxWidth(), textAlign = TextAlign.Center)
    Spacer(Modifier.height(24.dp))
    TimerFieldRow("Tours", config.rounds.toString(), color) { showPicker = "rounds" }
    Spacer(Modifier.height(16.dp))
    TimerFieldRow("Travail", formatMmSs(config.workSeconds), color) { showPicker = "work" }
    Spacer(Modifier.height(16.dp))
    TimerFieldRow("Récupération", formatMmSs(config.restSeconds), color) { showPicker = "rest" }
    Spacer(Modifier.height(16.dp))
    TimerExpandableSection("Réglages facultatifs", color) {
        TimerFieldRow("Échauffement", formatMmSs(config.warmupSeconds), color) { showPicker = "warmup" }
        Spacer(Modifier.height(8.dp))
        TimerFieldRow("Refroidissement", formatMmSs(config.cooldownSeconds), color) { showPicker = "cooldown" }
    }
    when (showPicker) {
        "rounds"   -> TimerValuePickerDialog("Tours", config.rounds, 1, 50, 1, false, { showPicker = null }) { onChange(config.copy(rounds = it)) }
        "work"     -> TimerValuePickerDialog("Travail", config.workSeconds, 5, 3600, 5, true, { showPicker = null }) { onChange(config.copy(workSeconds = it)) }
        "rest"     -> TimerValuePickerDialog("Récupération", config.restSeconds, 0, 600, 5, true, { showPicker = null }) { onChange(config.copy(restSeconds = it)) }
        "warmup"   -> TimerValuePickerDialog("Échauffement", config.warmupSeconds, 0, 600, 15, true, { showPicker = null }) { onChange(config.copy(warmupSeconds = it)) }
        "cooldown" -> TimerValuePickerDialog("Refroidissement", config.cooldownSeconds, 0, 600, 15, true, { showPicker = null }) { onChange(config.copy(cooldownSeconds = it)) }
    }
}

@Composable
private fun EmomConfigContent(config: TimerConfig, color: Color, onChange: (TimerConfig) -> Unit) {
    val intervalMinutes = (config.workSeconds / 60).coerceAtLeast(1)
    val totalMinutes = config.rounds
    var showPicker by remember { mutableStateOf<String?>(null) }
    var deathBy by remember { mutableStateOf(false) }
    Text("EMOM $totalMinutes minute${if (totalMinutes > 1) "s" else ""}", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.fillMaxWidth(), textAlign = TextAlign.Center)
    Spacer(Modifier.height(24.dp))
    TimerFieldRow("Toutes les", intervalMinutes.toString(), color, "min") { showPicker = "interval" }
    Spacer(Modifier.height(16.dp))
    TimerFieldRow("pendant", totalMinutes.toString(), color, "min") { showPicker = "total" }
    Spacer(Modifier.height(8.dp))
    Row(modifier = Modifier.fillMaxWidth().clickable { deathBy = !deathBy }.padding(vertical = 8.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.Center) {
        Text("∞", style = MaterialTheme.typography.titleMedium, color = if (deathBy) color else MaterialTheme.colorScheme.onSurfaceVariant)
        Spacer(Modifier.width(8.dp))
        Text("Aussi longtemps que possible (\"Death By\")", style = MaterialTheme.typography.bodySmall, color = if (deathBy) color else MaterialTheme.colorScheme.onSurfaceVariant)
    }
    when (showPicker) {
        "interval" -> TimerValuePickerDialog("Intervalle (min)", intervalMinutes, 1, 10, 1, false, { showPicker = null }) { onChange(config.copy(workSeconds = it * 60)) }
        "total"    -> TimerValuePickerDialog("Durée totale (min)", totalMinutes, 1, 120, 1, false, { showPicker = null }) { onChange(config.copy(rounds = it)) }
    }
}

@Composable
private fun AmrapConfigContent(config: TimerConfig, color: Color, onChange: (TimerConfig) -> Unit) {
    val minutes = (config.totalSeconds / 60).coerceAtLeast(1)
    var showPicker by remember { mutableStateOf(false) }
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Center) { Text("Autant de tours que possible en", style = MaterialTheme.typography.bodyLarge) }
    Spacer(Modifier.height(16.dp))
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically) {
        TimerValueBox(minutes.toString(), color) { showPicker = true }
        Spacer(Modifier.width(12.dp))
        Text("minutes", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Normal)
    }
    if (showPicker) TimerValuePickerDialog("Durée (minutes)", minutes, 1, 120, 1, false, { showPicker = false }) { onChange(config.copy(totalSeconds = it * 60)) }
}

@Composable
private fun ForTimeConfigContent(config: TimerConfig, color: Color, onChange: (TimerConfig) -> Unit) {
    val minutes = config.totalSeconds / 60
    var showPicker by remember { mutableStateOf(false) }
    Text("Aussi vite que possible", style = MaterialTheme.typography.bodyLarge, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.fillMaxWidth(), textAlign = TextAlign.Center)
    Spacer(Modifier.height(24.dp))
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically) {
        Text("Temps limite : ", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Normal)
        TimerValueBox(if (minutes == 0) "aucun" else "${minutes}min", color, wide = true) { showPicker = true }
    }
    if (showPicker) TimerValuePickerDialog("Temps limite (min)", minutes.coerceAtLeast(1), 0, 120, 1, false, { showPicker = false }) { onChange(config.copy(totalSeconds = it * 60)) }
}

// ── Composants config partagés ────────────────────────────────────────────────

@Composable
private fun TimerFieldRow(label: String, value: String, color: Color, valueSuffix: String = "", onClick: () -> Unit) {
    Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Text(label, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Normal, modifier = Modifier.weight(1f))
        TimerValueBox(value, color, onClick = onClick)
        if (valueSuffix.isNotBlank()) { Spacer(Modifier.width(10.dp)); Text(valueSuffix, style = MaterialTheme.typography.headlineSmall) }
    }
}

@Composable
private fun TimerValueBox(value: String, color: Color, wide: Boolean = false, onClick: () -> Unit) {
    Box(
        modifier = Modifier.then(if (wide) Modifier.width(140.dp) else Modifier.size(88.dp)).height(88.dp)
            .border(2.dp, color, RoundedCornerShape(14.dp)).clip(RoundedCornerShape(14.dp))
            .background(color.copy(alpha = 0.06f)).clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Text(value, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.SemiBold, textAlign = TextAlign.Center)
    }
}

@Composable
private fun TimerExpandableSection(label: String, color: Color, content: @Composable () -> Unit) {
    var expanded by remember { mutableStateOf(false) }
    Column {
        Row(modifier = Modifier.fillMaxWidth().clickable { expanded = !expanded }.padding(vertical = 8.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.Center) {
            Box(modifier = Modifier.size(22.dp).border(1.5.dp, MaterialTheme.colorScheme.onSurfaceVariant, CircleShape), contentAlignment = Alignment.Center) {
                Icon(if (expanded) Icons.Default.Close else Icons.Default.Add, null, modifier = Modifier.size(14.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Spacer(Modifier.width(8.dp))
            Text(label, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        AnimatedVisibility(visible = expanded) {
            Column(modifier = Modifier.fillMaxWidth().border(1.dp, color.copy(alpha = 0.25f), RoundedCornerShape(10.dp)).background(color.copy(alpha = 0.04f), RoundedCornerShape(10.dp)).padding(12.dp)) { content() }
        }
    }
}

@Composable
private fun TimerStartButton(config: TimerConfig, color: Color, onClick: () -> Unit) {
    val subtitle = when (config.mode) {
        TimerMode.TABATA    -> "Temps total : ${formatMmSs((config.workSeconds + config.restSeconds) * config.rounds)}"
        TimerMode.COUNTDOWN -> "Durée : ${formatMmSs(config.countdownSeconds)}"
        else -> null
    }
    Box(
        modifier = Modifier.fillMaxWidth().height(if (subtitle != null) 72.dp else 60.dp).clip(RoundedCornerShape(50)).background(color).clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text("DÉMARRER", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = Color.White, letterSpacing = 1.sp)
            if (subtitle != null) Text(subtitle, style = MaterialTheme.typography.labelSmall, color = Color.White.copy(alpha = 0.85f))
        }
    }
}

@Composable
private fun TimerValuePickerDialog(title: String, initial: Int, min: Int, max: Int, step: Int, isTime: Boolean, onDismiss: () -> Unit, onConfirm: (Int) -> Unit) {
    var current by remember(initial) { mutableIntStateOf(initial.coerceIn(min, max)) }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(title, fontWeight = FontWeight.SemiBold) },
        text = {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(16.dp, Alignment.CenterHorizontally), verticalAlignment = Alignment.CenterVertically) {
                Box(modifier = Modifier.size(48.dp).clip(CircleShape).background(MaterialTheme.colorScheme.surfaceVariant).clickable { if (current - step >= min) current -= step }, contentAlignment = Alignment.Center) { Text("−", style = MaterialTheme.typography.titleLarge) }
                Text(if (isTime) formatMmSs(current) else current.toString(), style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold, modifier = Modifier.width(80.dp), textAlign = TextAlign.Center)
                Box(modifier = Modifier.size(48.dp).clip(CircleShape).background(MaterialTheme.colorScheme.surfaceVariant).clickable { if (current + step <= max) current += step }, contentAlignment = Alignment.Center) { Text("+", style = MaterialTheme.typography.titleLarge) }
            }
        },
        confirmButton = { TextButton(onClick = { onConfirm(current); onDismiss() }) { Text("OK", fontWeight = FontWeight.Bold) } },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Annuler") } },
    )
}

// ══════════════════════════════════════════════════════════════════════════════
// Vue timer actif
// ══════════════════════════════════════════════════════════════════════════════

@Composable
private fun ActiveTimerView(
    uiState: TimerUiState,
    onPause: () -> Unit,
    onResume: () -> Unit,
    onReset: () -> Unit,
    onSettings: () -> Unit,
    onBack: () -> Unit,
    onLap: () -> Unit,
) {
    when (uiState.config.mode) {
        TimerMode.STOPWATCH -> StopwatchActiveContent(uiState, onPause, onResume, onReset, onBack, onLap)
        TimerMode.COUNTDOWN -> CountdownActiveContent(uiState, onPause, onResume, onReset, onBack)
        else                -> HiitActiveContent(uiState, onPause, onResume, onReset, onSettings)
    }
}

// ── Chronomètre ───────────────────────────────────────────────────────────────

@Composable
private fun StopwatchActiveContent(
    uiState: TimerUiState,
    onPause: () -> Unit,
    onResume: () -> Unit,
    onReset: () -> Unit,
    onBack: () -> Unit,
    onLap: () -> Unit,
) {
    Column(modifier = Modifier.fillMaxSize()) {
        TimerActiveTopBar(onBack = onBack, modifier = Modifier.fillMaxWidth())

        Column(
            modifier = Modifier.weight(1f).padding(horizontal = 24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            // HH:MM:SS — fillMaxWidth + textAlign.Center pour stabiliser le layout lors des laps
            Text(
                formatElapsedMs(uiState.elapsedMs),
                style = MaterialTheme.typography.displayLarge.copy(fontSize = 72.sp),
                fontWeight = FontWeight.Thin,
                color = StopwatchColor,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth(),
            )
            // Centièmes
            val cs = (uiState.elapsedMs / 10) % 100
            Text(
                ".${cs.toString().padStart(2, '0')}",
                style = MaterialTheme.typography.headlineSmall,
                color = StopwatchColor.copy(alpha = 0.5f),
                fontWeight = FontWeight.Light,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth(),
            )

            Spacer(Modifier.height(48.dp))

            // Boutons
            Row(horizontalArrangement = Arrangement.spacedBy(20.dp), verticalAlignment = Alignment.CenterVertically) {
                // Reset
                ControlButton(size = 60.dp, bgColor = MaterialTheme.colorScheme.surfaceVariant, onClick = onReset) {
                    Icon(Icons.Default.Refresh, "Reset", modifier = Modifier.size(28.dp))
                }
                // Play / Pause
                ControlButton(size = 92.dp, bgColor = StopwatchColor, onClick = if (uiState.isRunning) onPause else onResume) {
                    Icon(if (uiState.isRunning) Icons.Default.Pause else Icons.Default.PlayArrow, null, tint = Color.White, modifier = Modifier.size(46.dp))
                }
                // LAP (visible si en cours)
                ControlButton(
                    size = 60.dp,
                    bgColor = if (uiState.phase == TimerPhase.WORK) StopwatchColor.copy(alpha = 0.15f) else MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f),
                    onClick = if (uiState.phase == TimerPhase.WORK) onLap else ({}),
                ) {
                    Text(
                        "LAP",
                        style = MaterialTheme.typography.labelLarge,
                        fontWeight = FontWeight.Bold,
                        color = if (uiState.phase == TimerPhase.WORK) StopwatchColor else MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.35f),
                    )
                }
            }

            Spacer(Modifier.height(8.dp))
            Text(
                when { uiState.phase == TimerPhase.IDLE -> "Prêt"; uiState.isRunning -> "En cours"; else -> "En pause" },
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }

        // Liste laps
        if (uiState.laps.isNotEmpty()) {
            StopwatchLapList(laps = uiState.laps, modifier = Modifier.fillMaxWidth())
        }
    }
}

// ── Décompte ──────────────────────────────────────────────────────────────────

@Composable
private fun CountdownActiveContent(
    uiState: TimerUiState,
    onPause: () -> Unit,
    onResume: () -> Unit,
    onReset: () -> Unit,
    onBack: () -> Unit,
) {
    val remainingMs = (uiState.targetMs - uiState.elapsedMs).coerceAtLeast(0L)
    val rawProgress = if (uiState.targetMs > 0L) remainingMs.toFloat() / uiState.targetMs.toFloat() else 1f
    val animProgress by animateFloatAsState(rawProgress.coerceIn(0f, 1f), animationSpec = tween(150), label = "cd_progress")

    Column(modifier = Modifier.fillMaxSize()) {
        TimerActiveTopBar(onBack = onBack, modifier = Modifier.fillMaxWidth())

        Column(
            modifier = Modifier.weight(1f).padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            Box(contentAlignment = Alignment.Center, modifier = Modifier.size(256.dp)) {
                CircularProgressIndicator(progress = { animProgress }, modifier = Modifier.size(256.dp), color = CountdownColor, strokeWidth = 12.dp, trackColor = CountdownColor.copy(alpha = 0.12f), strokeCap = StrokeCap.Round)
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    if (uiState.isFinished) {
                        Text("Terminé !", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold, color = CountdownColor)
                    } else {
                        val totalSec = remainingMs / 1000
                        Text("${(totalSec / 60).toString().padStart(2, '0')}:${(totalSec % 60).toString().padStart(2, '0')}", style = MaterialTheme.typography.displayMedium.copy(fontSize = 60.sp), fontWeight = FontWeight.Bold, color = CountdownColor)
                        Text(if (uiState.isRunning) "en cours" else "en pause", style = MaterialTheme.typography.bodySmall, color = CountdownColor.copy(alpha = 0.6f))
                    }
                }
            }

            Spacer(Modifier.height(44.dp))

            if (uiState.isFinished) {
                Box(
                    modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(50)).background(CountdownColor).clickable(onClick = onReset).padding(vertical = 18.dp),
                    contentAlignment = Alignment.Center,
                ) { Text("Recommencer", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = Color.White) }
            } else {
                Row(horizontalArrangement = Arrangement.spacedBy(24.dp), verticalAlignment = Alignment.CenterVertically) {
                    ControlButton(60.dp, MaterialTheme.colorScheme.surfaceVariant, onClick = onReset) { Icon(Icons.Default.Refresh, "Reset", modifier = Modifier.size(28.dp)) }
                    ControlButton(92.dp, CountdownColor, onClick = if (uiState.isRunning) onPause else onResume) { Icon(if (uiState.isRunning) Icons.Default.Pause else Icons.Default.PlayArrow, null, tint = Color.White, modifier = Modifier.size(46.dp)) }
                }
            }
        }
    }
}

// ── HIIT (inchangé) ───────────────────────────────────────────────────────────

@Composable
private fun HiitActiveContent(uiState: TimerUiState, onPause: () -> Unit, onResume: () -> Unit, onReset: () -> Unit, onSettings: () -> Unit) {
    val config = uiState.config
    val phase = uiState.phase
    val accentColor = modeColor(config.mode)
    val phaseColor = when (phase) {
        TimerPhase.WORK -> accentColor; TimerPhase.REST -> Color(0xFF43A047); TimerPhase.WARMUP -> Color(0xFFFF6F00)
        TimerPhase.COOLDOWN -> Color(0xFF1E88E5); TimerPhase.DONE -> MaterialTheme.colorScheme.primary; else -> accentColor
    }
    val totalPhaseSeconds = when (phase) {
        TimerPhase.WORK -> when (config.mode) { TimerMode.AMRAP, TimerMode.FOR_TIME -> config.totalSeconds; else -> config.workSeconds }
        TimerPhase.REST -> config.restSeconds; TimerPhase.WARMUP -> config.warmupSeconds; TimerPhase.COOLDOWN -> config.cooldownSeconds; else -> 1
    }.coerceAtLeast(1)
    val progress by animateFloatAsState(uiState.secondsLeft.toFloat() / totalPhaseSeconds.toFloat(), animationSpec = tween(800), label = "hiit_progress")

    LazyColumn(modifier = Modifier.fillMaxSize(), contentPadding = PaddingValues(bottom = 80.dp)) {
        item {
            Column(modifier = Modifier.fillMaxWidth().padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(24.dp)) {
                Text(phaseLabel(phase), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = phaseColor)
                Box(contentAlignment = Alignment.Center, modifier = Modifier.size(240.dp)) {
                    CircularProgressIndicator(progress = { progress }, modifier = Modifier.size(240.dp), color = phaseColor, strokeWidth = 10.dp, trackColor = phaseColor.copy(alpha = 0.15f), strokeCap = StrokeCap.Round)
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text("${(uiState.secondsLeft / 60).toString().padStart(2, '0')}:${(uiState.secondsLeft % 60).toString().padStart(2, '0')}", style = MaterialTheme.typography.displayMedium.copy(fontSize = 56.sp), fontWeight = FontWeight.Bold, color = phaseColor)
                        if (config.mode != TimerMode.AMRAP && config.mode != TimerMode.FOR_TIME) Text("Round ${uiState.currentRound} / ${config.rounds}", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
                Text("Écoulé : ${(uiState.totalElapsed / 60).toString().padStart(2, '0')}:${(uiState.totalElapsed % 60).toString().padStart(2, '0')}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                if (phase == TimerPhase.DONE) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        Text("Terminé !", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold, color = accentColor)
                        Box(modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(50)).background(accentColor).clickable(onClick = onReset).padding(vertical = 18.dp), contentAlignment = Alignment.Center) { Text("Recommencer", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = Color.White) }
                    }
                } else {
                    Row(horizontalArrangement = Arrangement.spacedBy(20.dp), verticalAlignment = Alignment.CenterVertically) {
                        ControlButton(52.dp, MaterialTheme.colorScheme.surfaceVariant, onReset) { Icon(Icons.Default.Refresh, "Reset", modifier = Modifier.size(26.dp)) }
                        ControlButton(80.dp, phaseColor, if (uiState.isRunning) onPause else onResume) { Icon(if (uiState.isRunning) Icons.Default.Pause else Icons.Default.PlayArrow, null, tint = Color.White, modifier = Modifier.size(40.dp)) }
                        ControlButton(52.dp, MaterialTheme.colorScheme.surfaceVariant, onSettings) { Icon(Icons.Default.EditCalendar, "Config", modifier = Modifier.size(26.dp)) }
                    }
                }
            }
        }
    }
}

// ══════════════════════════════════════════════════════════════════════════════
// Composants partagés — vues actives
// ══════════════════════════════════════════════════════════════════════════════

/** Bouton circulaire générique. */
@Composable
private fun ControlButton(size: Dp, bgColor: Color, onClick: () -> Unit, content: @Composable () -> Unit) {
    Box(modifier = Modifier.size(size).clip(CircleShape).background(bgColor).clickable(onClick = onClick), contentAlignment = Alignment.Center) { content() }
}

/** Barre de navigation : flèche retour simple, tap = retour uniquement. */
@Composable
private fun TimerActiveTopBar(onBack: () -> Unit, modifier: Modifier = Modifier) {
    Row(modifier = modifier.padding(horizontal = 4.dp, vertical = 4.dp)) {
        IconButton(onClick = onBack) {
            Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Retour")
        }
    }
}

/** Liste des laps avec highlight du meilleur/pire temps. */
@Composable
private fun StopwatchLapList(laps: List<LapRecord>, modifier: Modifier = Modifier) {
    val reversedLaps = remember(laps) { laps.reversed() }
    val fastestMs = remember(laps) { laps.minOfOrNull { it.lapMs } ?: 0L }
    val slowestMs = remember(laps) { if (laps.size > 1) laps.maxOfOrNull { it.lapMs } ?: 0L else -1L }

    Column(modifier = modifier) {
        HorizontalDivider(modifier = Modifier.alpha(0.3f))
        Row(modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp)) {
            Text("Lap", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.weight(0.6f))
            Text("Temps", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.weight(1f), textAlign = TextAlign.Center)
            Text("Total", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.weight(1f), textAlign = TextAlign.End)
        }
        HorizontalDivider(modifier = Modifier.alpha(0.3f))
        LazyColumn(modifier = Modifier.heightIn(max = 200.dp)) {
            items(reversedLaps, key = { it.lapNumber }) { lap ->
                val lapColor = when (lap.lapMs) {
                    fastestMs -> Color(0xFF43A047)
                    slowestMs -> Color(0xFFEF5350)
                    else      -> Color.Unspecified
                }
                Row(modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 7.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text("#${lap.lapNumber}", style = MaterialTheme.typography.bodySmall, fontWeight = FontWeight.SemiBold, color = if (lapColor != Color.Unspecified) lapColor else MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.weight(0.6f))
                    Text(formatElapsedMs(lap.lapMs), style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold, color = if (lapColor != Color.Unspecified) lapColor else MaterialTheme.colorScheme.onSurface, modifier = Modifier.weight(1f), textAlign = TextAlign.Center)
                    Text(formatElapsedMs(lap.totalMs), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.weight(1f), textAlign = TextAlign.End)
                }
                HorizontalDivider(modifier = Modifier.alpha(0.15f))
            }
        }
    }
}

// ══════════════════════════════════════════════════════════════════════════════
// Helpers
// ══════════════════════════════════════════════════════════════════════════════

private fun formatElapsedMs(ms: Long): String {
    val totalSec = ms / 1000
    val h = totalSec / 3600
    val m = (totalSec % 3600) / 60
    val s = totalSec % 60
    return if (h > 0) "$h:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}"
    else "${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}"
}

private fun formatMmSs(seconds: Int): String {
    if (seconds <= 0) return "00:00"
    return "${(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}"
}

private fun modeTitle(mode: TimerMode): String = when (mode) {
    TimerMode.STOPWATCH -> "CHRONOMÈTRE"
    TimerMode.COUNTDOWN -> "MINUTEUR"
    TimerMode.TABATA    -> "TABATA"
    TimerMode.EMOM      -> "EMOM"
    TimerMode.AMRAP     -> "AMRAP"
    TimerMode.FOR_TIME  -> "FOR TIME"
    TimerMode.HIIT      -> "HIIT"
}

private fun phaseLabel(phase: TimerPhase): String = when (phase) {
    TimerPhase.IDLE -> "Prêt"; TimerPhase.WARMUP -> "Échauffement"; TimerPhase.WORK -> "TRAVAIL"
    TimerPhase.REST -> "REPOS"; TimerPhase.COOLDOWN -> "Récupération"; TimerPhase.DONE -> "Terminé"
}
