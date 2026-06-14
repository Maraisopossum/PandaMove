package com.pandafit.feature.cycling.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.pandafit.designsystem.components.PandaLoadingIndicator
import com.pandafit.designsystem.theme.PandaBlue
import com.pandafit.designsystem.theme.PandaSubtext
import com.pandafit.feature.cycling.viewmodel.CyclingExecuteViewModel
import java.time.format.DateTimeFormatter
import java.util.Locale

private val GrayBg    = Color(0xFFF4F4F7)
private val DarkColor = Color(0xFF1A1A2E)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CyclingWorkoutExecuteScreen(
    workoutId: Long,
    onNavigateBack: () -> Unit,
    onNavigateToReport: (Long) -> Unit = { onNavigateBack() },
    viewModel: CyclingExecuteViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    var showFinishDialog by remember { mutableStateOf(false) }

    // Navigation automatique après validation → rapport de séance
    LaunchedEffect(uiState.isCompleted) {
        if (uiState.isCompleted) onNavigateToReport(workoutId)
    }

    if (showFinishDialog) {
        AlertDialog(
            onDismissRequest = { showFinishDialog = false },
            title = { Text("Valider la séance ?", fontWeight = FontWeight.Bold) },
            text = { Text("Les résultats seront sauvegardés et la séance marquée comme terminée.") },
            confirmButton = {
                TextButton(onClick = { viewModel.finishWorkout(); showFinishDialog = false }) {
                    Text("Valider", color = PandaBlue, fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = { TextButton(onClick = { showFinishDialog = false }) { Text("Annuler") } },
        )
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(
                            uiState.workout?.name ?: "Résultats",
                            style = MaterialTheme.typography.titleSmall,
                            fontWeight = FontWeight.ExtraBold,
                        )
                        val dateStr = uiState.workout?.scheduledDate
                            ?.format(DateTimeFormatter.ofPattern("EEEE d MMMM", Locale.FRENCH))
                            ?.replaceFirstChar { it.uppercase() } ?: ""
                        if (dateStr.isNotBlank()) {
                            Text(dateStr, style = MaterialTheme.typography.labelSmall, color = PandaSubtext)
                        }
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, "Retour")
                    }
                },
                actions = {
                    TextButton(onClick = { showFinishDialog = true }) {
                        Text("Valider", color = PandaBlue, fontWeight = FontWeight.Bold)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.surface),
            )
        },
        containerColor = MaterialTheme.colorScheme.background,
    ) { innerPadding ->
        if (uiState.isLoading) { PandaLoadingIndicator(); return@Scaffold }

        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(innerPadding),
            contentPadding = PaddingValues(start = 16.dp, end = 16.dp, bottom = 32.dp),
        ) {
            // ── Résultats globaux ─────────────────────────────────────────────
            item {
                Spacer(Modifier.height(12.dp))
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(GrayBg, RoundedCornerShape(14.dp))
                        .padding(14.dp),
                ) {
                    Text(
                        "RÉSULTATS",
                        style = MaterialTheme.typography.labelSmall,
                        color = PandaSubtext,
                        fontWeight = FontWeight.Bold,
                    )
                    Spacer(Modifier.height(10.dp))

                    // Ligne 1 : Distance · Durée · Vitesse moy. (auto)
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        ResultInputCell("Distance (km)", uiState.resultDistanceKm, KeyboardType.Decimal, Modifier.weight(1f)) {
                            viewModel.updateField("distanceKm", it)
                        }
                        ResultInputCell("Durée (h:mm:ss)", uiState.resultDurationStr, KeyboardType.Text, Modifier.weight(1f)) {
                            viewModel.updateField("duration", it)
                        }
                        ReadOnlyCell("Vit. moy. (km/h)", uiState.resultSpeedAvgKmh, Modifier.weight(1f))
                    }
                    Spacer(Modifier.height(8.dp))

                    // Ligne 2 : Vitesse max · FC moy · FC max
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        ResultInputCell("Vit. max (km/h)", uiState.resultSpeedMaxKmh, KeyboardType.Decimal, Modifier.weight(1f)) {
                            viewModel.updateField("speedMax", it)
                        }
                        ResultInputCell("FC moy. (bpm)", uiState.resultHrAvg, KeyboardType.Number, Modifier.weight(1f)) {
                            viewModel.updateField("hr", it)
                        }
                        ResultInputCell("FC max (bpm)", uiState.resultHrMax, KeyboardType.Number, Modifier.weight(1f)) {
                            viewModel.updateField("hrMax", it)
                        }
                    }
                    Spacer(Modifier.height(8.dp))

                    // Ligne 3 : Cadence · RPE · Dénivelé+
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        ResultInputCell("Cadence (rpm)", uiState.resultCadenceAvgRpm, KeyboardType.Number, Modifier.weight(1f)) {
                            viewModel.updateField("cadence", it)
                        }
                        ResultInputCell("RPE (1–10)", uiState.resultRpe, KeyboardType.Number, Modifier.weight(1f)) { v ->
                            if (v.isEmpty() || (v.toIntOrNull() ?: 0) <= 10) viewModel.updateField("rpe", v)
                        }
                        ResultInputCell("Dénivelé+ (m)", uiState.resultElevationM, KeyboardType.Number, Modifier.weight(1f)) {
                            viewModel.updateField("elevation", it)
                        }
                    }
                    Spacer(Modifier.height(8.dp))

                    // Ligne 4 : Calories
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        ResultInputCell("Calories (kcal)", uiState.resultCalories, KeyboardType.Number, Modifier.weight(1f)) {
                            viewModel.updateField("calories", it)
                        }
                        Spacer(Modifier.weight(2f))
                    }
                }
                Spacer(Modifier.height(16.dp))
            }

            // ── Note de séance ────────────────────────────────────────────────
            item {
                Text(
                    "NOTE DE SÉANCE",
                    style = MaterialTheme.typography.labelSmall,
                    color = PandaSubtext,
                    fontWeight = FontWeight.Bold,
                )
                Spacer(Modifier.height(6.dp))
                OutlinedTextField(
                    value = uiState.resultNotes,
                    onValueChange = { viewModel.updateField("notes", it) },
                    modifier = Modifier.fillMaxWidth(),
                    minLines = 3,
                    placeholder = { Text("Commentaire global de la séance…") },
                    shape = RoundedCornerShape(12.dp),
                )
                Spacer(Modifier.height(16.dp))
            }

            // ── Bouton valider ────────────────────────────────────────────────
            item {
                Button(
                    onClick = { showFinishDialog = true },
                    modifier = Modifier.fillMaxWidth().height(52.dp),
                    shape = RoundedCornerShape(14.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = PandaBlue),
                ) {
                    Text(
                        "Valider la séance",
                        color = Color.White,
                        fontWeight = FontWeight.Bold,
                        style = MaterialTheme.typography.labelLarge,
                    )
                }
            }
        }
    }
}

// ── Cellule résultat éditable ─────────────────────────────────────────────────

@Composable
private fun ResultInputCell(
    label: String,
    value: String,
    keyboardType: KeyboardType,
    modifier: Modifier = Modifier,
    onValueChange: (String) -> Unit,
) {
    Column(
        modifier = modifier
            .background(Color.White, RoundedCornerShape(10.dp))
            .padding(horizontal = 10.dp, vertical = 8.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(label, style = MaterialTheme.typography.labelSmall, color = PandaSubtext, textAlign = TextAlign.Center)
        BasicTextField(
            value = value,
            onValueChange = onValueChange,
            textStyle = TextStyle(fontSize = 15.sp, fontWeight = FontWeight.Bold, color = DarkColor, textAlign = TextAlign.Center),
            keyboardOptions = KeyboardOptions(keyboardType = keyboardType),
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
            decorationBox = { inner ->
                Box(modifier = Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                    if (value.isEmpty()) {
                        Text("—", style = TextStyle(fontSize = 15.sp, color = PandaSubtext, textAlign = TextAlign.Center))
                    }
                    inner()
                }
            },
        )
    }
}

// ── Cellule lecture seule (vitesse moy. auto-calculée) ───────────────────────

@Composable
private fun ReadOnlyCell(
    label: String,
    value: String,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier
            .background(Color(0xFFEAEAEA), RoundedCornerShape(10.dp))
            .padding(horizontal = 10.dp, vertical = 8.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(label, style = MaterialTheme.typography.labelSmall, color = PandaSubtext, textAlign = TextAlign.Center)
        Text(
            text = if (value.isEmpty()) "auto" else value,
            style = TextStyle(
                fontSize = 15.sp,
                fontWeight = FontWeight.Bold,
                color = if (value.isEmpty()) PandaSubtext else DarkColor,
                textAlign = TextAlign.Center,
            ),
            modifier = Modifier.fillMaxWidth(),
            textAlign = TextAlign.Center,
        )
    }
}
