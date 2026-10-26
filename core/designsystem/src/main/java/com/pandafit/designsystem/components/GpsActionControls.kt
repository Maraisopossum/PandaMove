package com.pandafit.designsystem.components

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.pandafit.designsystem.theme.PandaOutline
import com.pandafit.designsystem.theme.PandaWhite
import kotlinx.coroutines.launch

// ══════════════════════════════════════════════════════════════════════════════
// GPS ACTION CONTROLS — gros boutons ronds pour Démarrer / Pause / Reprendre /
// décompte de démarrage / fin de séance (hold-to-confirm). Partagés entre
// running/cycling/hiking qui utilisent tous le même GpsTrackingRepository.
// ══════════════════════════════════════════════════════════════════════════════

/** Gros bouton rond plein — Démarrer / Pause / Reprendre. */
@Composable
fun CircleActionButton(
    label: String,
    color: Color,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    size: androidx.compose.ui.unit.Dp = 88.dp,
) {
    androidx.compose.material3.Button(
        onClick = onClick,
        enabled = enabled,
        shape = CircleShape,
        colors = ButtonDefaults.buttonColors(
            containerColor = color,
            contentColor = PandaWhite,
            disabledContainerColor = PandaOutline,
        ),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(0.dp),
        modifier = modifier.size(size),
    ) {
        Text(
            label,
            style = MaterialTheme.typography.labelMedium,
            fontWeight = FontWeight.Bold,
            textAlign = TextAlign.Center,
        )
    }
}

/**
 * Cercle de décompte avant démarrage réel — affiche le nombre de secondes restantes dans un
 * anneau de progression. Un tap n'importe où sur le cercle annule le décompte (délégué à l'appelant).
 */
@Composable
fun CountdownCircle(
    secondsLeft: Int,
    totalSeconds: Int,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    color: Color = com.pandafit.designsystem.theme.PandaPurple,
    size: androidx.compose.ui.unit.Dp = 88.dp,
) {
    val progress = if (totalSeconds > 0) secondsLeft.toFloat() / totalSeconds.toFloat() else 0f
    Box(
        modifier = modifier
            .size(size)
            .pointerInput(Unit) { detectTapGestures(onTap = { onClick() }) },
        contentAlignment = Alignment.Center,
    ) {
        CircularProgressIndicator(
            progress = { progress },
            modifier = Modifier.size(size),
            color = color,
            strokeWidth = 5.dp,
            trackColor = PandaOutline,
        )
        Text(
            secondsLeft.toString(),
            style = MaterialTheme.typography.headlineMedium,
            fontWeight = FontWeight.ExtraBold,
            color = color,
        )
    }
}

/**
 * Bouton rond "maintenir pour confirmer" — utilisé pour Fin de séance : un simple tap ne fait
 * rien, il faut maintenir l'appui pendant [holdDurationMs] pour que [onConfirmed] se déclenche.
 * L'anneau se remplit pendant l'appui et revient à zéro si relâché avant la fin.
 */
@Composable
fun HoldToConfirmCircleButton(
    label: String,
    holdDurationMs: Long,
    onConfirmed: () -> Unit,
    modifier: Modifier = Modifier,
    color: Color = com.pandafit.designsystem.theme.PandaRed,
    size: androidx.compose.ui.unit.Dp = 88.dp,
) {
    val progress = remember { Animatable(0f) }
    val scope = rememberCoroutineScope()
    var confirmed by remember { mutableStateOf(false) }

    LaunchedEffect(confirmed) {
        if (confirmed) {
            onConfirmed()
            confirmed = false
        }
    }

    Box(
        modifier = modifier
            .size(size)
            .pointerInput(holdDurationMs) {
                detectTapGestures(
                    onPress = {
                        val holdJob = scope.launch {
                            progress.animateTo(1f, tween(holdDurationMs.toInt(), easing = LinearEasing))
                            confirmed = true
                        }
                        tryAwaitRelease()
                        holdJob.cancel()
                        if (progress.value < 1f) {
                            scope.launch { progress.animateTo(0f, tween(200)) }
                        }
                    },
                )
            },
        contentAlignment = Alignment.Center,
    ) {
        Box(
            modifier = Modifier
                .size(size)
                .background(color.copy(alpha = 0.15f), CircleShape),
        )
        CircularProgressIndicator(
            progress = { progress.value },
            modifier = Modifier.size(size),
            color = color,
            strokeWidth = 5.dp,
            trackColor = Color.Transparent,
        )
        Text(
            label,
            style = MaterialTheme.typography.labelMedium,
            fontWeight = FontWeight.Bold,
            color = color,
            textAlign = TextAlign.Center,
        )
    }
}
