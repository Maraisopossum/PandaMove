package com.pandafit.feature.running.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.pandafit.designsystem.theme.PandaOnBackground
import com.pandafit.designsystem.theme.PandaOutlineVariant
import com.pandafit.designsystem.theme.PandaPhaseCooldown
import com.pandafit.designsystem.theme.PandaPhaseEffort
import com.pandafit.designsystem.theme.PandaPhaseRecovery
import com.pandafit.designsystem.theme.PandaPhaseWarmup
import com.pandafit.designsystem.theme.PandaSubtextLight
import com.pandafit.designsystem.theme.PandaWhite
import com.pandafit.feature.running.model.LivePhaseKind
import com.pandafit.feature.running.model.TimelineStatus
import com.pandafit.feature.running.model.TimelineStepUiState

private fun kindColor(kind: LivePhaseKind) = when (kind) {
    LivePhaseKind.WARMUP   -> PandaPhaseWarmup
    LivePhaseKind.EFFORT   -> PandaPhaseEffort
    LivePhaseKind.RECOVERY -> PandaPhaseRecovery
    LivePhaseKind.COOLDOWN -> PandaPhaseCooldown
}

/** Timeline horizontale compacte des grandes étapes de la séance (remplace les tableaux répétitifs). */
@Composable
fun WorkoutProgressTimeline(
    steps: List<TimelineStepUiState>,
    modifier: Modifier = Modifier,
) {
    if (steps.isEmpty()) return
    LazyRow(modifier = modifier.fillMaxWidth(), verticalAlignment = Alignment.Top) {
        itemsIndexed(steps) { index, step ->
            if (index > 0) {
                Box(
                    modifier = Modifier
                        .padding(top = 13.dp)
                        .width(20.dp)
                        .height(3.dp)
                        .background(PandaOutlineVariant, RoundedCornerShape(2.dp)),
                )
            }
            TimelineNode(step)
        }
    }
}

@Composable
private fun TimelineNode(step: TimelineStepUiState) {
    val color = kindColor(step.kind)
    Column(
        modifier = Modifier.width(96.dp).padding(horizontal = 4.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Box(
            modifier = Modifier
                .size(28.dp)
                .background(
                    color = when (step.status) {
                        TimelineStatus.COMPLETED -> color
                        TimelineStatus.ACTIVE    -> Color.White
                        TimelineStatus.UPCOMING  -> Color.White
                    },
                    shape = CircleShape,
                )
                .border(
                    width = if (step.status == TimelineStatus.ACTIVE) 2.dp else 1.dp,
                    color = when (step.status) {
                        TimelineStatus.UPCOMING -> PandaOutlineVariant
                        else -> color
                    },
                    shape = CircleShape,
                ),
            contentAlignment = Alignment.Center,
        ) {
            when (step.status) {
                TimelineStatus.COMPLETED -> Icon(Icons.Filled.Check, contentDescription = null, tint = PandaWhite, modifier = Modifier.size(16.dp))
                TimelineStatus.ACTIVE    -> Box(modifier = Modifier.size(10.dp).background(color, CircleShape))
                TimelineStatus.UPCOMING  -> Unit
            }
        }
        Spacer(Modifier.height(4.dp))
        Text(
            step.label,
            style = MaterialTheme.typography.labelSmall,
            fontWeight = if (step.status == TimelineStatus.ACTIVE) FontWeight.Bold else FontWeight.Normal,
            color = if (step.status == TimelineStatus.UPCOMING) PandaSubtextLight else PandaOnBackground,
            maxLines = 1,
        )
        if (step.sublabel != null) {
            Text(
                step.sublabel,
                style = MaterialTheme.typography.labelSmall,
                fontWeight = FontWeight.SemiBold,
                color = if (step.status == TimelineStatus.UPCOMING) PandaSubtextLight else color,
                textAlign = TextAlign.Center,
                maxLines = 2,
            )
        }
    }
}
