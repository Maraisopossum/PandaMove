package com.pandafit.feature.hiking.ui

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.pandafit.designsystem.components.PandaTopBar
import com.pandafit.designsystem.theme.PandaAmber
import com.pandafit.feature.hiking.R
import com.pandafit.feature.hiking.viewmodel.HikingDetailViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HikingWorkoutDetailScreen(
    workoutId: Long?,
    onNavigateBack: () -> Unit,
    onSaved: (Long) -> Unit,
    viewModel: HikingDetailViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

    LaunchedEffect(workoutId) {
        if (workoutId != null) viewModel.load(workoutId) else viewModel.initNew()
    }
    LaunchedEffect(uiState.savedId) {
        uiState.savedId?.let { onSaved(it) }
    }

    Scaffold(
        topBar = {
            PandaTopBar(
                title = if (workoutId != null) stringResource(R.string.hiking_detail_title_edit) else stringResource(R.string.hiking_detail_title_new),
                containerColor = PandaAmber,
                onNavigateBack = onNavigateBack,
            )
        },
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .padding(innerPadding)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 16.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            // Nom
            OutlinedTextField(
                value = uiState.name,
                onValueChange = { viewModel.update { copy(name = it) } },
                label = { Text(stringResource(R.string.hiking_field_name_label)) },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
            )

            // Date
            OutlinedTextField(
                value = uiState.dateStr,
                onValueChange = { viewModel.update { copy(dateStr = it) } },
                label = { Text(stringResource(R.string.hiking_field_date_label)) },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
            )

            HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp))
            Text(stringResource(R.string.hiking_metrics_section), style = MaterialTheme.typography.titleSmall, color = PandaAmber)

            // Distance + Durée sur une ligne
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = uiState.distanceKm,
                    onValueChange = { viewModel.update { copy(distanceKm = it) } },
                    label = { Text(stringResource(R.string.hiking_field_distance)) },
                    modifier = Modifier.weight(1f),
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                )
                OutlinedTextField(
                    value = uiState.durationH,
                    onValueChange = { viewModel.update { copy(durationH = it) } },
                    label = { Text(stringResource(R.string.hiking_field_duration_h)) },
                    modifier = Modifier.weight(0.5f),
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                )
                OutlinedTextField(
                    value = uiState.durationMin,
                    onValueChange = { viewModel.update { copy(durationMin = it) } },
                    label = { Text(stringResource(R.string.hiking_field_duration_min)) },
                    modifier = Modifier.weight(0.5f),
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                )
            }

            // Dénivelé + Vitesse
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = uiState.elevationM,
                    onValueChange = { viewModel.update { copy(elevationM = it) } },
                    label = { Text(stringResource(R.string.hiking_field_elevation)) },
                    modifier = Modifier.weight(1f),
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                )
                OutlinedTextField(
                    value = uiState.speedKmh,
                    onValueChange = { viewModel.update { copy(speedKmh = it) } },
                    label = { Text(stringResource(R.string.hiking_field_speed)) },
                    modifier = Modifier.weight(1f),
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                    placeholder = { Text(stringResource(R.string.hiking_field_speed_placeholder)) },
                )
            }

            HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp))
            Text(stringResource(R.string.hiking_optional_section), style = MaterialTheme.typography.titleSmall, color = PandaAmber)

            // FC + RPE
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = uiState.hrAvg,
                    onValueChange = { viewModel.update { copy(hrAvg = it) } },
                    label = { Text(stringResource(R.string.hiking_field_hr)) },
                    modifier = Modifier.weight(1f),
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                )
                OutlinedTextField(
                    value = uiState.rpe,
                    onValueChange = { viewModel.update { copy(rpe = it) } },
                    label = { Text(stringResource(R.string.hiking_field_rpe)) },
                    modifier = Modifier.weight(1f),
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                )
            }

            // Notes
            OutlinedTextField(
                value = uiState.notes,
                onValueChange = { viewModel.update { copy(notes = it) } },
                label = { Text(stringResource(R.string.hiking_field_notes)) },
                modifier = Modifier.fillMaxWidth().height(100.dp),
                maxLines = 4,
            )

            uiState.error?.let {
                Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
            }

            Spacer(Modifier.height(8.dp))

            Button(
                onClick = viewModel::save,
                enabled = !uiState.isSaving,
                modifier = Modifier.fillMaxWidth().height(52.dp),
                colors = ButtonDefaults.buttonColors(containerColor = PandaAmber),
            ) {
                if (uiState.isSaving) {
                    CircularProgressIndicator(modifier = Modifier.size(20.dp), color = Color.White, strokeWidth = 2.dp)
                } else {
                    Text(stringResource(R.string.hiking_save_button), color = Color.White)
                }
            }
        }
    }
}
