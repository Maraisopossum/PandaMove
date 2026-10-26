package com.pandafit.feature.calendar.ui

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.DirectionsBike
import androidx.compose.material.icons.automirrored.filled.DirectionsRun
import androidx.compose.material.icons.filled.FitnessCenter
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.pandafit.core.database.entities.SeanceEntity
import com.pandafit.core.database.entities.WorkoutEntity
import com.pandafit.designsystem.theme.PandaBlue
import com.pandafit.designsystem.theme.PandaGreen
import com.pandafit.designsystem.theme.PandaPurple
import com.pandafit.designsystem.theme.PandaSubtext
import com.pandafit.feature.calendar.R

// ===== Bottom sheet — choix du type de séance à ajouter =====

@Composable
internal fun AddSessionChooserSheet(
    onPickStrength: () -> Unit,
    onPickRunning: () -> Unit,
    onPickCycling: () -> Unit,
) {
    Column(modifier = Modifier.fillMaxWidth()) {
        Text(
            stringResource(R.string.calendar_add_session_title),
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp),
        )
        HorizontalDivider()
        TextButton(
            onClick = onPickStrength,
            modifier = Modifier.fillMaxWidth(),
            contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
        ) {
            Icon(Icons.Default.FitnessCenter, null, tint = PandaPurple, modifier = Modifier.size(18.dp))
            Spacer(Modifier.width(10.dp))
            Text(stringResource(R.string.calendar_add_strength_option), modifier = Modifier.weight(1f), style = MaterialTheme.typography.bodyMedium)
        }
        HorizontalDivider(modifier = Modifier.padding(horizontal = 16.dp))
        TextButton(
            onClick = onPickRunning,
            modifier = Modifier.fillMaxWidth(),
            contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
        ) {
            Icon(Icons.AutoMirrored.Filled.DirectionsRun, null, tint = PandaGreen, modifier = Modifier.size(18.dp))
            Spacer(Modifier.width(10.dp))
            Text(stringResource(R.string.calendar_add_running_option), modifier = Modifier.weight(1f), style = MaterialTheme.typography.bodyMedium)
        }
        HorizontalDivider(modifier = Modifier.padding(horizontal = 16.dp))
        TextButton(
            onClick = onPickCycling,
            modifier = Modifier.fillMaxWidth(),
            contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
        ) {
            Icon(Icons.AutoMirrored.Filled.DirectionsBike, null, tint = PandaBlue, modifier = Modifier.size(18.dp))
            Spacer(Modifier.width(10.dp))
            Text(stringResource(R.string.calendar_add_cycling_option), modifier = Modifier.weight(1f), style = MaterialTheme.typography.bodyMedium)
        }
        Spacer(Modifier.height(24.dp))
    }
}

// ===== Bottom sheet séances =====

@Composable
internal fun SeancePickerSheet(
    seances: List<SeanceEntity>,
    onSelect: (Long) -> Unit,
    onDismiss: () -> Unit,
) {
    Column(modifier = Modifier.fillMaxWidth()) {
        Text(
            stringResource(R.string.calendar_sheet_assign_seance),
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp),
        )
        HorizontalDivider()
        if (seances.isEmpty()) {
            Text(
                stringResource(R.string.calendar_sheet_no_seance),
                style = MaterialTheme.typography.bodySmall,
                color = PandaSubtext,
                modifier = Modifier.padding(16.dp),
            )
        } else {
            LazyColumn {
                items(seances, key = { it.id }) { seance ->
                    TextButton(
                        onClick = { onSelect(seance.id) },
                        modifier = Modifier.fillMaxWidth(),
                        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
                    ) {
                        Icon(Icons.Default.FitnessCenter, null, tint = PandaPurple, modifier = Modifier.size(18.dp))
                        Spacer(Modifier.width(10.dp))
                        Text(seance.nom, modifier = Modifier.weight(1f), style = MaterialTheme.typography.bodyMedium)
                    }
                    HorizontalDivider(modifier = Modifier.padding(horizontal = 16.dp))
                }
                item { Spacer(Modifier.height(32.dp)) }
            }
        }
    }
}

// ===== Bottom sheet workouts (running / vélo) =====

@Composable
internal fun WorkoutPickerSheet(
    title: String,
    workouts: List<WorkoutEntity>,
    accentColor: Color,
    icon: ImageVector,
    onSelect: (Long) -> Unit,
    onDismiss: () -> Unit,
) {
    Column(modifier = Modifier.fillMaxWidth()) {
        Text(
            title,
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp),
        )
        HorizontalDivider()
        if (workouts.isEmpty()) {
            Text(
                stringResource(R.string.calendar_sheet_no_template),
                style = MaterialTheme.typography.bodySmall,
                color = PandaSubtext,
                modifier = Modifier.padding(16.dp),
            )
        } else {
            LazyColumn {
                items(workouts, key = { it.id }) { workout ->
                    TextButton(
                        onClick = { onSelect(workout.id) },
                        modifier = Modifier.fillMaxWidth(),
                        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
                    ) {
                        Icon(icon, null, tint = accentColor, modifier = Modifier.size(18.dp))
                        Spacer(Modifier.width(10.dp))
                        Text(workout.name, modifier = Modifier.weight(1f), style = MaterialTheme.typography.bodyMedium)
                    }
                    HorizontalDivider(modifier = Modifier.padding(horizontal = 16.dp))
                }
                item { Spacer(Modifier.height(32.dp)) }
            }
        }
    }
}
