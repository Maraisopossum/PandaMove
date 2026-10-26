package com.pandafit.feature.profile.ui

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
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
import androidx.compose.foundation.clickable
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Download
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Upload
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.pandafit.core.database.catalog.EquipmentCategory
import com.pandafit.core.database.catalog.MuscleGroup
import com.pandafit.core.database.catalog.muscleToGroup
import com.pandafit.core.database.entities.effectivePrimary
import com.pandafit.core.database.entities.ExerciseEntity
import com.pandafit.designsystem.components.PandaFilterChip
import com.pandafit.designsystem.components.PandaTopBar
import com.pandafit.designsystem.theme.PandaGreen
import com.pandafit.designsystem.theme.PandaSubtext
import com.pandafit.feature.profile.R
import com.pandafit.feature.profile.viewmodel.CreateDialogState
import com.pandafit.feature.profile.viewmodel.EditDialogState
import com.pandafit.feature.profile.viewmodel.ExerciseCatalogViewModel
import com.pandafit.feature.profile.viewmodel.ExerciseExportImportStatus
import com.pandafit.feature.profile.viewmodel.ExerciseListState
import com.pandafit.feature.profile.viewmodel.ExerciseMenuState

@OptIn(ExperimentalLayoutApi::class, ExperimentalMaterial3Api::class)
@Composable
fun ExerciseCatalogScreen(
    onNavigateBack: () -> Unit,
    viewModel: ExerciseCatalogViewModel = hiltViewModel(),
) {
    val context = LocalContext.current
    val listState by viewModel.listState.collectAsStateWithLifecycle()
    val dialogState by viewModel.dialogState.collectAsStateWithLifecycle()
    val editDialogState by viewModel.editDialogState.collectAsStateWithLifecycle()
    val menuState by viewModel.menuState.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) {
        viewModel.shareIntent.collect { intent -> context.startActivity(intent) }
    }

    val importLauncher = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        uri?.let { viewModel.importExercisesFromUri(it) }
    }

    if (dialogState.visible) {
        CreateExerciseDialog(
            state = dialogState,
            onNameChange = viewModel::setNewName,
            onMuscleToggle = viewModel::toggleNewMuscle,
            onEquipmentToggle = viewModel::toggleNewEquipment,
            onBodyweightToggle = viewModel::toggleNewIsBodyweight,
            onConfirm = viewModel::createCustomExercise,
            onDismiss = viewModel::closeCreate,
        )
    }

    if (editDialogState.visible) {
        EditExerciseDialog(
            state = editDialogState,
            onMuscleToggle = viewModel::toggleEditMuscle,
            onEquipmentToggle = viewModel::toggleEditEquipment,
            onBodyweightToggle = viewModel::toggleEditIsBodyweight,
            onTypeSelect = viewModel::setEditExerciseType,
            onConfirm = viewModel::saveEdit,
            onDismiss = viewModel::closeEdit,
        )
    }

    if (menuState.topBarMenuOpen) {
        ModalBottomSheet(onDismissRequest = viewModel::closeTopBarMenu) {
            TopBarMenuSheetContent(
                onNewExercise = { viewModel.closeTopBarMenu(); viewModel.openCreate() },
                onOpenImportExport = { viewModel.closeTopBarMenu(); viewModel.openImportExportSheet() },
            )
        }
    }

    if (menuState.importExportSheetOpen) {
        ModalBottomSheet(onDismissRequest = viewModel::closeImportExportSheet) {
            ImportExportSheetContent(
                menuState = menuState,
                onExportJson = viewModel::exportExercisesJson,
                onExportCsv = viewModel::exportExercisesCsv,
                onImport = { importLauncher.launch("*/*") },
            )
        }
    }

    if (menuState.settingsSheetOpen) {
        ModalBottomSheet(onDismissRequest = viewModel::closeSettingsSheet) {
            SettingsSheetContent(
                onlyAvailable = listState.onlyAvailable,
                onToggleAvailable = viewModel::toggleOnlyAvailable,
            )
        }
    }

    Scaffold(
        topBar = {
            PandaTopBar(
                title = stringResource(R.string.exercise_catalog_title),
                onNavigateBack = onNavigateBack,
                actions = {
                    IconButton(onClick = viewModel::openTopBarMenu) {
                        Icon(Icons.Default.MoreVert, stringResource(R.string.exercise_catalog_menu_cd))
                    }
                },
            )
        },
        containerColor = MaterialTheme.colorScheme.background,
        floatingActionButton = {
            FloatingActionButton(onClick = viewModel::openCreate, containerColor = PandaGreen) {
                Icon(Icons.Default.Add, stringResource(R.string.exercise_catalog_add_cd), tint = Color.White)
            }
        },
    ) { innerPadding ->
        Column(modifier = Modifier.fillMaxSize().padding(innerPadding)) {
            ExerciseFilters(
                listState = listState,
                onQueryChange = viewModel::setQuery,
                onGroupChange = viewModel::setGroup,
                onOpenSettings = viewModel::openSettingsSheet,
            )
            HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp))
            ExerciseGroupedList(
                listState = listState,
                onEdit = { viewModel.openEdit(it) },
                onDelete = { viewModel.deleteCustomExercise(it) },
            )
        }
    }
}

@Composable
private fun TopBarMenuSheetContent(
    onNewExercise: () -> Unit,
    onOpenImportExport: () -> Unit,
) {
    Column(modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp).padding(bottom = 24.dp)) {
        Row(
            modifier = Modifier.fillMaxWidth().clickable(onClick = onNewExercise).padding(vertical = 14.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(Icons.Default.Add, null, tint = PandaGreen)
            Spacer(Modifier.width(16.dp))
            Text(stringResource(R.string.exercise_catalog_menu_new), style = MaterialTheme.typography.bodyLarge)
        }
        HorizontalDivider()
        Row(
            modifier = Modifier.fillMaxWidth().clickable(onClick = onOpenImportExport).padding(vertical = 14.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(Icons.Default.Download, null, tint = PandaSubtext)
            Spacer(Modifier.width(16.dp))
            Text(stringResource(R.string.exercise_catalog_menu_import_export_title), style = MaterialTheme.typography.bodyLarge)
        }
    }
}

@Composable
private fun ImportExportSheetContent(
    menuState: ExerciseMenuState,
    onExportJson: () -> Unit,
    onExportCsv: () -> Unit,
    onImport: () -> Unit,
) {
    Column(modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp).padding(bottom = 24.dp)) {
        Text(
            stringResource(R.string.exercise_catalog_menu_import_export_title),
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold,
        )
        Spacer(Modifier.height(12.dp))
        Row(
            modifier = Modifier.fillMaxWidth().clickable(onClick = onImport).padding(vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(Icons.Default.Upload, null, tint = PandaSubtext)
            Spacer(Modifier.width(16.dp))
            Text(stringResource(R.string.exercise_catalog_menu_import), style = MaterialTheme.typography.bodyLarge)
        }
        Row(
            modifier = Modifier.fillMaxWidth().clickable(onClick = onExportJson).padding(vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(Icons.Default.Download, null, tint = PandaSubtext)
            Spacer(Modifier.width(16.dp))
            Text(stringResource(R.string.exercise_catalog_export_json), style = MaterialTheme.typography.bodyLarge)
        }
        Row(
            modifier = Modifier.fillMaxWidth().clickable(onClick = onExportCsv).padding(vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(Icons.Default.Download, null, tint = PandaSubtext)
            Spacer(Modifier.width(16.dp))
            Text(stringResource(R.string.exercise_catalog_export_csv), style = MaterialTheme.typography.bodyLarge)
        }
        HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))
        Text(
            stringResource(R.string.exercise_catalog_import_export_formats),
            style = MaterialTheme.typography.labelSmall,
            color = PandaSubtext,
        )
        Text(
            stringResource(R.string.exercise_catalog_import_export_dedup),
            style = MaterialTheme.typography.labelSmall,
            color = PandaSubtext,
        )
        when (menuState.status) {
            ExerciseExportImportStatus.RUNNING -> {
                Spacer(Modifier.height(8.dp))
                CircularProgressIndicator(modifier = Modifier.size(20.dp))
            }
            ExerciseExportImportStatus.SUCCESS -> {
                menuState.importResult?.let {
                    Spacer(Modifier.height(8.dp))
                    Text(
                        stringResource(R.string.exercise_catalog_import_success, it.imported, it.skipped),
                        style = MaterialTheme.typography.labelMedium,
                        color = PandaGreen,
                    )
                }
            }
            ExerciseExportImportStatus.ERROR -> {
                Spacer(Modifier.height(8.dp))
                Text(
                    stringResource(R.string.exercise_catalog_import_error, menuState.errorMessage ?: ""),
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.error,
                )
            }
            ExerciseExportImportStatus.IDLE -> Unit
        }
    }
}

@Composable
private fun SettingsSheetContent(
    onlyAvailable: Boolean,
    onToggleAvailable: () -> Unit,
) {
    Column(modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp).padding(bottom = 24.dp)) {
        Text(
            stringResource(R.string.exercise_catalog_settings_title),
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold,
        )
        Spacer(Modifier.height(12.dp))
        PandaFilterChip(
            label = stringResource(R.string.exercise_catalog_my_equipment),
            selected = onlyAvailable,
            onSelectedChange = { onToggleAvailable() },
            selectedColor = PandaGreen,
        )
    }
}

private const val VISIBLE_GROUP_COUNT = 6

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun ExerciseFilters(
    listState: ExerciseListState,
    onQueryChange: (String) -> Unit,
    onGroupChange: (MuscleGroup?) -> Unit,
    onOpenSettings: () -> Unit,
) {
    Column {
        OutlinedTextField(
            value = listState.query,
            onValueChange = onQueryChange,
            placeholder = { Text(stringResource(R.string.exercise_catalog_search_placeholder)) },
            leadingIcon = { Icon(Icons.Default.Search, null) },
            trailingIcon = {
                IconButton(onClick = onOpenSettings) {
                    Icon(Icons.Default.Settings, stringResource(R.string.exercise_catalog_settings_cd))
                }
            },
            singleLine = true,
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
        )
        Text(
            stringResource(R.string.exercise_catalog_count_found, listState.exercises.size),
            style = MaterialTheme.typography.labelSmall,
            color = PandaSubtext,
            modifier = Modifier.padding(horizontal = 16.dp),
        )
        Spacer(Modifier.height(8.dp))

        val allGroups = MuscleGroup.entries.filter { it != MuscleGroup.AUTRE }
        val visibleGroups = allGroups.take(VISIBLE_GROUP_COUNT)
        val overflowGroups = allGroups.drop(VISIBLE_GROUP_COUNT)
        var overflowMenuOpen by remember { mutableStateOf(false) }

        Row(
            modifier = Modifier.padding(horizontal = 16.dp).horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            FilterChip(
                selected = listState.selectedGroup == null,
                onClick = { onGroupChange(null) },
                label = { Text(stringResource(R.string.exercise_catalog_all_filter)) },
                colors = FilterChipDefaults.filterChipColors(
                    selectedContainerColor = PandaGreen,
                    selectedLabelColor = Color.White,
                ),
            )
            visibleGroups.forEach { group ->
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
            if (overflowGroups.isNotEmpty()) {
                Box {
                    FilterChip(
                        selected = overflowGroups.any { it == listState.selectedGroup },
                        onClick = { overflowMenuOpen = true },
                        label = { Text(stringResource(R.string.exercise_catalog_more_filters)) },
                        trailingIcon = { Icon(Icons.Default.ExpandMore, null, Modifier.size(16.dp)) },
                    )
                    DropdownMenu(expanded = overflowMenuOpen, onDismissRequest = { overflowMenuOpen = false }) {
                        overflowGroups.forEach { group ->
                            DropdownMenuItem(
                                text = { Text(group.label, color = Color(group.colorArgb)) },
                                onClick = {
                                    overflowMenuOpen = false
                                    onGroupChange(if (listState.selectedGroup == group) null else group)
                                },
                            )
                        }
                    }
                }
            }
        }
        Spacer(Modifier.height(4.dp))
    }
}

@Composable
private fun ExerciseGroupedList(
    listState: ExerciseListState,
    onEdit: (ExerciseEntity) -> Unit,
    onDelete: (ExerciseEntity) -> Unit,
) {
    if (listState.exercises.isEmpty()) {
        Box(
            modifier = Modifier.fillMaxSize().padding(32.dp),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                if (listState.query.isNotBlank() || listState.selectedGroup != null || listState.onlyAvailable)
                    stringResource(R.string.exercise_catalog_empty_filtered)
                else
                    stringResource(R.string.exercise_catalog_loading),
                style = MaterialTheme.typography.bodyMedium,
                color = PandaSubtext,
            )
        }
        return
    }

    LazyColumn(contentPadding = PaddingValues(start = 16.dp, top = 8.dp, end = 16.dp, bottom = 88.dp)) {
        if (listState.selectedGroup != null) {
            items(listState.exercises, key = { it.id }) { exercise ->
                ExerciseCatalogRow(
                    exercise = exercise,
                    onEdit = { onEdit(exercise) },
                    onDelete = if (exercise.isCustom) ({ onDelete(exercise) }) else null,
                )
                HorizontalDivider(modifier = Modifier.padding(start = 8.dp))
            }
        } else {
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
                        onEdit = { onEdit(exercise) },
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
    onBodyweightToggle: () -> Unit,
    onConfirm: () -> Unit,
    onDismiss: () -> Unit,
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(R.string.exercise_catalog_create_title)) },
        text = {
            Column(
                modifier = Modifier.verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                OutlinedTextField(
                    value = state.name,
                    onValueChange = onNameChange,
                    label = { Text(stringResource(R.string.exercise_catalog_create_name_label)) },
                    singleLine = true,
                    isError = state.nameError,
                    supportingText = if (state.nameError) {
                        { Text(stringResource(R.string.exercise_catalog_name_taken)) }
                    } else null,
                    modifier = Modifier.fillMaxWidth(),
                )
                MusclePickerSection(
                    selectedMuscles = state.muscles,
                    onToggle = onMuscleToggle,
                )
                EquipmentPickerSection(
                    selectedEquipment = state.equipment,
                    onToggle = onEquipmentToggle,
                )
                BodyweightCheckbox(
                    checked = state.isBodyweight,
                    onToggle = onBodyweightToggle,
                )
            }
        },
        confirmButton = {
            TextButton(onClick = onConfirm, enabled = state.name.isNotBlank()) {
                Text(stringResource(R.string.exercise_catalog_create_confirm), fontWeight = FontWeight.SemiBold)
            }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text(stringResource(R.string.common_cancel)) } },
    )
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun EditExerciseDialog(
    state: EditDialogState,
    onMuscleToggle: (MuscleGroup) -> Unit,
    onEquipmentToggle: (EquipmentCategory) -> Unit,
    onBodyweightToggle: () -> Unit,
    onTypeSelect: (String) -> Unit,
    onConfirm: () -> Unit,
    onDismiss: () -> Unit,
) {
    val exercise = state.exercise ?: return
    val maxDialogHeight = LocalConfiguration.current.screenHeightDp.dp * 0.85f
    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false),
    ) {
        Surface(
            shape = RoundedCornerShape(28.dp),
            tonalElevation = 6.dp,
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 24.dp)
                .heightIn(max = maxDialogHeight),
        ) {
            Column(modifier = Modifier.padding(24.dp)) {
                Text(
                    stringResource(R.string.exercise_catalog_edit_title),
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold,
                )
                Spacer(Modifier.height(16.dp))

                Column(
                    modifier = Modifier
                        .weight(1f, fill = false)
                        .verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(16.dp),
                ) {
                    // Nom verrouillé — identifiant stable
                    Column {
                        Text(
                            stringResource(R.string.exercise_catalog_name_locked),
                            style = MaterialTheme.typography.labelMedium,
                            color = PandaSubtext,
                        )
                        Spacer(Modifier.height(4.dp))
                        Text(
                            exercise.name,
                            style = MaterialTheme.typography.bodyLarge,
                            fontWeight = FontWeight.SemiBold,
                        )
                    }

                    HorizontalDivider()

                    // Type d'exercice
                    Column {
                        Text(
                            stringResource(R.string.exercise_catalog_type_label),
                            style = MaterialTheme.typography.labelMedium,
                            color = PandaSubtext,
                        )
                        Spacer(Modifier.height(6.dp))
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            listOf("" to stringResource(R.string.exercise_catalog_type_undefined), "Mono" to stringResource(R.string.exercise_catalog_type_mono), "Pluri" to stringResource(R.string.exercise_catalog_type_pluri)).forEach { (value, label) ->
                                FilterChip(
                                    selected = state.exerciseType == value,
                                    onClick = { onTypeSelect(value) },
                                    label = { Text(label, style = MaterialTheme.typography.labelSmall) },
                                )
                            }
                        }
                    }

                    // Muscles
                    MusclePickerSection(
                        selectedMuscles = state.muscles,
                        onToggle = onMuscleToggle,
                    )

                    // Équipement
                    EquipmentPickerSection(
                        selectedEquipment = state.equipment,
                        onToggle = onEquipmentToggle,
                    )

                    BodyweightCheckbox(
                        checked = state.isBodyweight,
                        onToggle = onBodyweightToggle,
                    )
                }

                // Boutons
                Row(
                    modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                    horizontalArrangement = Arrangement.End,
                ) {
                    TextButton(onClick = onDismiss) { Text(stringResource(R.string.common_cancel)) }
                    Spacer(Modifier.width(8.dp))
                    TextButton(onClick = onConfirm) {
                        Text(stringResource(R.string.exercise_catalog_save), fontWeight = FontWeight.SemiBold)
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun MusclePickerSection(
    selectedMuscles: List<MuscleGroup>,
    onToggle: (MuscleGroup) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(
            stringResource(R.string.exercise_catalog_muscles_label),
            style = MaterialTheme.typography.labelMedium,
            color = PandaSubtext,
        )
        if (selectedMuscles.isNotEmpty()) {
            FlowRow(
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                verticalArrangement = Arrangement.spacedBy(4.dp),
                modifier = Modifier.padding(bottom = 2.dp),
            ) {
                selectedMuscles.forEachIndexed { index, group ->
                    FilterChip(
                        selected = true,
                        onClick = { onToggle(group) },
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
            MuscleGroup.entries.filter { it != MuscleGroup.AUTRE && it !in selectedMuscles }.forEach { group ->
                FilterChip(
                    selected = false,
                    onClick = { onToggle(group) },
                    label = { Text(group.label, style = MaterialTheme.typography.labelSmall) },
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
private fun BodyweightCheckbox(
    checked: Boolean,
    onToggle: () -> Unit,
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier.fillMaxWidth().clickable(onClick = onToggle),
    ) {
        Checkbox(checked = checked, onCheckedChange = { onToggle() })
        Spacer(Modifier.width(4.dp))
        Text(
            stringResource(R.string.exercise_catalog_bodyweight_label),
            style = MaterialTheme.typography.labelMedium,
        )
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun EquipmentPickerSection(
    selectedEquipment: Set<EquipmentCategory>,
    onToggle: (EquipmentCategory) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(
            stringResource(R.string.exercise_catalog_equipment_label),
            style = MaterialTheme.typography.labelMedium,
            color = PandaSubtext,
        )
        FlowRow(
            horizontalArrangement = Arrangement.spacedBy(6.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            EquipmentCategory.entries.forEach { cat ->
                FilterChip(
                    selected = cat in selectedEquipment,
                    onClick = { onToggle(cat) },
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
}

@Composable
private fun ExerciseCatalogRow(
    exercise: ExerciseEntity,
    onEdit: () -> Unit,
    onDelete: (() -> Unit)?,
) {
    val primaryGroup = muscleToGroup(exercise.effectivePrimary)
    val groupColor = Color(primaryGroup.colorArgb)
    var menuOpen by remember { mutableStateOf(false) }

    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier = Modifier
                .width(4.dp)
                .height(36.dp)
                .clip(RoundedCornerShape(2.dp))
                .background(groupColor),
        )
        Spacer(Modifier.width(10.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(
                exercise.name,
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = if (exercise.isCustom) FontWeight.SemiBold else FontWeight.Normal,
            )
            val equipmentLabel = exercise.equipment.firstOrNull() ?: "—"
            Text(
                "${primaryGroup.label} • $equipmentLabel",
                style = MaterialTheme.typography.labelSmall,
                color = PandaSubtext,
            )
        }
        Box {
            IconButton(onClick = { menuOpen = true }, modifier = Modifier.size(36.dp)) {
                Icon(
                    Icons.Default.MoreVert,
                    stringResource(R.string.exercise_catalog_row_menu_cd),
                    tint = PandaSubtext,
                )
            }
            DropdownMenu(expanded = menuOpen, onDismissRequest = { menuOpen = false }) {
                DropdownMenuItem(
                    text = { Text(stringResource(R.string.exercise_catalog_edit_cd)) },
                    leadingIcon = { Icon(Icons.Default.Edit, null) },
                    onClick = { menuOpen = false; onEdit() },
                )
                if (onDelete != null) {
                    DropdownMenuItem(
                        text = { Text(stringResource(R.string.exercise_catalog_delete_cd), color = MaterialTheme.colorScheme.error) },
                        leadingIcon = { Icon(Icons.Default.Delete, null, tint = MaterialTheme.colorScheme.error) },
                        onClick = { menuOpen = false; onDelete() },
                    )
                }
            }
        }
    }
}
