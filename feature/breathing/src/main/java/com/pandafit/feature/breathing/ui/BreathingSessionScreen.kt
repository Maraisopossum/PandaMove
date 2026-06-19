package com.pandafit.feature.breathing.ui

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.pandafit.designsystem.components.PandaCard
import com.pandafit.designsystem.theme.PandaGreen
import com.pandafit.designsystem.theme.PandaSubtext
import com.pandafit.feature.breathing.R
import com.pandafit.feature.breathing.engine.BreathingPhase
import com.pandafit.feature.breathing.engine.color
import com.pandafit.feature.breathing.viewmodel.BreathingViewModel

// ── Messages motivants panda ──────────────────────────────────────────────────

private val PANDA_MESSAGES = listOf(
    "Le panda sait que le calme se cultive, pas à pas.",
    "Chaque souffle compte. Tu viens d'en prouver quelques-uns.",
    "Le panda est fier. Et un peu jaloux de ton calme.",
    "Respirer bien, c'est vivre mieux. Le panda valide.",
    "Séance accomplie. Le bambou peut attendre.",
    "Ton souffle est ta force. Le panda le sait depuis toujours.",
)

@Composable
fun BreathingSessionScreen(
    methodId: String,
    cycles: Int,
    onNavigateBack: () -> Unit,
    viewModel: BreathingViewModel = hiltViewModel(),
) {
    val uiState    by viewModel.uiState.collectAsStateWithLifecycle()
    val phaseState = uiState.phaseState
    val countdown  = uiState.countdownSeconds

    // Démarre le décompte une seule fois à l'entrée
    LaunchedEffect(methodId, cycles) {
        val idle = !phaseState.isActive && !phaseState.isCompleted && countdown == 0
        if (idle) viewModel.startWithCountdown(methodId, cycles)
    }

    // Couleur animée selon la phase courante
    val phaseColor by animateColorAsState(
        targetValue = when {
            countdown > 0                                  -> MaterialTheme.colorScheme.primary
            phaseState.isActive || phaseState.isCompleted -> phaseState.phase.color
            else                                          -> MaterialTheme.colorScheme.primary
        },
        animationSpec = tween(durationMillis = 600),
        label = "phaseColor",
    )

    // Message panda tiré au sort à chaque nouvelle complétion
    val pandaMessage = remember(phaseState.isCompleted) {
        if (phaseState.isCompleted) PANDA_MESSAGES.random() else ""
    }

    // ── Écran de fin in-place ─────────────────────────────────────────────────
    if (phaseState.isCompleted && countdown == 0) {
        BreathingCompletionScreen(
            methodName      = uiState.selectedMethod?.name ?: "",
            cyclesCompleted = phaseState.currentCycle,
            durationSeconds = uiState.sessionSavedDurationSeconds,
            pandaMessage    = pandaMessage,
            accentColor     = PandaGreen,
            onRestart       = { viewModel.startWithCountdown(methodId, cycles) },
            onClose         = { viewModel.stopSession(); onNavigateBack() },
        )
        return
    }

    // ── Écran de session actif / décompte ─────────────────────────────────────

    val circleScale = remember { Animatable(0f) }

    LaunchedEffect(phaseState.phase, phaseState.isActive, phaseState.isCompleted) {
        when {
            phaseState.isCompleted -> circleScale.stop()
            !phaseState.isActive   -> circleScale.stop()
            else -> {
                val startScale = when (phaseState.phase) {
                    BreathingPhase.INHALE   -> phaseState.phaseProgress
                    BreathingPhase.HOLD_IN  -> 1f
                    BreathingPhase.EXHALE   -> 1f - phaseState.phaseProgress
                    BreathingPhase.HOLD_OUT -> 0f
                }
                circleScale.snapTo(startScale)
                when (phaseState.phase) {
                    BreathingPhase.INHALE -> {
                        val remaining = (phaseState.phaseDurationMs - phaseState.phaseProgressMs).coerceAtLeast(0L)
                        if (remaining > 0) circleScale.animateTo(1f, tween(remaining.toInt(), easing = LinearEasing))
                    }
                    BreathingPhase.EXHALE -> {
                        val remaining = (phaseState.phaseDurationMs - phaseState.phaseProgressMs).coerceAtLeast(0L)
                        if (remaining > 0) circleScale.animateTo(0f, tween(remaining.toInt(), easing = LinearEasing))
                    }
                    BreathingPhase.HOLD_IN, BreathingPhase.HOLD_OUT -> { /* statique */ }
                }
            }
        }
    }

    Scaffold(containerColor = MaterialTheme.colorScheme.background) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.SpaceBetween,
        ) {

            // ── Top bar ──────────────────────────────────────────────────────
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                IconButton(onClick = {
                    viewModel.stopSession()
                    onNavigateBack()
                }) {
                    Icon(Icons.Default.Close, stringResource(R.string.breathing_session_close_cd), tint = MaterialTheme.colorScheme.onSurface)
                }

                Text(
                    uiState.selectedMethod?.name ?: "",
                    style = MaterialTheme.typography.titleSmall,
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f),
                )

                if (countdown == 0 && phaseState.totalCycles > 0) {
                    Text(
                        "${phaseState.currentCycle}/${phaseState.totalCycles}",
                        style      = MaterialTheme.typography.labelLarge,
                        color      = phaseColor,
                        fontWeight = FontWeight.Bold,
                    )
                } else {
                    Spacer(Modifier.size(48.dp))
                }
            }

            // ── Cercle animé ──────────────────────────────────────────────────
            Box(
                modifier         = Modifier.size(280.dp),
                contentAlignment = Alignment.Center,
            ) {
                Canvas(modifier = Modifier.fillMaxSize()) {
                    val halfW  = size.minDimension / 2f
                    val minR   = halfW * 0.22f
                    val maxR   = halfW * 0.88f
                    val radius = minR + (maxR - minR) * circleScale.value

                    drawCircle(color = phaseColor.copy(alpha = 0.12f), radius = radius + halfW * 0.09f)
                    drawCircle(color = phaseColor.copy(alpha = 0.85f), radius = radius)
                    drawCircle(
                        color  = Color.White.copy(alpha = 0.10f),
                        radius = radius * 0.45f,
                        center = center.copy(y = center.y - radius * 0.18f),
                    )
                }

                when {
                    countdown > 0 -> Text(
                        "$countdown",
                        style      = MaterialTheme.typography.displayLarge,
                        color      = Color.White,
                        fontWeight = FontWeight.Bold,
                    )
                    phaseState.isActive -> {
                        val remainingSec = ((phaseState.phaseDurationMs - phaseState.phaseProgressMs + 999L) / 1_000L)
                            .toInt().coerceAtLeast(0)
                        Text(
                            "$remainingSec",
                            style      = MaterialTheme.typography.headlineLarge,
                            color      = Color.White.copy(alpha = 0.85f),
                            fontWeight = FontWeight.Bold,
                        )
                    }
                }
            }

            // ── Labels de phase ───────────────────────────────────────────────
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                if (countdown > 0) {
                    Text(
                        stringResource(R.string.breathing_session_prepare),
                        style      = MaterialTheme.typography.headlineMedium,
                        fontWeight = FontWeight.Bold,
                        color      = phaseColor,
                    )
                    Text(
                        stringResource(R.string.breathing_session_countdown_label, countdown),
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f),
                    )
                } else {
                    Text(
                        phaseState.phase.label,
                        style      = MaterialTheme.typography.headlineMedium,
                        fontWeight = FontWeight.Bold,
                        color      = phaseColor,
                    )
                    Text(
                        phaseState.phase.instruction,
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f),
                    )
                }
            }

            // ── Contrôles ────────────────────────────────────────────────────
            Row(
                horizontalArrangement = Arrangement.spacedBy(24.dp),
                verticalAlignment     = Alignment.CenterVertically,
            ) {
                if (countdown > 0) {
                    Spacer(Modifier.height(72.dp))
                } else {
                    FloatingActionButton(
                        onClick        = {
                            if (phaseState.isActive) viewModel.pauseSession()
                            else viewModel.resumeSession()
                        },
                        containerColor = phaseColor,
                        contentColor   = Color.White,
                        shape          = CircleShape,
                        modifier       = Modifier.size(72.dp),
                    ) {
                        Icon(
                            if (phaseState.isActive) Icons.Default.Pause else Icons.Default.PlayArrow,
                            contentDescription = if (phaseState.isActive) stringResource(R.string.breathing_session_pause_cd) else stringResource(R.string.breathing_session_resume_cd),
                            modifier           = Modifier.size(32.dp),
                        )
                    }
                }
            }
        }
    }
}

// ── Écran de fin de séance ────────────────────────────────────────────────────

@Composable
private fun BreathingCompletionScreen(
    methodName: String,
    cyclesCompleted: Int,
    durationSeconds: Int,
    pandaMessage: String,
    accentColor: Color,
    onRestart: () -> Unit,
    onClose: () -> Unit,
) {
    Scaffold(containerColor = MaterialTheme.colorScheme.background) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .padding(horizontal = 24.dp)
                .verticalScroll(rememberScrollState()),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(20.dp),
        ) {
            Spacer(Modifier.height(16.dp))

            // Titre
            Text(
                stringResource(R.string.breathing_completion_title),
                style      = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.Bold,
                textAlign  = TextAlign.Center,
            )

            // Panda en méditation
            Image(
                painter            = painterResource(id = R.drawable.male_meditation_v1),
                contentDescription = stringResource(R.string.breathing_panda_meditation_cd),
                modifier           = Modifier
                    .fillMaxWidth()
                    .height(220.dp),
                contentScale       = ContentScale.Fit,
            )

            // Message motivant
            Text(
                "« $pandaMessage »",
                style     = MaterialTheme.typography.bodyMedium,
                fontStyle = FontStyle.Italic,
                color     = PandaSubtext,
                textAlign = TextAlign.Center,
            )

            // Récapitulatif de séance
            PandaCard(modifier = Modifier.fillMaxWidth()) {
                Column(
                    modifier            = Modifier.padding(16.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    Text(
                        methodName,
                        style      = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.SemiBold,
                        color      = accentColor,
                    )
                    Row(horizontalArrangement = Arrangement.spacedBy(32.dp)) {
                        CompletionStat(label = stringResource(R.string.breathing_completion_cycles_label), value = "$cyclesCompleted")
                        CompletionStat(label = stringResource(R.string.breathing_completion_duration_label), value = formatCompletionDuration(durationSeconds))
                    }
                }
            }

            Spacer(Modifier.height(8.dp))

            // Boutons
            Row(
                modifier              = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                FilledTonalButton(
                    onClick  = onClose,
                    modifier = Modifier.weight(1f),
                ) {
                    Text(stringResource(R.string.breathing_completion_close))
                }
                Button(
                    onClick  = onRestart,
                    modifier = Modifier.weight(1f),
                    colors   = ButtonDefaults.buttonColors(containerColor = accentColor),
                ) {
                    Icon(Icons.Default.Refresh, contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.width(6.dp))
                    Text(stringResource(R.string.breathing_completion_restart), fontWeight = FontWeight.SemiBold)
                }
            }

            Spacer(Modifier.height(24.dp))
        }
    }
}

@Composable
private fun CompletionStat(label: String, value: String) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(value, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
        Text(label, style = MaterialTheme.typography.labelSmall, color = PandaSubtext)
    }
}

private fun formatCompletionDuration(seconds: Int): String {
    if (seconds <= 0) return "—"
    val m = seconds / 60
    val s = seconds % 60
    return if (m > 0) "${m} min ${s.toString().padStart(2, '0')}" else "${s}s"
}
