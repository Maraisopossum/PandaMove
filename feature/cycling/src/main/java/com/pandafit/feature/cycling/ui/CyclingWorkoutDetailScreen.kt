package com.pandafit.feature.cycling.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Save
import androidx.compose.material3.BottomAppBar
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.rememberTopAppBarState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.pandafit.core.database.entities.BlockType
import com.pandafit.designsystem.components.PandaCard
import com.pandafit.designsystem.components.PandaTopBar
import com.pandafit.designsystem.theme.PandaBlue
import com.pandafit.designsystem.theme.PandaSubtext
import com.pandafit.feature.cycling.model.CyclingBlockDraft
import com.pandafit.feature.cycling.viewmodel.CyclingDetailViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CyclingWorkoutDetailScreen(
    workoutId: Long?,
    isPlanned: Boolean = false,
    onNavigateBack: () -> Unit,
    viewModel: CyclingDetailViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

    // Si création directe (one-shot), on bascule isTemplate=false dès le départ
    LaunchedEffect(isPlanned) {
        if (isPlanned && workoutId == null) viewModel.setAsPlanned()
    }
    val scrollBehavior = TopAppBarDefaults.pinnedScrollBehavior(rememberTopAppBarState())

    Scaffold(
        modifier = Modifier.nestedScroll(scrollBehavior.nestedScrollConnection),
        topBar = {
            PandaTopBar(
                title = if (uiState.isNew) "Nouvelle sortie" else "Modifier la sortie",
                onNavigateBack = onNavigateBack,
                scrollBehavior = scrollBehavior,
            )
        },
        bottomBar = {
            BottomAppBar(
                actions = {
                    IconButton(onClick = viewModel::addBlock) {
                        Icon(Icons.Default.Add, "Ajouter un bloc")
                    }
                    Text("Ajouter un bloc", style = MaterialTheme.typography.labelMedium, color = PandaSubtext)
                },
                floatingActionButton = {
                    FloatingActionButton(onClick = viewModel::save, containerColor = PandaBlue) {
                        Icon(Icons.Default.Save, "Sauvegarder", tint = MaterialTheme.colorScheme.onPrimary)
                    }
                },
            )
        },
        containerColor = MaterialTheme.colorScheme.background,
    ) { innerPadding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(innerPadding),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            item {
                PandaCard(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        OutlinedTextField(
                            value = uiState.name, onValueChange = viewModel::updateName,
                            label = { Text("Nom de la sortie") }, modifier = Modifier.fillMaxWidth(), singleLine = true,
                        )
                        OutlinedTextField(
                            value = uiState.objective, onValueChange = viewModel::updateObjective,
                            label = { Text("Objectif") }, modifier = Modifier.fillMaxWidth(), singleLine = true,
                        )
                        OutlinedTextField(
                            value = uiState.notes, onValueChange = viewModel::updateNotes,
                            label = { Text("Notes") }, modifier = Modifier.fillMaxWidth(), maxLines = 3,
                        )
                    }
                }
            }

            item {
                Text("Structure de la séance", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
            }

            itemsIndexed(uiState.blocks, key = { i, b -> "${b.blockType}_${b.id}_$i" }) { index, block ->
                CyclingBlockCard(
                    block = block,
                    onUpdate = { viewModel.updateBlock(index, it) },
                    onDuplicate = { viewModel.duplicateBlock(index) },
                    onDelete = { viewModel.removeBlock(index) },
                )
            }
            item { Spacer(Modifier.height(80.dp)) }
        }
    }
}

@Composable
private fun CyclingBlockCard(
    block: CyclingBlockDraft,
    onUpdate: (CyclingBlockDraft) -> Unit,
    onDuplicate: () -> Unit,
    onDelete: () -> Unit,
) {
    PandaCard(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(block.name, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold, color = PandaBlue)
                    Text(cyclingBlockTypeName(block.blockType), style = MaterialTheme.typography.labelSmall, color = PandaSubtext)
                }
                IconButton(onClick = onDuplicate) { Icon(Icons.Default.ContentCopy, "Dupliquer") }
                IconButton(onClick = onDelete) { Icon(Icons.Default.Delete, "Supprimer") }
            }
            Spacer(Modifier.height(12.dp))
            OutlinedTextField(
                value = block.name, onValueChange = { onUpdate(block.copy(name = it)) },
                label = { Text("Nom du bloc") }, modifier = Modifier.fillMaxWidth(), singleLine = true,
            )
            Spacer(Modifier.height(8.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = block.durationMinutes?.toString() ?: "",
                    onValueChange = { onUpdate(block.copy(durationMinutes = it.toIntOrNull())) },
                    label = { Text("Durée (min)") }, modifier = Modifier.weight(1f),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number), singleLine = true,
                )
                OutlinedTextField(
                    value = block.distanceKm?.toString() ?: "",
                    onValueChange = { onUpdate(block.copy(distanceKm = it.toDoubleOrNull())) },
                    label = { Text("Distance (km)") }, modifier = Modifier.weight(1f),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal), singleLine = true,
                )
            }
            Spacer(Modifier.height(8.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = block.targetPowerWatts?.toString() ?: "",
                    onValueChange = { onUpdate(block.copy(targetPowerWatts = it.toIntOrNull())) },
                    label = { Text("Puissance (W)") }, modifier = Modifier.weight(1f),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number), singleLine = true,
                )
                OutlinedTextField(
                    value = block.targetCadenceRpm?.toString() ?: "",
                    onValueChange = { onUpdate(block.copy(targetCadenceRpm = it.toIntOrNull())) },
                    label = { Text("Cadence (rpm)") }, modifier = Modifier.weight(1f),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number), singleLine = true,
                )
            }
            Spacer(Modifier.height(8.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = block.targetHeartRateBpm?.toString() ?: "",
                    onValueChange = { onUpdate(block.copy(targetHeartRateBpm = it.toIntOrNull())) },
                    label = { Text("FC cible (bpm)") }, modifier = Modifier.weight(1f),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number), singleLine = true,
                )
                OutlinedTextField(
                    value = block.rpeTarget?.toString() ?: "",
                    onValueChange = { onUpdate(block.copy(rpeTarget = it.toIntOrNull()?.coerceIn(1, 10))) },
                    label = { Text("RPE (1-10)") }, modifier = Modifier.weight(1f),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number), singleLine = true,
                )
            }
            if (block.blockType == BlockType.INTERVAL || block.blockType == BlockType.MAIN) {
                Spacer(Modifier.height(8.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(
                        value = block.repetitions?.toString() ?: "",
                        onValueChange = { onUpdate(block.copy(repetitions = it.toIntOrNull())) },
                        label = { Text("Répétitions") }, modifier = Modifier.weight(1f),
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number), singleLine = true,
                    )
                    OutlinedTextField(
                        value = block.recoveryMinutes?.toString() ?: "",
                        onValueChange = { onUpdate(block.copy(recoveryMinutes = it.toIntOrNull())) },
                        label = { Text("Récup. (min)") }, modifier = Modifier.weight(1f),
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number), singleLine = true,
                    )
                }
            }
        }
    }
}

private fun cyclingBlockTypeName(type: BlockType) = when (type) {
    BlockType.WARMUP -> "Échauffement"
    BlockType.MAIN -> "Bloc principal"
    BlockType.INTERVAL -> "Fractionné"
    BlockType.COOLDOWN -> "Retour au calme"
    BlockType.CUSTOM -> "Bloc personnalisé"
}
