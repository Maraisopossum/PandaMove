package com.pandafit.designsystem.components

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.FitnessCenter
import androidx.compose.material.icons.filled.Timer
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.pandafit.designsystem.theme.PandaPurple
import com.pandafit.designsystem.theme.PandaWhite

/**
 * Bandeau de séance en cours — sticky au-dessus de la BottomNav / DrawerNav.
 *
 * Affiché quand une séance de renforcement est active.
 * Tape dessus → reprend la séance.
 *
 * ```
 * ActiveSessionBanner(
 *     visible = hasActiveSession,
 *     sessionName = "Haut du corps",
 *     elapsed = "12:34",
 *     restLabel = "Repos : 1:28",
 *     onClick = { navController.navigate(activeInstanceRoute) },
 * )
 * ```
 */
@Composable
fun ActiveSessionBanner(
    visible: Boolean,
    sessionName: String,
    elapsed: String,
    restLabel: String? = null,
    color: Color = PandaPurple,
    icon: ImageVector = Icons.Default.FitnessCenter,
    onClick: () -> Unit,
) {
    AnimatedVisibility(
        visible = visible,
        enter = slideInVertically { it },
        exit = slideOutVertically { it },
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(color)
                .clickable(onClick = onClick)
                .padding(horizontal = 16.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            // Icône sport
            Icon(
                icon,
                contentDescription = null,
                tint = PandaWhite,
                modifier = Modifier.size(18.dp),
            )

            // Nom de la séance
            Text(
                sessionName,
                style = MaterialTheme.typography.labelLarge,
                fontWeight = FontWeight.Bold,
                color = PandaWhite,
                modifier = Modifier.weight(1f),
                maxLines = 1,
            )

            // Repos restant (si actif)
            if (!restLabel.isNullOrBlank()) {
                Text(
                    restLabel,
                    style = MaterialTheme.typography.labelMedium,
                    fontWeight = FontWeight.Bold,
                    color = Color.Red.copy(red = 1f, green = 0.6f, blue = 0.6f),
                    modifier = Modifier
                        .background(Color.White.copy(alpha = 0.15f), RoundedCornerShape(6.dp))
                        .padding(horizontal = 8.dp, vertical = 2.dp),
                )
                Spacer(Modifier.width(4.dp))
            }

            // Chrono séance
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(4.dp),
                modifier = Modifier
                    .background(Color.White.copy(alpha = 0.15f), RoundedCornerShape(6.dp))
                    .padding(horizontal = 8.dp, vertical = 2.dp),
            ) {
                Icon(Icons.Default.Timer, null, tint = PandaWhite.copy(alpha = 0.85f), modifier = Modifier.size(12.dp))
                Text(elapsed, style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.SemiBold, color = PandaWhite)
            }
        }
    }
}
