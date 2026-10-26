package com.pandafit.feature.calendar.ui

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.DirectionsBike
import androidx.compose.material.icons.automirrored.filled.DirectionsRun
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Air
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.FitnessCenter
import androidx.compose.material.icons.filled.Landscape
import androidx.compose.material.icons.filled.DateRange
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.pandafit.core.database.entities.BreathingSessionEntity
import com.pandafit.core.database.entities.InstanceSeanceEntity
import com.pandafit.core.database.entities.SeanceEntity
import com.pandafit.core.database.entities.WorkoutEntity
import com.pandafit.core.database.entities.WorkoutType
import com.pandafit.designsystem.components.PandaSportCard
import com.pandafit.designsystem.components.SportIconBadge
import com.pandafit.designsystem.theme.KalyptusGreen
import com.pandafit.designsystem.theme.PandaGreen
import com.pandafit.designsystem.theme.PandaPurple
import com.pandafit.designsystem.theme.PandaSubtext
import com.pandafit.feature.calendar.R

// ===== État vide du jour sélectionné =====

@Composable
internal fun CalendarEmptyDayState(gender: String, onAddSession: () -> Unit, modifier: Modifier = Modifier) {
    val mascotRes = if (gender == "FEMALE") {
        R.drawable.panda_calendar_empty_female
    } else {
        R.drawable.panda_calendar_empty_male
    }
    Column(
        modifier = modifier.padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Box(contentAlignment = Alignment.Center) {
            Box(
                modifier = Modifier.size(140.dp).clip(CircleShape).background(PandaGreen.copy(alpha = 0.10f)),
            )
            Image(
                painter = painterResource(mascotRes),
                contentDescription = null,
                modifier = Modifier.size(120.dp),
            )
        }
        Spacer(Modifier.height(12.dp))
        Text(
            stringResource(R.string.calendar_empty_day_title),
            style = MaterialTheme.typography.titleSmall,
            fontWeight = FontWeight.SemiBold,
            textAlign = TextAlign.Center,
        )
        Spacer(Modifier.height(4.dp))
        Text(
            stringResource(R.string.calendar_no_session_day),
            style = MaterialTheme.typography.bodyMedium,
            color = PandaSubtext,
            textAlign = TextAlign.Center,
        )
        Spacer(Modifier.height(16.dp))
        Button(
            onClick = onAddSession,
            colors = ButtonDefaults.buttonColors(containerColor = PandaGreen),
        ) {
            Icon(Icons.Default.Add, null, modifier = Modifier.size(18.dp))
            Spacer(Modifier.width(6.dp))
            Text(stringResource(R.string.calendar_add_session_title))
        }
    }
}

@Composable
internal fun CalendarWorkoutItem(
    workout: WorkoutEntity,
    onClick: () -> Unit,
    onDelete: () -> Unit,
    onReschedule: (() -> Unit)? = null,
    modifier: Modifier = Modifier,
) {
    var showConfirm by remember { mutableStateOf(false) }
    val accentColor = workoutTypeColor(workout.workoutType)
    val icon = when (workout.workoutType) {
        WorkoutType.RUNNING -> Icons.AutoMirrored.Filled.DirectionsRun
        WorkoutType.CYCLING -> Icons.AutoMirrored.Filled.DirectionsBike
        WorkoutType.STRENGTH -> Icons.Default.FitnessCenter
        WorkoutType.HIKING -> Icons.Default.Landscape
    }

    if (showConfirm) {
        AlertDialog(
            onDismissRequest = { showConfirm = false },
            title = { Text(stringResource(R.string.calendar_delete_workout_title)) },
            text = { Text(stringResource(R.string.calendar_delete_workout_text, workout.name)) },
            confirmButton = {
                TextButton(onClick = { showConfirm = false; onDelete() }) {
                    Text(stringResource(R.string.common_confirm_delete), color = MaterialTheme.colorScheme.error)
                }
            },
            dismissButton = {
                TextButton(onClick = { showConfirm = false }) { Text(stringResource(R.string.common_cancel)) }
            },
        )
    }

    PandaSportCard(accentColor = accentColor, onClick = onClick, modifier = modifier.fillMaxWidth()) {
        Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            SportIconBadge(icon = icon, contentDescription = null, accentColor = accentColor, size = 40.dp, iconSize = 20.dp)
            Spacer(Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(workout.name, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Medium)
                if (workout.objective.isNotBlank()) {
                    Text(workout.objective, style = MaterialTheme.typography.bodySmall, color = PandaSubtext)
                }
            }
            if (workout.isCompleted) {
                Icon(Icons.Default.CheckCircle, stringResource(R.string.calendar_completed_cd), tint = accentColor, modifier = Modifier.size(18.dp))
            } else if (onReschedule != null) {
                IconButton(onClick = onReschedule, modifier = Modifier.size(32.dp)) {
                    Icon(Icons.Default.DateRange, stringResource(R.string.calendar_change_date_cd), tint = PandaSubtext, modifier = Modifier.size(16.dp))
                }
            }
            Spacer(Modifier.width(4.dp))
            IconButton(onClick = { showConfirm = true }, modifier = Modifier.size(32.dp)) {
                Icon(Icons.Default.Delete, stringResource(R.string.common_delete_cd), tint = MaterialTheme.colorScheme.error, modifier = Modifier.size(16.dp))
            }
        }
    }
}

@Composable
internal fun CalendarInstanceItem(
    instance: InstanceSeanceEntity,
    seance: SeanceEntity?,
    onClick: () -> Unit,
    onDelete: () -> Unit,
    onReschedule: (() -> Unit)? = null,
    modifier: Modifier = Modifier,
) {
    var showConfirm by remember { mutableStateOf(false) }

    if (showConfirm) {
        AlertDialog(
            onDismissRequest = { showConfirm = false },
            title = { Text(stringResource(R.string.calendar_delete_workout_title)) },
            text = { Text(stringResource(R.string.calendar_delete_instance_text, seance?.nom ?: stringResource(R.string.calendar_delete_instance_fallback))) },
            confirmButton = {
                TextButton(onClick = { showConfirm = false; onDelete() }) {
                    Text(stringResource(R.string.common_confirm_delete), color = MaterialTheme.colorScheme.error)
                }
            },
            dismissButton = {
                TextButton(onClick = { showConfirm = false }) { Text(stringResource(R.string.common_cancel)) }
            },
        )
    }

    PandaSportCard(accentColor = PandaPurple, onClick = onClick, modifier = modifier.fillMaxWidth()) {
        Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            SportIconBadge(icon = Icons.Default.FitnessCenter, contentDescription = null, accentColor = PandaPurple, size = 40.dp, iconSize = 20.dp)
            Spacer(Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(seance?.nom ?: stringResource(R.string.calendar_instance_fallback), style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Medium)
                if (seance?.groupesMusculaires?.isNotEmpty() == true) {
                    Text(seance.groupesMusculaires.joinToString(" · "), style = MaterialTheme.typography.bodySmall, color = PandaSubtext)
                }
            }
            if (instance.isCompleted) {
                Icon(Icons.Default.CheckCircle, stringResource(R.string.calendar_completed_cd), tint = PandaPurple, modifier = Modifier.size(18.dp))
            } else {
                if (onReschedule != null) {
                    IconButton(onClick = onReschedule, modifier = Modifier.size(32.dp)) {
                        Icon(Icons.Default.DateRange, stringResource(R.string.calendar_change_date_cd), tint = PandaSubtext, modifier = Modifier.size(16.dp))
                    }
                }
                Icon(Icons.Default.PlayArrow, stringResource(R.string.calendar_start_cd), tint = PandaPurple, modifier = Modifier.size(18.dp))
            }
            Spacer(Modifier.width(4.dp))
            IconButton(onClick = { showConfirm = true }, modifier = Modifier.size(32.dp)) {
                Icon(Icons.Default.Delete, stringResource(R.string.common_delete_cd), tint = MaterialTheme.colorScheme.error, modifier = Modifier.size(16.dp))
            }
        }
    }
}

@Composable
internal fun CalendarBreathingItem(
    session: BreathingSessionEntity,
    modifier: Modifier = Modifier,
) {
    val durationMin = session.durationSeconds / 60
    val durationSec = session.durationSeconds % 60
    val durationLabel = if (durationMin > 0) "${durationMin}min${if (durationSec > 0) " ${durationSec}s" else ""}" else "${durationSec}s"

    PandaSportCard(accentColor = KalyptusGreen, modifier = modifier.fillMaxWidth()) {
        Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            SportIconBadge(icon = Icons.Default.Air, contentDescription = null, accentColor = KalyptusGreen, size = 40.dp, iconSize = 20.dp)
            Spacer(Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(session.methodName, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Medium)
                Text("$durationLabel · ${session.cyclesCompleted} cycle${if (session.cyclesCompleted > 1) "s" else ""}", style = MaterialTheme.typography.bodySmall, color = PandaSubtext)
            }
            Icon(Icons.Default.CheckCircle, stringResource(R.string.calendar_completed_cd), tint = KalyptusGreen, modifier = Modifier.size(18.dp))
        }
    }
}
