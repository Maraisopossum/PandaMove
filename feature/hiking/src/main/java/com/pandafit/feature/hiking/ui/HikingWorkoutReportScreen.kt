package com.pandafit.feature.hiking.ui

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.pandafit.designsystem.components.PandaLoadingIndicator
import com.pandafit.designsystem.components.PandaTopBar
import com.pandafit.designsystem.theme.PandaAmber
import com.pandafit.designsystem.theme.PandaSubtext
import com.pandafit.feature.hiking.viewmodel.HikingReportViewModel
import java.time.format.DateTimeFormatter
import java.time.format.TextStyle
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HikingWorkoutReportScreen(
    workoutId: Long,
    onNavigateBack: () -> Unit,
    onNavigateToEdit: (Long) -> Unit,
    viewModel: HikingReportViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    var showDeleteDialog by remember { mutableStateOf(false) }

    LaunchedEffect(workoutId) { viewModel.load(workoutId) }

    if (showDeleteDialog) {
        AlertDialog(
            onDismissRequest = { showDeleteDialog = false },
            title = { Text("Supprimer cette sortie ?") },
            text = { Text("Cette action est irréversible.") },
            confirmButton = {
                TextButton(onClick = {
                    viewModel.delete(workoutId) { onNavigateBack() }
                    showDeleteDialog = false
                }) { Text("Supprimer", color = MaterialTheme.colorScheme.error) }
            },
            dismissButton = {
                TextButton(onClick = { showDeleteDialog = false }) { Text("Annuler") }
            },
        )
    }

    Scaffold(
        topBar = {
            PandaTopBar(
                title = uiState.workout?.name ?: "Sortie rando",
                containerColor = PandaAmber,
                onNavigateBack = onNavigateBack,
                actions = {
                    IconButton(onClick = { onNavigateToEdit(workoutId) }) {
                        Icon(Icons.Default.Edit, contentDescription = "Modifier", tint = Color.White)
                    }
                    IconButton(onClick = { showDeleteDialog = true }) {
                        Icon(Icons.Default.Delete, contentDescription = "Supprimer", tint = Color.White)
                    }
                },
            )
        },
    ) { innerPadding ->
        if (uiState.isLoading) { PandaLoadingIndicator(); return@Scaffold }
        val w = uiState.workout ?: return@Scaffold

        Column(
            modifier = Modifier
                .padding(innerPadding)
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            val dateFmt = DateTimeFormatter.ofPattern("d MMMM yyyy", Locale.FRENCH)
            val dayName = w.scheduledDate.dayOfWeek
                .getDisplayName(TextStyle.FULL, Locale.FRENCH)
                .replaceFirstChar { it.uppercaseChar() }

            Text(
                "$dayName ${w.scheduledDate.format(dateFmt)}",
                style = MaterialTheme.typography.bodyMedium,
                color = PandaSubtext,
            )

            // Métriques principales
            Card(
                colors = CardDefaults.cardColors(containerColor = PandaAmber.copy(alpha = 0.08f)),
                elevation = CardDefaults.cardElevation(0.dp),
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth().padding(16.dp),
                    horizontalArrangement = Arrangement.SpaceEvenly,
                ) {
                    w.resultDistanceKm?.let { MetricColumn("${"%.2f".format(it)} km", "Distance") }
                    w.resultDurationSec?.let { sec ->
                        val h = sec / 3600; val m = (sec % 3600) / 60
                        MetricColumn(if (h > 0) "${h}h${m.toString().padStart(2, '0')}" else "${m}min", "Durée")
                    }
                    w.resultElevationM?.let { MetricColumn("↑ ${it}m", "Dénivelé+") }
                }
            }

            // Métriques secondaires
            if (w.resultSpeedAvgKmh != null || w.resultHrAvg != null || w.resultRpe != null) {
                Card(elevation = CardDefaults.cardElevation(2.dp)) {
                    Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        w.resultSpeedAvgKmh?.let { StatRow("Vitesse moyenne", "${"%.1f".format(it)} km/h") }
                        w.resultHrAvg?.let { StatRow("FC moyenne", "$it bpm") }
                        w.resultRpe?.let { StatRow("RPE", "$it / 10") }
                    }
                }
            }

            // Notes
            if (w.resultNotes.isNotBlank()) {
                Card(elevation = CardDefaults.cardElevation(2.dp)) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text("Notes", style = MaterialTheme.typography.titleSmall, color = PandaAmber)
                        Spacer(Modifier.height(4.dp))
                        Text(w.resultNotes, style = MaterialTheme.typography.bodyMedium)
                    }
                }
            }
        }
    }
}

@Composable
private fun MetricColumn(value: String, label: String) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(value, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.ExtraBold, color = PandaAmber)
        Text(label, style = MaterialTheme.typography.labelSmall, color = PandaSubtext)
    }
}

@Composable
private fun StatRow(label: String, value: String) {
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(label, style = MaterialTheme.typography.bodyMedium, color = PandaSubtext)
        Text(value, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold)
    }
}
