package com.pandafit.feature.strength.ui

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.expandVertically
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.ExpandLess
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material.icons.filled.FitnessCenter
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.KeyboardArrowUp
import androidx.compose.material.icons.filled.Remove
import androidx.compose.material.icons.filled.Save
import androidx.compose.material.icons.filled.SelfImprovement
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.BottomAppBar
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.FloatingActionButtonDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Button
import androidx.compose.material3.Checkbox
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.material3.rememberTopAppBarState
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.pandafit.core.database.catalog.MuscleGroup
import com.pandafit.core.database.catalog.muscleToGroup
import com.pandafit.core.database.entities.effectivePrimary
import com.pandafit.core.database.entities.BlocType
import com.pandafit.core.database.entities.ExerciseEntity
import com.pandafit.core.database.entities.RepsType
import com.pandafit.core.database.entities.SeanceEntity
import com.pandafit.designsystem.components.PandaCard
import com.pandafit.designsystem.components.PandaTopBar
import com.pandafit.designsystem.theme.PandaOrange
import com.pandafit.designsystem.theme.PandaPurple
import com.pandafit.designsystem.theme.PandaSubtext
import com.pandafit.feature.strength.model.BlocDraft
import com.pandafit.feature.strength.model.ExerciceDraft
import com.pandafit.feature.strength.model.SeanceItem
import com.pandafit.feature.strength.viewmodel.SeanceCreateViewModel
import com.pandafit.feature.strength.viewmodel.defaultName
import com.pandafit.feature.strength.viewmodel.displayName

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SeanceCreateScreen(
    seanceId: Long?,
    onNavigateBack: () -> Unit,
    onSaved: (Long) -> Unit,
    seanceCategoryOverride: String? = null,
    instanceId: Long? = null,
    viewModel: SeanceCreateViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val isInstanceEdit = viewModel.isInstanceEdit
    val scrollBehavior = TopAppBarDefaults.pinnedScrollBehavior(rememberTopAppBarState())
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    LaunchedEffect(seanceCategoryOverride) {
        if (seanceCategoryOverride != null) {
            try {
                viewModel.updateSeanceCategory(com.pandafit.core.database.entities.SeanceCategory.valueOf(seanceCategoryOverride))
            } catch (_: IllegalArgumentException) {}
        }
    }

    LaunchedEffect(uiState.savedSeanceId) {
        uiState.savedSeanceId?.let { onSaved(it) }
    }

    if (uiState.showWarmupPicker) {
        ModalBottomSheet(onDismissRequest = viewModel::hideWarmupPicker, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)) {
            WarmupPickerSheet(
                warmups = uiState.availableWarmups,
                onSelect = { viewModel.addWarmupToSeance(it.id) },
                onDismiss = viewModel::hideWarmupPicker,
            )
        }
    }

    if (uiState.showExercisePicker) {
        ModalBottomSheet(onDismissRequest = viewModel::hideExercisePicker, sheetState = sheetState) {
            ExercicePickerSheet(
                exercises = viewModel.filteredPickerExercises(),
                query = uiState.exercisePickerQuery,
                onQueryChange = viewModel::updatePickerQuery,
                selectedGroup = uiState.pickerGroupFilter,
                onGroupChange = viewModel::setPickerGroupFilter,
                onlyAvailable = uiState.pickerOnlyAvailable,
                onToggleOnlyAvailable = viewModel::togglePickerOnlyAvailable,
                multiSelectedIds = uiState.multiSelectedIds,
                onToggleMultiSelect = { viewModel.toggleExerciseMultiSelect(it.id) },
                onConfirm = viewModel::confirmMultiSelection,
                onDismiss = viewModel::hideExercisePicker,
            )
        }
    }

    Scaffold(
        modifier = Modifier.nestedScroll(scrollBehavior.nestedScrollConnection),
        topBar = {
            PandaTopBar(
                title = when {
                    isInstanceEdit -> "Modifier la séance"
                    uiState.isNew -> "Nouvelle séance"
                    else -> "Modifier"
                },
                onNavigateBack = onNavigateBack,
                scrollBehavior = scrollBehavior,
            )
        },
        bottomBar = {
            BottomAppBar(
                floatingActionButton = {
                    FloatingActionButton(
                        onClick = viewModel::save,
                        containerColor = PandaPurple,
                        contentColor = MaterialTheme.colorScheme.onPrimary,
                        elevation = FloatingActionButtonDefaults.bottomAppBarFabElevation(),
                    ) { Icon(Icons.Default.Save, "Sauvegarder") }
                },
                actions = {},
            )
        },
        containerColor = MaterialTheme.colorScheme.background,
    ) { innerPadding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(innerPadding),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            // Infos générales
            item {
                PandaCard(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        OutlinedTextField(
                            value = uiState.nom,
                            onValueChange = viewModel::updateNom,
                            label = { Text("Nom de la séance") },
                            modifier = Modifier.fillMaxWidth(),
                            singleLine = true,
                            placeholder = { Text("Ex. Séance A — Jambes") },
                        )
                        OutlinedTextField(
                            value = uiState.notes,
                            onValueChange = viewModel::updateNotes,
                            label = { Text("Notes") },
                            modifier = Modifier.fillMaxWidth(),
                            maxLines = 3,
                        )
                    }
                }
            }

            // Bouton d'ajout d'échauffement (template uniquement, pas en mode instance)
            // TODO: masqué temporairement — à réactiver quand la section Échauffement sera prête
//            if (!isInstanceEdit) {
//                item {
//                    TextButton(
//                        onClick = { viewModel.showWarmupPicker() },
//                        modifier = Modifier.fillMaxWidth(),
//                    ) {
//                        Icon(Icons.Default.SelfImprovement, null, modifier = Modifier.size(16.dp), tint = PandaOrange)
//                        Spacer(Modifier.width(6.dp))
//                        Text("Ajouter un échauffement", color = PandaOrange)
//                    }
//                }
//            }

            // Liste unifiée d'items (exercices libres + blocs dans l'ordre)
            itemsIndexed(uiState.items, key = { i, item ->
                when (item) {
                    is SeanceItem.FreeExercise -> "free_${item.exercice.id}_$i"
                    is SeanceItem.Bloc -> "bloc_${item.bloc.id}_$i"
                }
            }) { index, item ->
                when (item) {
                    is SeanceItem.FreeExercise -> FreeExerciceCard(
                        exercice = item.exercice,
                        index = index,
                        totalItems = uiState.items.size,
                        onUpdate = { viewModel.updateFreeExercice(index, it) },
                        onDelete = { viewModel.removeItem(index) },
                        onMoveUp = { viewModel.moveItemUp(index) },
                        onMoveDown = { viewModel.moveItemDown(index) },
                    )
                    is SeanceItem.Bloc -> BlocCard(
                        bloc = item.bloc,
                        index = index,
                        totalItems = uiState.items.size,
                        onUpdate = { viewModel.updateItem(index, SeanceItem.Bloc(it)) },
                        onDelete = { viewModel.removeItem(index) },
                        onMoveUp = { viewModel.moveItemUp(index) },
                        onMoveDown = { viewModel.moveItemDown(index) },
                        onAddExercice = { viewModel.showExercisePicker(index) },
                        onUpdateExercice = { eIdx, ex -> viewModel.updateExerciceInBloc(index, eIdx, ex) },
                        onRemoveExercice = { eIdx -> viewModel.removeExerciceFromBloc(index, eIdx) },
                        onMoveExerciceUp = { eIdx -> viewModel.moveExerciceInBloc(index, eIdx, -1) },
                        onMoveExerciceDown = { eIdx -> viewModel.moveExerciceInBloc(index, eIdx, +1) },
                    )
                }
            }

            // Boutons d'ajout
            item {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                    TextButton(
                        onClick = viewModel::showExercisePickerFree,
                        modifier = Modifier.weight(1f),
                    ) {
                        Icon(Icons.Default.Add, null, modifier = Modifier.size(16.dp), tint = PandaPurple)
                        Text("  Exercice", color = PandaPurple)
                    }
                    AddBlocRow(onAdd = { type -> viewModel.addBloc(type) }, modifier = Modifier.weight(1f))
                }
            }

            item { Spacer(Modifier.height(80.dp)) }
        }
    }
}

// ===== Carte d'exercice libre =====

@Composable
private fun FreeExerciceCard(
    exercice: ExerciceDraft,
    index: Int,
    totalItems: Int,
    onUpdate: (ExerciceDraft) -> Unit,
    onDelete: () -> Unit,
    onMoveUp: () -> Unit,
    onMoveDown: () -> Unit,
) {
    Card(
        modifier = Modifier.fillMaxWidth().padding(vertical = 2.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(1.dp),
    ) {
        Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Default.FitnessCenter, null, tint = PandaPurple, modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(6.dp))
                Text(exercice.exercise.name, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
                if (index > 0) {
                    IconButton(onClick = onMoveUp, modifier = Modifier.size(28.dp)) {
                        Icon(Icons.Default.KeyboardArrowUp, "Monter", modifier = Modifier.size(18.dp))
                    }
                }
                if (index < totalItems - 1) {
                    IconButton(onClick = onMoveDown, modifier = Modifier.size(28.dp)) {
                        Icon(Icons.Default.KeyboardArrowDown, "Descendre", modifier = Modifier.size(18.dp))
                    }
                }
                IconButton(onClick = onDelete, modifier = Modifier.size(32.dp)) {
                    Icon(Icons.Default.Delete, "Supprimer", modifier = Modifier.size(16.dp), tint = MaterialTheme.colorScheme.error)
                }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                IntStepperField(
                    label = "Séries",
                    value = exercice.nombreSeriesPrevues,
                    onValueChange = { onUpdate(exercice.copy(nombreSeriesPrevues = it)) },
                    min = 1,
                    modifier = Modifier.weight(1f),
                )
                IntStepperField(
                    label = "Repos (s)",
                    value = exercice.tempsReposSec,
                    onValueChange = { onUpdate(exercice.copy(tempsReposSec = it)) },
                    min = 0, step = 15,
                    modifier = Modifier.weight(1f),
                )
            }
            ExerciceFields(exercice = exercice, onUpdate = onUpdate)
        }
    }
}

// ===== Carte de bloc =====

@Composable
private fun BlocCard(
    bloc: BlocDraft,
    index: Int,
    totalItems: Int,
    onUpdate: (BlocDraft) -> Unit,
    onDelete: () -> Unit,
    onMoveUp: () -> Unit,
    onMoveDown: () -> Unit,
    onAddExercice: () -> Unit,
    onUpdateExercice: (Int, ExerciceDraft) -> Unit,
    onRemoveExercice: (Int) -> Unit,
    onMoveExerciceUp: (Int) -> Unit = {},
    onMoveExerciceDown: (Int) -> Unit = {},
) {
    var expanded by remember { mutableStateOf(true) }
    val accentColor = blocColor(bloc.type)

    Column(modifier = Modifier.fillMaxWidth()) {
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = accentColor.copy(alpha = 0.08f)),
            shape = MaterialTheme.shapes.medium,
        ) {
            Column(modifier = Modifier.padding(12.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(modifier = Modifier.width(3.dp).height(24.dp).background(accentColor))
                    Spacer(Modifier.width(8.dp))
                    OutlinedTextField(
                        value = bloc.nom,
                        onValueChange = { onUpdate(bloc.copy(nom = it)) },
                        modifier = Modifier.weight(1f),
                        singleLine = true,
                        textStyle = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.SemiBold),
                        placeholder = { Text(bloc.type.defaultName()) },
                        label = { Text(bloc.type.displayName()) },
                    )
                    if (index > 0) {
                        IconButton(onClick = onMoveUp, modifier = Modifier.size(28.dp)) {
                            Icon(Icons.Default.KeyboardArrowUp, "Monter", modifier = Modifier.size(18.dp))
                        }
                    }
                    if (index < totalItems - 1) {
                        IconButton(onClick = onMoveDown, modifier = Modifier.size(28.dp)) {
                            Icon(Icons.Default.KeyboardArrowDown, "Descendre", modifier = Modifier.size(18.dp))
                        }
                    }
                    IconButton(onClick = { expanded = !expanded }) {
                        Icon(if (expanded) Icons.Default.ExpandLess else Icons.Default.ExpandMore, "Toggle")
                    }
                    IconButton(onClick = onDelete) {
                        Icon(Icons.Default.Delete, "Supprimer", modifier = Modifier.size(18.dp), tint = MaterialTheme.colorScheme.error)
                    }
                }

                if (bloc.type == BlocType.SUPERSET || bloc.type == BlocType.CIRCUIT) {
                    Spacer(Modifier.height(8.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        NumberStepper(
                            label = "Repos inter (s)",
                            value = bloc.tempsReposInterSec,
                            onValueChange = { onUpdate(bloc.copy(tempsReposInterSec = it)) },
                            min = 0, step = 5,
                            modifier = Modifier.weight(1f),
                        )
                        NumberStepper(
                            label = "Repos fin round (s)",
                            value = bloc.tempsReposFinRoundSec,
                            onValueChange = { onUpdate(bloc.copy(tempsReposFinRoundSec = it)) },
                            min = 0, step = 15,
                            modifier = Modifier.weight(1f),
                        )
                    }
                }
                // CIRCUIT uniquement : nombre de séries centralisé (propagé à tous les exercices à la sauvegarde)
                if (bloc.type == BlocType.CIRCUIT) {
                    Spacer(Modifier.height(8.dp))
                    NumberStepper(
                        label = "Séries (circuit)",
                        value = bloc.nombreSeriesPrevues,
                        onValueChange = { onUpdate(bloc.copy(nombreSeriesPrevues = it)) },
                        min = 1, step = 1,
                        modifier = Modifier.fillMaxWidth(),
                    )
                }
            }
        }

        AnimatedVisibility(visible = expanded, enter = expandVertically(), exit = shrinkVertically()) {
            Column(modifier = Modifier.fillMaxWidth()) {
                bloc.exercices.forEachIndexed { eIdx, exercice ->
                    ExerciceCard(
                        exercice = exercice,
                        blocType = bloc.type,
                        onUpdate = { onUpdateExercice(eIdx, it) },
                        onDelete = { onRemoveExercice(eIdx) },
                        canMoveUp = eIdx > 0,
                        canMoveDown = eIdx < bloc.exercices.size - 1,
                        onMoveUp = { onMoveExerciceUp(eIdx) },
                        onMoveDown = { onMoveExerciceDown(eIdx) },
                    )
                }
                TextButton(onClick = onAddExercice, modifier = Modifier.fillMaxWidth().padding(horizontal = 4.dp)) {
                    Icon(Icons.Default.Add, null, modifier = Modifier.size(16.dp), tint = accentColor)
                    Text("  Ajouter un exercice", color = accentColor)
                }
            }
        }
    }
}

// ===== Carte d'exercice dans un bloc =====

@Composable
private fun ExerciceCard(
    exercice: ExerciceDraft,
    blocType: BlocType?,
    onUpdate: (ExerciceDraft) -> Unit,
    onDelete: () -> Unit,
    canMoveUp: Boolean = false,
    canMoveDown: Boolean = false,
    onMoveUp: () -> Unit = {},
    onMoveDown: () -> Unit = {},
) {
    val showRepos = blocType == null || blocType == BlocType.ECHAUFFEMENT || blocType == BlocType.ACTIVATION || blocType == BlocType.RECUPERATION
    // Pour les circuits, le nombre de séries est centralisé dans l'en-tête du bloc — on le masque ici
    val showSeries = blocType != BlocType.CIRCUIT

    Card(
        modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp, horizontal = 4.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(1.dp),
    ) {
        Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Default.FitnessCenter, null, tint = PandaPurple, modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(6.dp))
                Text(exercice.exercise.name, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
                if (canMoveUp) {
                    IconButton(onClick = onMoveUp, modifier = Modifier.size(28.dp)) {
                        Icon(Icons.Default.KeyboardArrowUp, "Monter", modifier = Modifier.size(18.dp))
                    }
                }
                if (canMoveDown) {
                    IconButton(onClick = onMoveDown, modifier = Modifier.size(28.dp)) {
                        Icon(Icons.Default.KeyboardArrowDown, "Descendre", modifier = Modifier.size(18.dp))
                    }
                }
                IconButton(onClick = onDelete, modifier = Modifier.size(32.dp)) {
                    Icon(Icons.Default.Delete, "Supprimer", modifier = Modifier.size(16.dp), tint = MaterialTheme.colorScheme.error)
                }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                if (showSeries) {
                    IntStepperField(
                        label = "Séries",
                        value = exercice.nombreSeriesPrevues,
                        onValueChange = { onUpdate(exercice.copy(nombreSeriesPrevues = it)) },
                        min = 1,
                        modifier = Modifier.weight(1f),
                    )
                }
                if (showRepos) {
                    IntStepperField(
                        label = "Repos (s)",
                        value = exercice.tempsReposSec,
                        onValueChange = { onUpdate(exercice.copy(tempsReposSec = it)) },
                        min = 0, step = 15,
                        modifier = Modifier.weight(1f),
                    )
                }
            }
            ExerciceFields(exercice = exercice, onUpdate = onUpdate, blocType = blocType)
        }
    }
}

// ===== Champs communs exercice =====

@Composable
private fun ExerciceFields(
    exercice: ExerciceDraft,
    onUpdate: (ExerciceDraft) -> Unit,
    blocType: BlocType? = null,
) {
    val labelStyle = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Normal)
    val labelWidth = Modifier.width(112.dp)
    val isCircuit = blocType == BlocType.CIRCUIT

    // Reps/Durée toggle
    if (isCircuit) {
        // Bloc CIRCUIT : sélecteur verrouillé sur DURATION
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            FilterChip(
                selected = false,
                onClick = {},
                enabled = false,
                label = { Text("Reps") },
                modifier = Modifier.weight(1f),
            )
            FilterChip(
                selected = true,
                onClick = {},
                label = { Text("Durée") },
                modifier = Modifier.weight(1f),
            )
        }
        Text(
            "Circuit — durée obligatoire",
            style = MaterialTheme.typography.labelSmall,
            color = PandaSubtext,
        )
    } else {
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            FilterChip(
                selected = exercice.repsType == RepsType.REPS,
                onClick = { onUpdate(exercice.copy(repsType = RepsType.REPS)) },
                label = { Text("Reps") },
                modifier = Modifier.weight(1f),
            )
            FilterChip(
                selected = exercice.repsType == RepsType.DURATION,
                onClick = { onUpdate(exercice.copy(repsType = RepsType.DURATION)) },
                label = { Text("Durée") },
                modifier = Modifier.weight(1f),
            )
        }
    }

    // Reps or Duration field
    if (exercice.repsType == RepsType.REPS) {
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
            Text("Reps :", style = labelStyle, modifier = labelWidth)
            OutlinedTextField(
                value = exercice.repsCibles,
                onValueChange = { onUpdate(exercice.copy(repsCibles = it)) },
                modifier = Modifier.weight(1f), singleLine = true, textStyle = MaterialTheme.typography.bodySmall,
            )
        }
    } else {
        val totalSecs = exercice.repsCibles.toIntOrNull() ?: 0
        val isEmpty = exercice.repsCibles.isBlank() || totalSecs == 0
        var minStr by remember(exercice.repsCibles) { mutableStateOf(if (isEmpty) "" else (totalSecs / 60).toString()) }
        var secStr by remember(exercice.repsCibles) { mutableStateOf(if (isEmpty) "" else (totalSecs % 60).toString()) }
        fun commit() {
            if (minStr.isBlank() && secStr.isBlank()) { onUpdate(exercice.copy(repsCibles = "")); return }
            val s = (minStr.toIntOrNull() ?: 0) * 60 + (secStr.toIntOrNull() ?: 0)
            onUpdate(exercice.copy(repsCibles = if (s > 0) s.toString() else ""))
        }
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
            Text("Durée :", style = labelStyle, modifier = labelWidth)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.weight(1f)) {
                OutlinedTextField(
                    value = minStr,
                    onValueChange = { minStr = it.filter { c -> c.isDigit() }.take(2); commit() },
                    label = { Text("min") },
                    placeholder = { Text("0") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    modifier = Modifier.weight(1f),
                    singleLine = true,
                    textStyle = MaterialTheme.typography.bodySmall,
                )
                OutlinedTextField(
                    value = secStr,
                    onValueChange = { secStr = it.filter { c -> c.isDigit() }.take(2); commit() },
                    label = { Text("sec") },
                    placeholder = { Text("0") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    modifier = Modifier.weight(1f),
                    singleLine = true,
                    textStyle = MaterialTheme.typography.bodySmall,
                )
            }
        }
    }

    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
        Text("Charge :", style = labelStyle, modifier = labelWidth)
        OutlinedTextField(
            value = exercice.chargeCible,
            onValueChange = { onUpdate(exercice.copy(chargeCible = it)) },
            modifier = Modifier.weight(1f), singleLine = true, textStyle = MaterialTheme.typography.bodySmall,
        )
    }
    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
        Text("Commentaire :", style = labelStyle, modifier = labelWidth)
        OutlinedTextField(
            value = exercice.consigneCle,
            onValueChange = { onUpdate(exercice.copy(consigneCle = it)) },
            modifier = Modifier.weight(1f), singleLine = true, textStyle = MaterialTheme.typography.bodySmall,
        )
    }

    // Bilatéral — disponible pour REPS et DURATION, hors Circuit
    if (!isCircuit && (exercice.repsType == RepsType.REPS || exercice.repsType == RepsType.DURATION)) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.fillMaxWidth(),
        ) {
            Checkbox(
                checked = exercice.isBilateral,
                onCheckedChange = { onUpdate(exercice.copy(isBilateral = it)) },
            )
            Column {
                Text("Bilatéral (G + D)", style = MaterialTheme.typography.bodySmall, fontWeight = FontWeight.SemiBold)
                Text("À chaque round : côté G, puis côté D", style = MaterialTheme.typography.labelSmall, color = PandaSubtext)
            }
        }
    }
}

// ===== WarmupPickerSheet =====

@Composable
private fun WarmupPickerSheet(
    warmups: List<SeanceEntity>,
    onSelect: (SeanceEntity) -> Unit,
    onDismiss: () -> Unit,
) {
    Column(modifier = Modifier.fillMaxWidth().padding(16.dp)) {
        Text(
            "Choisir un échauffement",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier.padding(bottom = 12.dp),
        )
        if (warmups.isEmpty()) {
            Text("Aucun échauffement disponible.", style = MaterialTheme.typography.bodySmall, color = PandaSubtext)
        } else {
            warmups.forEach { warmup ->
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { onSelect(warmup) }
                        .padding(vertical = 12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    Icon(Icons.Default.SelfImprovement, null, tint = PandaOrange, modifier = Modifier.size(24.dp))
                    Column(modifier = Modifier.weight(1f)) {
                        Text(warmup.nom, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold)
                        if (warmup.notes.isNotBlank()) {
                            Text(warmup.notes, style = MaterialTheme.typography.bodySmall, color = PandaSubtext, maxLines = 1)
                        }
                    }
                }
                HorizontalDivider()
            }
        }
        Spacer(Modifier.height(32.dp))
    }
}

// ===== Composables utilitaires =====

@Composable
fun IntStepperField(
    label: String,
    value: Int,
    onValueChange: (Int) -> Unit,
    min: Int = 0,
    step: Int = 1,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier, horizontalAlignment = Alignment.CenterHorizontally) {
        Text(label, style = MaterialTheme.typography.labelSmall, color = PandaSubtext)
        Row(verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = { if (value - step >= min) onValueChange(value - step) }, modifier = Modifier.size(28.dp)) {
                Icon(Icons.Default.Remove, "-", modifier = Modifier.size(14.dp))
            }
            Text(value.toString(), style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(horizontal = 4.dp))
            IconButton(onClick = { onValueChange(value + step) }, modifier = Modifier.size(28.dp)) {
                Icon(Icons.Default.Add, "+", modifier = Modifier.size(14.dp))
            }
        }
    }
}

@Composable
fun NumberStepper(
    label: String,
    value: Int,
    onValueChange: (Int) -> Unit,
    min: Int = 0,
    step: Int = 1,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier) {
        Text(label, style = MaterialTheme.typography.labelSmall, color = PandaSubtext)
        Spacer(Modifier.height(4.dp))
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            IconButton(onClick = { if (value - step >= min) onValueChange(value - step) }, modifier = Modifier.size(32.dp)) {
                Icon(Icons.Default.Remove, "-", modifier = Modifier.size(14.dp))
            }
            Text("${value}s", style = MaterialTheme.typography.bodySmall, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
            IconButton(onClick = { onValueChange(value + step) }, modifier = Modifier.size(32.dp)) {
                Icon(Icons.Default.Add, "+", modifier = Modifier.size(14.dp))
            }
        }
    }
}

@Composable
private fun AddBlocRow(onAdd: (BlocType) -> Unit, modifier: Modifier = Modifier) {
    var expanded by remember { mutableStateOf(false) }
    Box(modifier = modifier) {
        TextButton(onClick = { expanded = true }, modifier = Modifier.fillMaxWidth()) {
            Icon(Icons.Default.Add, null, modifier = Modifier.size(16.dp), tint = PandaPurple)
            Text("  Bloc", color = PandaPurple)
        }
        DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            BlocType.entries.forEach { type ->
                DropdownMenuItem(text = { Text(type.displayName()) }, onClick = { onAdd(type); expanded = false })
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun ExercicePickerSheet(
    exercises: List<ExerciseEntity>,
    query: String,
    onQueryChange: (String) -> Unit,
    selectedGroup: MuscleGroup?,
    onGroupChange: (MuscleGroup?) -> Unit,
    onlyAvailable: Boolean,
    onToggleOnlyAvailable: () -> Unit,
    multiSelectedIds: Set<Long>,
    onToggleMultiSelect: (ExerciseEntity) -> Unit,
    onConfirm: () -> Unit,
    onDismiss: () -> Unit,
) {
    Column(modifier = Modifier.fillMaxWidth()) {
        // En-tête
        Column(modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    "Ajouter des exercices",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.weight(1f),
                )
                if (multiSelectedIds.isNotEmpty()) {
                    Button(
                        onClick = onConfirm,
                        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 6.dp),
                    ) { Text("Ajouter (${multiSelectedIds.size})") }
                }
            }
            Spacer(Modifier.height(10.dp))
            OutlinedTextField(
                value = query, onValueChange = onQueryChange,
                label = { Text("Rechercher") }, modifier = Modifier.fillMaxWidth(), singleLine = true,
            )
        }

        // Filtres matériel + groupes musculaires
        LazyRow(
            contentPadding = PaddingValues(horizontal = 16.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            item {
                FilterChip(
                    selected = onlyAvailable,
                    onClick = onToggleOnlyAvailable,
                    label = { Text("Mon matériel") },
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = PandaPurple.copy(alpha = 0.15f),
                        selectedLabelColor = PandaPurple,
                    ),
                )
            }
            item {
                FilterChip(
                    selected = selectedGroup == null,
                    onClick = { onGroupChange(null) },
                    label = { Text("Tous") },
                )
            }
            items(MuscleGroup.entries) { group ->
                FilterChip(
                    selected = selectedGroup == group,
                    onClick = { onGroupChange(if (selectedGroup == group) null else group) },
                    label = { Text(group.label) },
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = Color(group.colorArgb).copy(alpha = 0.2f),
                        selectedLabelColor = Color(group.colorArgb),
                    ),
                )
            }
        }

        HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp))

        if (exercises.isEmpty()) {
            Text(
                "Aucun exercice trouvé.",
                style = MaterialTheme.typography.bodySmall,
                color = PandaSubtext,
                modifier = Modifier.padding(16.dp),
            )
        } else {
            LazyColumn(modifier = Modifier.fillMaxWidth()) {
                items(exercises, key = { it.id }) { exercise ->
                    val isSelected = exercise.id in multiSelectedIds
                    val primaryGroup = muscleToGroup(exercise.effectivePrimary)
                    val groupColor = Color(primaryGroup.colorArgb)
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(if (isSelected) PandaPurple.copy(alpha = 0.06f) else Color.Transparent)
                            .padding(horizontal = 16.dp, vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Checkbox(
                            checked = isSelected,
                            onCheckedChange = { onToggleMultiSelect(exercise) },
                        )
                        Spacer(Modifier.width(8.dp))
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                exercise.name,
                                style = MaterialTheme.typography.bodyMedium,
                                color = groupColor,
                            )
                            if (exercise.effectivePrimary.isNotBlank()) {
                                Text(
                                    exercise.effectivePrimary,
                                    style = MaterialTheme.typography.labelSmall,
                                    color = PandaSubtext,
                                )
                            }
                        }
                    }
                    HorizontalDivider(modifier = Modifier.padding(horizontal = 16.dp))
                }
                item { Spacer(Modifier.height(32.dp)) }
            }
        }
    }
}

fun blocColor(type: BlocType) = when (type) {
    BlocType.ECHAUFFEMENT -> Color(0xFFFF8F00)
    BlocType.ACTIVATION -> Color(0xFF5E35B1)
    BlocType.SUPERSET -> Color(0xFFE65100)
    BlocType.CIRCUIT -> Color(0xFF00838F)
    BlocType.RECUPERATION -> Color(0xFF2E7D32)
}
