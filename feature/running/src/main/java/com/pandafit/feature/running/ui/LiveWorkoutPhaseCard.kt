package com.pandafit.feature.running.ui

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.pandafit.designsystem.theme.PandaOnBackground
import com.pandafit.designsystem.theme.PandaSubtext
import com.pandafit.feature.running.R
import com.pandafit.feature.running.model.LivePhaseUiState

/** Carte "MAINTENANT" du cockpit live running : mascotte + phase active, progression, prochaine étape. */
@Composable
fun LiveWorkoutPhaseCard(
    phase: LivePhaseUiState,
    modifier: Modifier = Modifier,
    isFreeRun: Boolean = false,
) {
    // Même couleur que la programmation (création) pour un type d'étape donné.
    val accent = runStepColor(phase.stepType)
    val bg = accent.copy(alpha = 0.12f)
    val showMascot = LocalConfiguration.current.screenWidthDp >= 340

    Card(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
    ) {
        Row(
            modifier = Modifier.padding(16.dp),
            verticalAlignment = Alignment.Bottom,
        ) {
            if (showMascot) {
                Image(
                    painter = painterResource(R.drawable.panda_running_male),
                    contentDescription = null,
                    contentScale = ContentScale.Fit,
                    modifier = Modifier.width(120.dp).height(190.dp),
                )
                Spacer(Modifier.width(12.dp))
            }
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    phase.label,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.ExtraBold,
                    color = accent,
                )
                Spacer(Modifier.height(8.dp))
                Row(verticalAlignment = Alignment.Bottom) {
                    Text(
                        phase.currentValueLabel,
                        style = MaterialTheme.typography.headlineLarge,
                        fontWeight = FontWeight.ExtraBold,
                        color = PandaOnBackground,
                        maxLines = 1,
                    )
                    if (!isFreeRun) {
                        Text(
                            " / ${phase.targetValueLabel}",
                            style = MaterialTheme.typography.titleMedium,
                            color = PandaSubtext,
                            maxLines = 1,
                        )
                    }
                }
                if (phase.targetHint != null) {
                    Text(phase.targetHint, style = MaterialTheme.typography.bodyMedium, color = PandaSubtext)
                }
                if (!isFreeRun) {
                    Spacer(Modifier.height(12.dp))
                    LinearProgressIndicator(
                        progress = { phase.progress },
                        modifier = Modifier.fillMaxWidth().height(10.dp),
                        color = accent,
                        trackColor = bg,
                    )
                    Spacer(Modifier.height(8.dp))
                    Text(
                        phase.remainingLabel,
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.ExtraBold,
                        color = accent,
                    )
                    if (phase.nextLabel != null) {
                        Spacer(Modifier.height(12.dp))
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .background(bg, RoundedCornerShape(14.dp))
                                .padding(horizontal = 12.dp, vertical = 8.dp),
                        ) {
                            Text(phase.nextLabel, style = MaterialTheme.typography.bodyLarge, color = PandaSubtext)
                        }
                    } else if (phase.isLastStep) {
                        Spacer(Modifier.height(12.dp))
                        Text(
                            "DERNIÈRE ÉTAPE",
                            style = MaterialTheme.typography.labelMedium,
                            fontWeight = FontWeight.Bold,
                            color = PandaSubtext,
                        )
                    }
                }
            }
        }
    }
}
