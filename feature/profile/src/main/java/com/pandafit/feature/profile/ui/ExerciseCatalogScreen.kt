package com.pandafit.feature.profile.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Tune
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.pandafit.core.database.catalog.EquipmentCategory
import com.pandafit.core.database.catalog.MuscleGroup
import com.pandafit.core.database.catalog.muscleToGroup
import com.pandafit.core.database.entities.effectivePrimary
import com.pandafit.core.database.entities.ExerciseEntity
import com.pandafit.designsystem.components.PandaTopBar
import com.pandafit.designsystem.theme.PandaGreen
import com.pandafit.designsystem.theme.PandaSubtext
import com.pandafit.feature.profile.viewmodel.CreateDialogState
import com.pandafit.feature.profile.viewmodel.ExerciseCatalogViewModel
import com.pandafit.feature.profile.viewmodel.ExerciseListState

@OptIn(ExperimentalLayoutApi::class, ExperimentalMaterial3Api::class)
@Composable
fun ExerciseCatalogScreen(
    onNavigateBack: () -> Unit,
    viewModel: ExerciseCatalogViewModel = hiltViewModel(),
) {
    val listState by viewModel.listState.collectAsStateWithLifecycle()
    val dialogState by viewModel.dialogState.collectAsStateWithLifecycle()

    if (dialogState.visible) {
        CreateExerciseDialog(
            state = dialogState,
            onNameChange = viewModel::setNewName,
            onMuscleToggle = viewModel::toggleNewMuscle,
            onEquipmentToggle = viewModel::toggleNewEquipment,
            onConfirm = viewModel::createCustomExercise,
            onDismiss = viewModel::closeCreate,
        )
    }

    Scaffold(
        topBar = { PandaTopBar(title = "Catalogue d'exercices", onNavigateBack = onNavigateBack) },
        containerColor = MaterialTheme.colorScheme.background,
        floatingActionButton = {
            FloatingActionButton(onClick = viewModel::openCreate, containerColor = PandaGreen) {
                Icon(Icons.Default.Add, "Ajouter", tint = Color.White)
            }
        },
    ) { innerPadding ->
        Column(modifier = Modifier.fillMaxSize().padding(innerPadding)) {
            ExerciseFilters(
                listState = listState,
                onQueryChange = viewModel::setQuery,
                onGroupChange = viewModel::setGroup,
                onToggleAvailable = viewModel::toggleOnlyAvailable,
            )
            HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp))
            ExerciseGroupedList(
                listState = listState,
                onDelete = { viewModel.deleteCustomExercise(it) },
            )
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun ExerciseFilters(
    listState: ExerciseListState,
    onQueryChange: (String) -> Unit,
    onGroupChange: (MuscleGroup?) -> Unit,
    onToggleAvailable: () -> Unit,
) {
    Column {
        OutlinedTextField(
            value = listState.query,
            onValueChange = onQueryChange,
            placeholder = { Text("Rechercher un exercice…") },
            leadingIcon = { Icon(Icons.Default.Search, null) },
            singleLine = true,
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
        )
        Row(
            modifier = Modifier.padding(horizontal = 16.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            FilterChip(
                selected = listState.onlyAvailable,
                onClick = onToggleAvailable,
                label = { Text("Mon matériel") },
                leadingIcon = { Icon(Icons.Default.Tune, null, Modifier.size(16.dp)) },
            )
            Spacer(Modifier.width(8.dp))
            Text(
                "${listState.exercises.size} exercice${if (listState.exercises.size > 1) "s" else ""}",
                style = MaterialTheme.typography.labelSmall,
                color = PandaSubtext,
            )
        }
        FlowRow(
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            FilterChip(
                selected = listState.selectedGroup == null,
                onClick = { onGroupChange(null) },
                label = { Text("Tous") },
                colors = FilterChipDefaults.filterChipColors(
                    selectedContainerColor = PandaGreen.copy(alpha = 0.15f),
                    selectedLabelColor = PandaGreen,
                ),
            )
            MuscleGroup.entries.filter { it != MuscleGroup.AUTRE }.forEach { group ->
                FilterChip(
                    selected = listState.selectedGroup == group,
                    onClick = { onGroupChange(if (listState.selectedGroup == group) null else group) },
                    label = { Text(group.label) },
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = Color(group.colorArgb).copy(alpha = 0.2f),
                        selectedLabelColor = Color(group.colorArgb),
                    ),
                )
            }
        }
    }
}

@Composable
private fun ExerciseGroupedList(
    listState: ExerciseListState,
    onDelete: (ExerciseEntity) -> Unit,
) {
    if (listState.exercises.isEmpty()) {
        Box(
            modifier = Modifier.fillMaxSize().padding(32.dp),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                if (listState.query.isNotBlank() || listState.selectedGroup != null || listState.onlyAvailable)
                    "Aucun exercice pour ces filtres."
                else
                    "Chargement du catalogue…",
                style = MaterialTheme.typography.bodyMedium,
                color = PandaSubtext,
            )
        }
        return
    }

    LazyColumn(contentPadding = PaddingValues(start = 16.dp, top = 8.dp, end = 16.dp, bottom = 80.dp)) {
        if (listState.selectedGroup != null) {
            // Filtre actif : liste plate, muscles principaux du groupe sélectionné d'abord
            items(listState.exercises, key = { it.id }) { exercise ->
                ExerciseCatalogRow(
                    exercise = exercise,
                    onDelete = if (exercise.isCustom) ({ onDelete(exercise) }) else null,
                )
                HorizontalDivider(modifier = Modifier.padding(start = 8.dp))
            }
        } else {
            // Sans filtre : sections par muscle PRINCIPAL uniquement
            val grouped = listState.exercises.groupBy { muscleToGroup(it.effectivePrimary) }
            val presentGroups = MuscleGroup.entries.filter { grouped.containsKey(it) }
            presentGroups.forEach { group ->
                item(key = "h_${group.name}") {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.padding(top = 14.dp, bottom = 4.dp),
                    ) {
                        Box(
                            modifier = Modifier.size(10.dp).clip(CircleShape)
                                .background(Color(group.colorArgb)),
                        )
                        Spacer(Modifier.width(8.dp))
                        Text(
                            group.label,
                            style = MaterialTheme.typography.labelMedium,
                            fontWeight = FontWeight.SemiBold,
                            color = Color(group.colorArgb),
                        )
                        Spacer(Modifier.width(6.dp))
                        Text(
                            "(${grouped[group]?.size ?: 0})",
                            style = MaterialTheme.typography.labelSmall,
                            color = PandaSubtext,
                        )
                    }
                }
                items(grouped[group] ?: emptyList(), key = { it.id }) { exercise ->
                    ExerciseCatalogRow(
                        exercise = exercise,
                        onDelete = if (exercise.isCustom) ({ onDelete(exercise) }) else null,
                    )
                    HorizontalDivider(modifier = Modifier.padding(start = 8.dp))
                }
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun CreateExerciseDialog(
    state: CreateDialogState,
    onNameChange: (String) -> Unit,
    onMuscleToggle: (MuscleGroup) -> Unit,
    onEquipmentToggle: (EquipmentCategory) -> Unit,
    onConfirm: () -> Unit,
    onDismiss: () -> Unit,
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Nouvel exercice personnalisé") },
        text = {
            Column(
                modifier = Modifier.verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                OutlinedTextField(
                    value = state.name,
                    onValueChange = onNameChange,
                    label = { Text("Nom de l'exercice *") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                Text(
                    "Muscles sollicités (dans l'ordre : principal en premier)",
                    style = MaterialTheme.typography.labelMedium,
                    color = PandaSubtext,
                )
                if (state.muscles.isNotEmpty()) {
                    FlowRow(
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                        verticalArrangement = Arrangement.spacedBy(4.dp),
                        modifier = Modifier.padding(bottom = 2.dp),
                    ) {
                        state.muscles.forEachIndexed { index, group ->
                            FilterChip(
                                selected = true,
                                onClick = { onMuscleToggle(group) },
                                label = {
                                    Text(
                                        "${index + 1}. ${group.label}",
                                        style = MaterialTheme.typography.labelSmall,
                                    )
                                },
                                colors = FilterChipDefaults.filterChipColors(
                                    selectedContainerColor = Color(group.colorArgb).copy(alpha = 0.2f),
                                    selectedLabelColor = Color(group.colorArgb),
                                ),
                            )
                        }
                    }
                }
                FlowRow(
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    verticalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    MuscleGroup.entries.filter { it != MuscleGroup.AUTRE && it !in state.muscles }.forEach { group ->
                        FilterChip(
                            selected = false,
                            onClick = { onMuscleToggle(group) },
                            label = { Text(group.label, style = MaterialTheme.typography.labelSmall) },
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = Color(group.colorArgb).copy(alpha = 0.2f),
                                selectedLabelColor = Color(group.colorArgb),
                            ),
                        )
                    }
                }
                Text(
                    "Matériel nécessaire (optionnel)",
                    style = MaterialTheme.typography.labelMedium,
                    color = PandaSubtext,
                )
                FlowRow(
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    verticalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    EquipmentCategory.entries.forEach { cat ->
                        FilterChip(
                            selected = cat in state.equipment,
                            onClick = { onEquipmentToggle(cat) },
                            label = {
                                Text(
                                    "${cat.emoji} ${cat.label}",
                                    style = MaterialTheme.typography.labelSmall,
                                )
                            },
                        )
                    }
                }
            }
        },
        confirmButton = {
            TextButton(onClick = onConfirm, enabled = state.name.isNotBlank()) {
                Text("Créer", fontWeight = FontWeight.SemiBold)
            }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Annuler") } },
    )
}


@Composable
private fun ExerciseCatalogRow(
    exercise: ExerciseEntity,
    onDelete: (() -> Unit)?,
) {
    val primaryGroup = muscleToGroup(exercise.effectivePrimary)
    val nameColor = Color(primaryGroup.colorArgb)

    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                exercise.name,
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = if (exercise.isCustom) FontWeight.SemiBold else FontWeight.Normal,
                color = nameColor,
            )
            if (exercise.exerciseType.isNotBlank()) {
                Text(
                    exercise.exerciseType,
                    style = MaterialTheme.typography.labelSmall,
                    color = PandaSubtext,
                )
            }
        }
        if (onDelete != null) {
            IconButton(onClick = onDelete) {
                Icon(
                    Icons.Default.Delete,
                    "Supprimer",
                    tint = MaterialTheme.colorScheme.error,
                    modifier = Modifier.size(18.dp),
                )
            }
        }
    }
}
