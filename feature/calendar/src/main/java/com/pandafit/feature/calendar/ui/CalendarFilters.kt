package com.pandafit.feature.calendar.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.DirectionsBike
import androidx.compose.material.icons.automirrored.filled.DirectionsRun
import androidx.compose.material.icons.filled.FitnessCenter
import androidx.compose.material.icons.filled.Landscape
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import com.pandafit.core.database.entities.WorkoutType
import com.pandafit.designsystem.theme.PandaAmber
import com.pandafit.designsystem.theme.PandaBlue
import com.pandafit.designsystem.theme.PandaGreen
import com.pandafit.designsystem.theme.PandaPurple

// ===== Toggle filtre sport (pictogramme seul) =====

@Composable
internal fun CalendarSportToggle(
    icon: ImageVector,
    color: Color,
    selected: Boolean,
    onClick: () -> Unit,
) {
    Box(
        modifier = Modifier
            .size(44.dp)
            .clip(CircleShape)
            .background(if (selected) color else color.copy(alpha = 0.12f))
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Icon(
            icon,
            null,
            tint = if (selected) Color.White else color,
            modifier = Modifier.size(20.dp),
        )
    }
}

internal fun workoutTypeColor(type: WorkoutType) = when (type) {
    WorkoutType.RUNNING -> PandaGreen; WorkoutType.CYCLING -> PandaBlue; WorkoutType.STRENGTH -> PandaPurple; WorkoutType.HIKING -> PandaAmber
}
internal fun workoutTypeIcon(type: WorkoutType) = when (type) {
    WorkoutType.RUNNING -> Icons.AutoMirrored.Filled.DirectionsRun
    WorkoutType.CYCLING -> Icons.AutoMirrored.Filled.DirectionsBike
    WorkoutType.STRENGTH -> Icons.Default.FitnessCenter
    WorkoutType.HIKING -> Icons.Default.Landscape
}
