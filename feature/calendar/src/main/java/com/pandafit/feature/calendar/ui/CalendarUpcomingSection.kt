package com.pandafit.feature.calendar.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.FitnessCenter
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.pandafit.designsystem.components.PandaSportCard
import com.pandafit.designsystem.components.SportIconBadge
import com.pandafit.designsystem.theme.PandaPurple
import com.pandafit.designsystem.theme.PandaSubtext
import com.pandafit.feature.calendar.R
import com.pandafit.feature.calendar.model.UpcomingItem
import java.time.format.DateTimeFormatter
import java.util.Locale

// ===== Section "Prochaines séances" =====

@Composable
internal fun UpcomingItemRow(item: UpcomingItem, modifier: Modifier = Modifier) {
    val dateLabel = item.date.format(DateTimeFormatter.ofPattern("EEE d MMM", Locale.FRENCH)).replaceFirstChar { it.uppercase() }
    val (icon, color, title) = when (item) {
        is UpcomingItem.Workout -> Triple(workoutTypeIcon(item.workout.workoutType), workoutTypeColor(item.workout.workoutType), item.workout.name)
        is UpcomingItem.Instance -> Triple(Icons.Default.FitnessCenter, PandaPurple, item.seanceName)
    }
    val statusLabel = stringResource(if (item.isCompleted) R.string.calendar_status_completed else R.string.calendar_status_planned)
    PandaSportCard(accentColor = color, modifier = modifier.fillMaxWidth()) {
        Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            SportIconBadge(icon = icon, contentDescription = null, accentColor = color, size = 40.dp, iconSize = 20.dp)
            Spacer(Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(title, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Medium)
                Spacer(Modifier.height(2.dp))
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    Icon(Icons.Default.CalendarMonth, null, tint = PandaSubtext, modifier = Modifier.size(13.dp))
                    Text(dateLabel, style = MaterialTheme.typography.bodySmall, color = PandaSubtext)
                }
            }
            Text(
                statusLabel,
                style = MaterialTheme.typography.labelSmall,
                color = color,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier
                    .clip(RoundedCornerShape(12.dp))
                    .background(color.copy(alpha = 0.12f))
                    .padding(horizontal = 10.dp, vertical = 4.dp),
            )
        }
    }
}
