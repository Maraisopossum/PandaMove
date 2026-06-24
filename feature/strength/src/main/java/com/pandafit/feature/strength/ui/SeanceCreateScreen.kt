package com.pandafit.feature.strength.ui

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.expandVertically
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.shape.RoundedCornerShape
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
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.TrendingUp
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Bolt
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.ExpandLess
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material.icons.filled.FitnessCenter
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.KeyboardArrowUp
import androidx.compose.material.icons.filled.Remove
import androidx.compose.material.icons.filled.Save
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.SelfImprovement
import androidx.compose.material.icons.filled.Whatshot
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
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
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
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.pandafit.feature.strength.R
import com.pandafit.core.database.catalog.EquipmentInventaire
import com.pandafit.core.database.catalog.MuscleGroup
import com.pandafit.core.database.catalog.chargesAtteignablesPourEquipement
import com.pandafit.core.database.catalog.muscleToGroup
import com.pandafit.core.database.entities.effectivePrimary
import com.pandafit.core.database.entities.BlocType
import com.pandafit.core.database.entities.ExerciseEntity
import com.pandafit.core.database.entities.RepsType
import com.pandafit.core.database.entities.SeanceEntity
import com.pandafit.core.database.entities.SystemeProgression
import com.pandafit.core.database.entities.TypeExercice
import com.pandafit.designsystem.components.PandaCard
import com.pandafit.designsystem.components.PandaTopBar
import com.pandafit.designsystem.theme.PandaGreen
import com.pandafit.designsystem.theme.PandaOrange
import com.pandafit.designsystem.theme.PandaPurple
import com.pandafit.designsystem.theme.PandaSubtext
import com.pandafit.feature.strength.model.BlocDraft
import com.pandafit.feature.strength.model.ExerciceDraft
import com.pandafit.feature.strength.model.SeanceItem
import com.pandafit.feature.strength.model.formatRepsDisplay
import com.pandafit.feature.strength.model.parseChargeKg
import com.pandafit.feature.strength.model.parseChargeLabel
import com.pandafit.feature.strength.viewmodel.SeanceCreateViewModel

@Composable
private fun BlocType.displayNameRes() = when (this) {
    BlocType.ECHAUFFEMENT -> stringResource(R.string.bloc_type_echauffement)
    BlocType.ACTIVATION -> stringResource(R.string.bloc_type_activation)
    BlocType.SUPERSET -> stringResource(R.string.bloc_type_superset)
    BlocType.CIRCUIT -> stringResource(R.string.bloc_type_circuit)
    BlocType.RECUPERATION -> stringResource(R.string.bloc_type_recuperation)
}

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

    Scaffold(
        modifier = Modifier.nestedScroll(scrollBehavior.nestedScrollConnection),
        topBar = {
            PandaTopBar(
                title = when {
                    isInstanceEdit -> stringResource(R.string.seance_create_title_edit_instance)
                    uiState.isNew -> stringResource(R.string.seance_create_title_new)
                    else -> stringResource(R.string.seance_create_title_edit)
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
                    ) { Icon(Icons.Default.Save, stringResource(R.string.common_save_cd)) }
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
                            label = { Text(stringResource(R.string.common_seance_name_label)) },
                            modifier = Modifier.fillMaxWidth(),
                            singleLine = true,
                            placeholder = { Text(stringResource(R.string.seance_create_name_placeholder)) },
                        )
                        OutlinedTextField(
                            value = uiState.notes,
                            onValueChange = viewModel::updateNotes,
                            label = { Text(stringResource(R.string.common_notes_label)) },
                            modifier = Modifier.fillMaxWidth(),
                            maxLines = 3,
                        )
                    }
                }
            }

            // Barre de recherche / ajout rapide d'exercice (remplace le bouton "+ Exercice" en bas)
            item {
                QuickAddBar(onClick = viewModel::showExercisePickerFree)
            }

            if (uiState.showExercisePicker && uiState.pickerTargetItemIndex == -1) {
                item {
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
                        userInventaire = uiState.userInventaire,
                        onUpdate = { viewModel.updateFreeExercice(index, it) },
                        onDelete = { viewModel.removeItem(index) },
                        onDuplicate = { viewModel.duplicateFreeExercice(index) },
                        onMoveUp = { viewModel.moveItemUp(index) },
                        onMoveDown = { viewModel.moveItemDown(index) },
                    )
                    is SeanceItem.Bloc -> BlocCard(
                        bloc = item.bloc,
                        index = index,
                        totalItems = uiState.items.size,
                        userInventaire = uiState.userInventaire,
                        onUpdate = { viewModel.updateItem(index, SeanceItem.Bloc(it)) },
                        onDelete = { viewModel.removeItem(index) },
                        onMoveUp = { viewModel.moveItemUp(index) },
                        onMoveDown = { viewModel.moveItemDown(index) },
                        onAddExercice = { viewModel.showExercisePicker(index) },
                        onUpdateExercice = { eIdx, ex -> viewModel.updateExerciceInBloc(index, eIdx, ex) },
                        onRemoveExercice = { eIdx -> viewModel.removeExerciceFromBloc(index, eIdx) },
                        onDuplicateExercice = { eIdx -> viewModel.duplicateExerciceInBloc(index, eIdx) },
                        onMoveExerciceUp = { eIdx -> viewModel.moveExerciceInBloc(index, eIdx, -1) },
                        onMoveExerciceDown = { eIdx -> viewModel.moveExerciceInBloc(index, eIdx, +1) },
                        pickerContent = if (uiState.showExercisePicker && uiState.pickerTargetItemIndex == index) {
                            {
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
                        } else null,
                    )
                }
            }

            // Bouton d'ajout de bloc (l'ajout d'exercice libre se fait via la barre de recherche en haut)
            item {
                AddBlocRow(onAdd = { type -> viewModel.addBloc(type) }, modifier = Modifier.fillMaxWidth())
            }

            item { Spacer(Modifier.height(80.dp)) }
        }
    }
}

// ===== Barre de recherche / ajout rapide =====

@Composable
private fun QuickAddBar(onClick: () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        border = BorderStroke(1.5.dp, PandaPurple.copy(alpha = 0.4f)),
        shape = RoundedCornerShape(13.dp),
        elevation = CardDefaults.cardElevation(2.dp),
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 13.dp, vertical = 11.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(Icons.Default.Search, null, tint = PandaPurple, modifier = Modifier.size(18.dp))
            Spacer(Modifier.width(8.dp))
            Text(
                stringResource(R.string.seance_create_quickadd_placeholder),
                style = MaterialTheme.typography.bodyMedium,
                color = PandaSubtext,
                modifier = Modifier.weight(1f),
            )
            Text(
                stringResource(R.string.seance_create_quickadd_tag),
                style = MaterialTheme.typography.labelSmall,
                fontWeight = FontWeight.SemiBold,
                color = PandaPurple,
                modifier = Modifier
                    .background(PandaPurple.copy(alpha = 0.12f), RoundedCornerShape(7.dp))
                    .padding(horizontal = 7.dp, vertical = 3.dp),
            )
        }
    }
}

// ===== Badges =====

@Composable
private fun ProgressionBadge(modifier: Modifier = Modifier) {
    Text(
        stringResource(R.string.seance_detail_progression_badge),
        style = MaterialTheme.typography.labelSmall,
        fontWeight = FontWeight.Bold,
        color = PandaPurple,
        modifier = modifier
            .background(PandaPurple.copy(alpha = 0.12f), RoundedCornerShape(20.dp))
            .border(1.dp, PandaPurple.copy(alpha = 0.3f), RoundedCornerShape(20.dp))
            .padding(horizontal = 7.dp, vertical = 2.dp),
    )
}

@Composable
private fun BilateralBadge(modifier: Modifier = Modifier) {
    Text(
        stringResource(R.string.seance_create_badge_bilateral),
        style = MaterialTheme.typography.labelSmall,
        fontWeight = FontWeight.SemiBold,
        color = PandaOrange,
        modifier = modifier
            .background(PandaOrange.copy(alpha = 0.12f), RoundedCornerShape(20.dp))
            .padding(horizontal = 7.dp, vertical = 2.dp),
    )
}

/** Résumé en une ligne affiché carte repliée, ex. "3 × 8–12 · 20 kg". */
@Composable
private fun exerciceSummaryLine(exercice: ExerciceDraft): String {
    val sep = stringResource(R.string.seance_create_summary_separator)
    val reps = when {
        exercice.progressionActivee && exercice.systemeProgression == SystemeProgression.DOUBLE && exercice.repsMin != null && exercice.repsMax != null ->
            "${exercice.repsMin}–${exercice.repsMax}"
        else -> formatRepsDisplay(exercice.repsCibles, exercice.repsType)
    }
    val parts = mutableListOf("${exercice.nombreSeriesPrevues} × $reps")
    if (exercice.isBodyweight) {
        parts.add(stringResource(R.string.seance_create_progression_type_pdc_short))
    } else if (exercice.chargeCible.isNotBlank()) {
        parts.add(exercice.chargeCible)
    }
    return parts.joinToString(" $sep ")
}

// ===== Carte d'exercice libre =====

@Composable
private fun FreeExerciceCard(
    exercice: ExerciceDraft,
    index: Int,
    totalItems: Int,
    userInventaire: EquipmentInventaire,
    onUpdate: (ExerciceDraft) -> Unit,
    onDelete: () -> Unit,
    onDuplicate: () -> Unit,
    onMoveUp: () -> Unit,
    onMoveDown: () -> Unit,
) {
    var expanded by remember { mutableStateOf(false) }
    Card(
        modifier = Modifier.fillMaxWidth().padding(vertical = 2.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(1.dp),
    ) {
        Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            ExerciceCardHeader(
                exercice = exercice,
                expanded = expanded,
                onToggleExpanded = { expanded = !expanded },
            )
            AnimatedVisibility(visible = expanded, enter = expandVertically(), exit = shrinkVertically()) {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                        IntStepperField(
                            label = stringResource(R.string.seance_create_field_series),
                            value = exercice.nombreSeriesPrevues,
                            onValueChange = { onUpdate(exercice.copy(nombreSeriesPrevues = it)) },
                            min = 1,
                            modifier = Modifier.weight(1f),
                        )
                        IntStepperField(
                            label = stringResource(R.string.seance_create_field_rest),
                            value = exercice.tempsReposSec,
                            onValueChange = { onUpdate(exercice.copy(tempsReposSec = it)) },
                            min = 0, step = 15,
                            modifier = Modifier.weight(1f),
                        )
                    }
                    ExerciceFields(exercice = exercice, onUpdate = onUpdate, userInventaire = userInventaire)
                    ExerciceCardFooter(
                        onDuplicate = onDuplicate,
                        canMoveUp = index > 0,
                        canMoveDown = index < totalItems - 1,
                        onMoveUp = onMoveUp,
                        onMoveDown = onMoveDown,
                        onDelete = onDelete,
                    )
                }
            }
        }
    }
}

// ===== En-tête / pied de carte communs (repli/déplie) =====

@Composable
private fun ExerciceCardHeader(
    exercice: ExerciceDraft,
    expanded: Boolean,
    onToggleExpanded: () -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onToggleExpanded),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier = Modifier.size(30.dp).background(PandaPurple.copy(alpha = 0.12f), RoundedCornerShape(9.dp)),
            contentAlignment = Alignment.Center,
        ) {
            Icon(Icons.Default.FitnessCenter, null, tint = PandaPurple, modifier = Modifier.size(15.dp))
        }
        Spacer(Modifier.width(10.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(exercice.exercise.name, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                if (exercice.progressionActivee) ProgressionBadge()
                if (exercice.isBilateral) BilateralBadge()
                Text(exerciceSummaryLine(exercice), style = MaterialTheme.typography.labelSmall, color = PandaSubtext)
            }
        }
        Icon(
            if (expanded) Icons.Default.ExpandLess else Icons.Default.ExpandMore,
            stringResource(R.string.seance_create_expand_toggle_cd),
            tint = PandaSubtext,
        )
    }
}

@Composable
private fun ExerciceCardFooter(
    onDuplicate: () -> Unit,
    canMoveUp: Boolean,
    canMoveDown: Boolean,
    onMoveUp: () -> Unit,
    onMoveDown: () -> Unit,
    onDelete: () -> Unit,
) {
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
        OutlinedButton(onClick = onDuplicate, modifier = Modifier.weight(1f), contentPadding = PaddingValues(8.dp)) {
            Icon(Icons.Default.ContentCopy, null, modifier = Modifier.size(14.dp))
            Spacer(Modifier.width(4.dp))
            Text(stringResource(R.string.seance_create_duplicate_cd), style = MaterialTheme.typography.labelSmall)
        }
        Row(
            modifier = Modifier
                .weight(1f)
                .background(MaterialTheme.colorScheme.surfaceVariant, RoundedCornerShape(10.dp)),
            horizontalArrangement = Arrangement.Center,
        ) {
            IconButton(onClick = onMoveUp, enabled = canMoveUp, modifier = Modifier.size(36.dp)) {
                Icon(Icons.Default.KeyboardArrowUp, stringResource(R.string.seance_create_move_up_cd), modifier = Modifier.size(18.dp))
            }
            IconButton(onClick = onMoveDown, enabled = canMoveDown, modifier = Modifier.size(36.dp)) {
                Icon(Icons.Default.KeyboardArrowDown, stringResource(R.string.seance_create_move_down_cd), modifier = Modifier.size(18.dp))
            }
        }
        OutlinedButton(
            onClick = onDelete,
            modifier = Modifier.weight(1f),
            contentPadding = PaddingValues(8.dp),
            colors = ButtonDefaults.outlinedButtonColors(contentColor = MaterialTheme.colorScheme.error),
            border = BorderStroke(1.dp, MaterialTheme.colorScheme.error.copy(alpha = 0.4f)),
        ) {
            Icon(Icons.Default.Delete, null, modifier = Modifier.size(14.dp))
            Spacer(Modifier.width(4.dp))
            Text(stringResource(R.string.common_delete_cd), style = MaterialTheme.typography.labelSmall)
        }
    }
}

// ===== Carte de bloc =====

@Composable
private fun BlocCard(
    bloc: BlocDraft,
    index: Int,
    totalItems: Int,
    userInventaire: EquipmentInventaire,
    onUpdate: (BlocDraft) -> Unit,
    onDelete: () -> Unit,
    onMoveUp: () -> Unit,
    onMoveDown: () -> Unit,
    onAddExercice: () -> Unit,
    onUpdateExercice: (Int, ExerciceDraft) -> Unit,
    onRemoveExercice: (Int) -> Unit,
    onDuplicateExercice: (Int) -> Unit = {},
    onMoveExerciceUp: (Int) -> Unit = {},
    onMoveExerciceDown: (Int) -> Unit = {},
    pickerContent: (@Composable () -> Unit)? = null,
) {
    var expanded by remember { mutableStateOf(true) }
    val accentColor = blocColor(bloc.type)
    val blocDisplayName = bloc.type.displayNameRes()

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
                    Icon(blocTypeIcon(bloc.type), null, tint = accentColor, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.width(6.dp))
                    OutlinedTextField(
                        value = bloc.nom,
                        onValueChange = { onUpdate(bloc.copy(nom = it)) },
                        modifier = Modifier.weight(1f),
                        singleLine = true,
                        textStyle = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.SemiBold),
                        placeholder = { Text(blocDisplayName) },
                        label = { Text(blocDisplayName) },
                    )
                    if (index > 0) {
                        IconButton(onClick = onMoveUp, modifier = Modifier.size(28.dp)) {
                            Icon(Icons.Default.KeyboardArrowUp, stringResource(R.string.seance_create_move_up_cd), modifier = Modifier.size(18.dp))
                        }
                    }
                    if (index < totalItems - 1) {
                        IconButton(onClick = onMoveDown, modifier = Modifier.size(28.dp)) {
                            Icon(Icons.Default.KeyboardArrowDown, stringResource(R.string.seance_create_move_down_cd), modifier = Modifier.size(18.dp))
                        }
                    }
                    IconButton(onClick = { expanded = !expanded }) {
                        Icon(if (expanded) Icons.Default.ExpandLess else Icons.Default.ExpandMore, stringResource(R.string.seance_create_expand_toggle_cd))
                    }
                    IconButton(onClick = onDelete) {
                        Icon(Icons.Default.Delete, stringResource(R.string.common_delete_cd), modifier = Modifier.size(18.dp), tint = MaterialTheme.colorScheme.error)
                    }
                }

                if (bloc.type == BlocType.SUPERSET || bloc.type == BlocType.CIRCUIT) {
                    Spacer(Modifier.height(8.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        NumberStepper(
                            label = stringResource(R.string.seance_create_bloc_rest_inter_label),
                            value = bloc.tempsReposInterSec,
                            onValueChange = { onUpdate(bloc.copy(tempsReposInterSec = it)) },
                            min = 0, step = 5,
                            modifier = Modifier.weight(1f),
                        )
                        NumberStepper(
                            label = stringResource(R.string.seance_create_bloc_rest_end_round_label),
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
                        label = stringResource(R.string.seance_create_bloc_circuit_series_label),
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
                        userInventaire = userInventaire,
                        onUpdate = { onUpdateExercice(eIdx, it) },
                        onDelete = { onRemoveExercice(eIdx) },
                        onDuplicate = { onDuplicateExercice(eIdx) },
                        canMoveUp = eIdx > 0,
                        canMoveDown = eIdx < bloc.exercices.size - 1,
                        onMoveUp = { onMoveExerciceUp(eIdx) },
                        onMoveDown = { onMoveExerciceDown(eIdx) },
                    )
                }
                TextButton(onClick = onAddExercice, modifier = Modifier.fillMaxWidth().padding(horizontal = 4.dp)) {
                    Icon(Icons.Default.Add, null, modifier = Modifier.size(16.dp), tint = accentColor)
                    Text(stringResource(R.string.seance_create_bloc_add_exercice_button), color = accentColor)
                }
                if (pickerContent != null) {
                    Spacer(Modifier.height(4.dp))
                    pickerContent()
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
    userInventaire: EquipmentInventaire,
    onUpdate: (ExerciceDraft) -> Unit,
    onDelete: () -> Unit,
    onDuplicate: () -> Unit = {},
    canMoveUp: Boolean = false,
    canMoveDown: Boolean = false,
    onMoveUp: () -> Unit = {},
    onMoveDown: () -> Unit = {},
) {
    val showRepos = blocType == null || blocType == BlocType.ECHAUFFEMENT || blocType == BlocType.ACTIVATION || blocType == BlocType.RECUPERATION
    // Pour les circuits, le nombre de séries est centralisé dans l'en-tête du bloc — on le masque ici
    val showSeries = blocType != BlocType.CIRCUIT
    var expanded by remember { mutableStateOf(false) }

    Card(
        modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp, horizontal = 4.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(1.dp),
    ) {
        Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            ExerciceCardHeader(
                exercice = exercice,
                expanded = expanded,
                onToggleExpanded = { expanded = !expanded },
            )
            AnimatedVisibility(visible = expanded, enter = expandVertically(), exit = shrinkVertically()) {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                        if (showSeries) {
                            IntStepperField(
                                label = stringResource(R.string.seance_create_field_series),
                                value = exercice.nombreSeriesPrevues,
                                onValueChange = { onUpdate(exercice.copy(nombreSeriesPrevues = it)) },
                                min = 1,
                                modifier = Modifier.weight(1f),
                            )
                        }
                        if (showRepos) {
                            IntStepperField(
                                label = stringResource(R.string.seance_create_field_rest),
                                value = exercice.tempsReposSec,
                                onValueChange = { onUpdate(exercice.copy(tempsReposSec = it)) },
                                min = 0, step = 15,
                                modifier = Modifier.weight(1f),
                            )
                        }
                    }
                    ExerciceFields(exercice = exercice, onUpdate = onUpdate, blocType = blocType, userInventaire = userInventaire)
                    ExerciceCardFooter(
                        onDuplicate = onDuplicate,
                        canMoveUp = canMoveUp,
                        canMoveDown = canMoveDown,
                        onMoveUp = onMoveUp,
                        onMoveDown = onMoveDown,
                        onDelete = onDelete,
                    )
                }
            }
        }
    }
}

// ===== Champs communs exercice =====

@Composable
private fun ExerciceFields(
    exercice: ExerciceDraft,
    onUpdate: (ExerciceDraft) -> Unit,
    blocType: BlocType? = null,
    userInventaire: EquipmentInventaire = EquipmentInventaire(),
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
                label = { Text(stringResource(R.string.seance_create_reps_type_reps)) },
                modifier = Modifier.weight(1f),
            )
            FilterChip(
                selected = true,
                onClick = {},
                label = { Text(stringResource(R.string.seance_create_reps_type_duration)) },
                modifier = Modifier.weight(1f),
            )
        }
        Text(
            stringResource(R.string.seance_create_circuit_duration_info),
            style = MaterialTheme.typography.labelSmall,
            color = PandaSubtext,
        )
    } else {
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            FilterChip(
                selected = exercice.repsType == RepsType.REPS,
                onClick = { onUpdate(exercice.copy(repsType = RepsType.REPS)) },
                label = { Text(stringResource(R.string.seance_create_reps_type_reps)) },
                colors = FilterChipDefaults.filterChipColors(
                    selectedContainerColor = PandaGreen.copy(alpha = 0.15f),
                    selectedLabelColor = PandaGreen,
                ),
                modifier = Modifier.weight(1f),
            )
            FilterChip(
                selected = exercice.repsType == RepsType.DURATION,
                onClick = { onUpdate(exercice.copy(repsType = RepsType.DURATION)) },
                label = { Text(stringResource(R.string.seance_create_reps_type_duration)) },
                colors = FilterChipDefaults.filterChipColors(
                    selectedContainerColor = PandaPurple.copy(alpha = 0.15f),
                    selectedLabelColor = PandaPurple,
                ),
                modifier = Modifier.weight(1f),
            )
        }
    }

    // Reps or Duration field
    if (exercice.repsType == RepsType.REPS) {
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
            Text(stringResource(R.string.seance_create_inline_reps_label), style = labelStyle, modifier = labelWidth)
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
            Text(stringResource(R.string.seance_create_inline_duration_label), style = labelStyle, modifier = labelWidth)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.weight(1f)) {
                OutlinedTextField(
                    value = minStr,
                    onValueChange = { minStr = it.filter { c -> c.isDigit() }.take(2); commit() },
                    label = { Text(stringResource(R.string.seance_create_duration_min_label)) },
                    placeholder = { Text(stringResource(R.string.seance_create_duration_min_placeholder)) },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    modifier = Modifier.weight(1f),
                    singleLine = true,
                    textStyle = MaterialTheme.typography.bodySmall,
                )
                OutlinedTextField(
                    value = secStr,
                    onValueChange = { secStr = it.filter { c -> c.isDigit() }.take(2); commit() },
                    label = { Text(stringResource(R.string.seance_create_duration_sec_label)) },
                    placeholder = { Text(stringResource(R.string.seance_create_duration_sec_placeholder)) },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    modifier = Modifier.weight(1f),
                    singleLine = true,
                    textStyle = MaterialTheme.typography.bodySmall,
                )
            }
        }
    }

    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
        Text(stringResource(R.string.seance_create_inline_charge_label), style = labelStyle, modifier = labelWidth)
        OutlinedTextField(
            value = exercice.chargeCible,
            onValueChange = { onUpdate(exercice.copy(chargeCible = it)) },
            modifier = Modifier.weight(1f), singleLine = true, textStyle = MaterialTheme.typography.bodySmall,
        )
    }
    ChargeComposabiliteHint(
        chargeKg = parseChargeKg(parseChargeLabel(exercice.chargeCible)),
        chargesAtteignables = userInventaire.chargesAtteignablesPourEquipement(exercice.exercise.equipment),
        onArrondir = { onUpdate(exercice.copy(chargeCible = formatKgLabel(it))) },
    )
    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
        Text(stringResource(R.string.seance_create_inline_comment_label), style = labelStyle, modifier = labelWidth)
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
                Text(stringResource(R.string.seance_create_bilateral_label), style = MaterialTheme.typography.bodySmall, fontWeight = FontWeight.SemiBold)
                Text(stringResource(R.string.seance_create_bilateral_description), style = MaterialTheme.typography.labelSmall, color = PandaSubtext)
            }
        }
    }

    // Surcharge progressive — non applicable sur échauffement/activation (bible §0.3)
    if (blocType != BlocType.ECHAUFFEMENT && blocType != BlocType.ACTIVATION) {
        ProgressionConfigSection(exercice = exercice, onUpdate = onUpdate)
    } else {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f), RoundedCornerShape(11.dp))
                .padding(horizontal = 12.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(Icons.Default.Remove, null, tint = PandaSubtext, modifier = Modifier.size(14.dp))
            Spacer(Modifier.width(8.dp))
            Text(
                stringResource(R.string.seance_create_progression_not_applicable),
                style = MaterialTheme.typography.labelSmall,
                color = PandaSubtext,
            )
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun ProgressionConfigSection(
    exercice: ExerciceDraft,
    onUpdate: (ExerciceDraft) -> Unit,
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier
            .fillMaxWidth()
            .background(
                if (exercice.progressionActivee) PandaPurple.copy(alpha = 0.08f) else MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
                RoundedCornerShape(12.dp),
            )
            .padding(horizontal = 10.dp, vertical = 8.dp),
    ) {
        Box(
            modifier = Modifier.size(28.dp).background(MaterialTheme.colorScheme.surface, RoundedCornerShape(8.dp)),
            contentAlignment = Alignment.Center,
        ) {
            Icon(Icons.AutoMirrored.Filled.TrendingUp, null, tint = PandaPurple, modifier = Modifier.size(15.dp))
        }
        Spacer(Modifier.width(10.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(stringResource(R.string.seance_create_progression_label), style = MaterialTheme.typography.bodySmall, fontWeight = FontWeight.SemiBold)
            Text(
                if (exercice.progressionActivee) stringResource(R.string.seance_create_progression_description)
                else stringResource(R.string.seance_create_progression_description_off),
                style = MaterialTheme.typography.labelSmall,
                color = PandaSubtext,
            )
        }
        Switch(
            checked = exercice.progressionActivee,
            onCheckedChange = { checked ->
                onUpdate(
                    if (checked) {
                        exercice.copy(
                            progressionActivee = true,
                            systemeProgression = exercice.systemeProgression ?: SystemeProgression.DOUBLE,
                            repsMin = exercice.repsMin ?: 8,
                            repsMax = exercice.repsMax ?: 12,
                            incrementKg = exercice.incrementKg ?: 2.5f,
                        )
                    } else {
                        exercice.copy(progressionActivee = false, repsMin = null, repsMax = null)
                    }
                )
            },
            colors = SwitchDefaults.colors(checkedTrackColor = PandaPurple),
        )
    }

    if (exercice.progressionActivee) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .background(PandaPurple.copy(alpha = 0.06f), RoundedCornerShape(12.dp))
                .border(1.dp, PandaPurple.copy(alpha = 0.25f), RoundedCornerShape(12.dp))
                .padding(12.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
                Checkbox(
                    checked = exercice.isBodyweight,
                    onCheckedChange = { checked ->
                        onUpdate(
                            exercice.copy(
                                isBodyweight = checked,
                                typeExercice = if (checked) TypeExercice.PDC else exercice.typeExercice,
                            )
                        )
                    },
                )
                Spacer(Modifier.width(4.dp))
                Text(
                    stringResource(R.string.seance_create_progression_bodyweight_label),
                    style = MaterialTheme.typography.labelSmall,
                    color = PandaSubtext,
                )
            }

            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                FilterChip(
                    selected = exercice.systemeProgression == SystemeProgression.LINEAIRE,
                    onClick = { onUpdate(exercice.copy(systemeProgression = SystemeProgression.LINEAIRE)) },
                    label = { Text(stringResource(R.string.seance_create_progression_system_lineaire)) },
                    modifier = Modifier.weight(1f),
                )
                FilterChip(
                    selected = exercice.systemeProgression == SystemeProgression.DOUBLE,
                    onClick = { onUpdate(exercice.copy(systemeProgression = SystemeProgression.DOUBLE)) },
                    label = { Text(stringResource(R.string.seance_create_progression_system_double)) },
                    modifier = Modifier.weight(1f),
                )
                FilterChip(
                    selected = exercice.systemeProgression == SystemeProgression.TEMPORELLE,
                    onClick = { onUpdate(exercice.copy(systemeProgression = SystemeProgression.TEMPORELLE)) },
                    label = { Text(stringResource(R.string.seance_create_progression_system_temporelle)) },
                    modifier = Modifier.weight(1f),
                )
            }

            if (exercice.systemeProgression == SystemeProgression.DOUBLE) {
                Column {
                    Text(stringResource(R.string.seance_create_progression_reps_range), style = MaterialTheme.typography.labelSmall, color = PandaSubtext)
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        IntStepperField(
                            label = "",
                            value = exercice.repsMin ?: 8,
                            onValueChange = { onUpdate(exercice.copy(repsMin = it)) },
                            min = 1,
                            modifier = Modifier.weight(1f),
                        )
                        Text("→", color = PandaSubtext)
                        IntStepperField(
                            label = "",
                            value = exercice.repsMax ?: 12,
                            onValueChange = { onUpdate(exercice.copy(repsMax = it)) },
                            min = 1,
                            modifier = Modifier.weight(1f),
                        )
                    }
                }
            }

            if (exercice.isBodyweight) {
                Text(
                    stringResource(R.string.seance_create_progression_type_pdc),
                    style = MaterialTheme.typography.labelSmall,
                    color = PandaSubtext,
                )
            } else if (exercice.systemeProgression != SystemeProgression.TEMPORELLE) {
                Column {
                    Text(
                        stringResource(R.string.seance_create_progression_type_exercice_label),
                        style = MaterialTheme.typography.labelSmall,
                        color = PandaSubtext,
                    )
                    Spacer(Modifier.height(4.dp))
                    FlowRow(
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                        verticalArrangement = Arrangement.spacedBy(4.dp),
                    ) {
                        val typeLabels = mapOf(
                            TypeExercice.COMPOSE_BAS to R.string.seance_create_progression_type_compose_bas,
                            TypeExercice.COMPOSE_HAUT to R.string.seance_create_progression_type_compose_haut,
                            TypeExercice.ISOLATION to R.string.seance_create_progression_type_isolation,
                            TypeExercice.MACHINE to R.string.seance_create_progression_type_machine,
                            TypeExercice.PDC to R.string.seance_create_progression_type_pdc,
                        )
                        typeLabels.forEach { (type, labelRes) ->
                            FilterChip(
                                selected = exercice.typeExercice == type,
                                onClick = { onUpdate(exercice.copy(typeExercice = type)) },
                                label = { Text(stringResource(labelRes), style = MaterialTheme.typography.labelSmall) },
                            )
                        }
                    }
                }
            }

            if (exercice.isBodyweight) {
                // Pas de charge pour un exercice au poids de corps — progression sur les reps puis les séries
            } else if (exercice.systemeProgression == SystemeProgression.TEMPORELLE) {
                NumberStepper(
                    label = stringResource(R.string.seance_create_progression_increment_duree),
                    value = exercice.incrementDureeSec,
                    onValueChange = { onUpdate(exercice.copy(incrementDureeSec = it)) },
                    min = 1, step = 5,
                )
            } else {
                FloatStepperField(
                    label = stringResource(R.string.seance_create_progression_increment_kg),
                    value = exercice.incrementKg ?: 2.5f,
                    onValueChange = { onUpdate(exercice.copy(incrementKg = it)) },
                    min = 0.5f, step = 0.5f,
                )
            }

            IntStepperField(
                label = stringResource(R.string.seance_create_progression_deload),
                value = exercice.seuilDeload,
                onValueChange = { onUpdate(exercice.copy(seuilDeload = it)) },
                min = 1,
            )
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
            stringResource(R.string.seance_create_warmup_picker_title),
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier.padding(bottom = 12.dp),
        )
        if (warmups.isEmpty()) {
            Text(stringResource(R.string.seance_create_warmup_picker_empty), style = MaterialTheme.typography.bodySmall, color = PandaSubtext)
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
        if (label.isNotEmpty()) Text(label, style = MaterialTheme.typography.labelSmall, color = PandaSubtext)
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier
                .fillMaxWidth()
                .background(MaterialTheme.colorScheme.surfaceVariant, RoundedCornerShape(10.dp)),
        ) {
            IconButton(onClick = { if (value - step >= min) onValueChange(value - step) }, modifier = Modifier.size(34.dp)) {
                Icon(Icons.Default.Remove, "-", modifier = Modifier.size(14.dp), tint = PandaPurple)
            }
            Text(
                value.toString(),
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.Bold,
                textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                modifier = Modifier.weight(1f),
            )
            IconButton(onClick = { onValueChange(value + step) }, modifier = Modifier.size(34.dp)) {
                Icon(Icons.Default.Add, "+", modifier = Modifier.size(14.dp), tint = PandaPurple)
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
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier
                .fillMaxWidth()
                .background(MaterialTheme.colorScheme.surfaceVariant, RoundedCornerShape(10.dp)),
        ) {
            IconButton(onClick = { if (value - step >= min) onValueChange(value - step) }, modifier = Modifier.size(32.dp)) {
                Icon(Icons.Default.Remove, "-", modifier = Modifier.size(14.dp), tint = PandaPurple)
            }
            Text(
                "${value}s",
                style = MaterialTheme.typography.bodySmall,
                fontWeight = FontWeight.Bold,
                textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                modifier = Modifier.weight(1f),
            )
            IconButton(onClick = { onValueChange(value + step) }, modifier = Modifier.size(32.dp)) {
                Icon(Icons.Default.Add, "+", modifier = Modifier.size(14.dp), tint = PandaPurple)
            }
        }
    }
}

@Composable
fun FloatStepperField(
    label: String,
    value: Float,
    onValueChange: (Float) -> Unit,
    min: Float = 0f,
    step: Float = 0.5f,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier) {
        Text(label, style = MaterialTheme.typography.labelSmall, color = PandaSubtext)
        Spacer(Modifier.height(4.dp))
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier
                .fillMaxWidth()
                .background(MaterialTheme.colorScheme.surfaceVariant, RoundedCornerShape(10.dp)),
        ) {
            IconButton(onClick = { if (value - step >= min) onValueChange(value - step) }, modifier = Modifier.size(32.dp)) {
                Icon(Icons.Default.Remove, "-", modifier = Modifier.size(14.dp), tint = PandaPurple)
            }
            val display = if (value == value.toInt().toFloat()) "${value.toInt()} kg" else "$value kg"
            Text(
                display,
                style = MaterialTheme.typography.bodySmall,
                fontWeight = FontWeight.Bold,
                textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                modifier = Modifier.weight(1f),
            )
            IconButton(onClick = { onValueChange(value + step) }, modifier = Modifier.size(32.dp)) {
                Icon(Icons.Default.Add, "+", modifier = Modifier.size(14.dp), tint = PandaPurple)
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
            Text(stringResource(R.string.seance_create_add_bloc_button), color = PandaPurple)
        }
        DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            BlocType.entries.forEach { type ->
                DropdownMenuItem(text = { Text(type.displayNameRes()) }, onClick = { onAdd(type); expanded = false })
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
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        border = BorderStroke(1.5.dp, PandaPurple.copy(alpha = 0.4f)),
    ) {
    Column(modifier = Modifier.fillMaxWidth()) {
        // En-tête
        Column(modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    stringResource(R.string.seance_create_exercise_picker_title),
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.weight(1f),
                )
                if (multiSelectedIds.isNotEmpty()) {
                    Button(
                        onClick = onConfirm,
                        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 6.dp),
                    ) { Text(stringResource(R.string.seance_create_exercise_picker_confirm_button, multiSelectedIds.size)) }
                }
                IconButton(onClick = onDismiss) {
                    Icon(Icons.Default.Close, stringResource(R.string.common_close_cd))
                }
            }
            Spacer(Modifier.height(10.dp))
            OutlinedTextField(
                value = query, onValueChange = onQueryChange,
                label = { Text(stringResource(R.string.common_search_label)) }, modifier = Modifier.fillMaxWidth(), singleLine = true,
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
                    label = { Text(stringResource(R.string.seance_create_picker_filter_equipment)) },
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
                    label = { Text(stringResource(R.string.seance_create_picker_filter_all)) },
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
                stringResource(R.string.seance_create_picker_empty),
                style = MaterialTheme.typography.bodySmall,
                color = PandaSubtext,
                modifier = Modifier.padding(16.dp),
            )
        } else {
            LazyColumn(modifier = Modifier.fillMaxWidth().heightIn(max = 420.dp)) {
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
}

fun blocColor(type: BlocType) = when (type) {
    BlocType.ECHAUFFEMENT -> Color(0xFFFF8F00)
    BlocType.ACTIVATION -> Color(0xFF5E35B1)
    BlocType.SUPERSET -> Color(0xFFE65100)
    BlocType.CIRCUIT -> Color(0xFF00838F)
    BlocType.RECUPERATION -> Color(0xFF2E7D32)
}

fun blocTypeIcon(type: BlocType) = when (type) {
    BlocType.ECHAUFFEMENT -> Icons.Default.Whatshot
    BlocType.ACTIVATION -> Icons.Default.SelfImprovement
    BlocType.SUPERSET -> Icons.Default.Bolt
    BlocType.CIRCUIT -> Icons.Default.FitnessCenter
    BlocType.RECUPERATION -> Icons.Default.SelfImprovement
}
