package com.pandafit.feature.profile.viewmodel

import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.pandafit.core.common.normalizeSearch
import com.pandafit.core.database.catalog.CatalogRepository
import com.pandafit.core.database.catalog.EquipmentCategory
import com.pandafit.core.database.catalog.EquipmentRepository
import com.pandafit.core.database.catalog.MuscleGroup
import com.pandafit.core.database.catalog.muscleToGroup
import com.pandafit.core.database.catalog.rawEquipmentToCategory
import com.pandafit.core.database.dao.ExerciseDao
import com.pandafit.core.database.entities.effectivePrimary
import com.pandafit.core.database.entities.ExerciseEntity
import com.pandafit.core.database.export.DataExportManager
import com.pandafit.core.database.export.DataImportManager
import com.pandafit.core.database.export.ImportResult
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import javax.inject.Inject

// ===== État de la liste filtrée =====

data class ExerciseListState(
    val exercises: List<ExerciseEntity> = emptyList(),
    val query: String = "",
    val selectedGroup: MuscleGroup? = null,
    val onlyAvailable: Boolean = false,
    val userEquipment: Set<EquipmentCategory> = emptySet(),
)

// ===== État du dialogue de création (observable séparément) =====

data class CreateDialogState(
    val visible: Boolean = false,
    val name: String = "",
    val muscles: List<MuscleGroup> = emptyList(),
    val equipment: Set<EquipmentCategory> = emptySet(),
    val isBodyweight: Boolean = false,
    /** Nom déjà utilisé par un autre exercice (name est unique en base depuis v27) — bloque la création. */
    val nameError: Boolean = false,
)

// ===== État des menus / bottom sheets (top bar + réglages + import/export) =====

enum class ExerciseExportImportStatus { IDLE, RUNNING, SUCCESS, ERROR }

data class ExerciseMenuState(
    val topBarMenuOpen: Boolean = false,
    val settingsSheetOpen: Boolean = false,
    val importExportSheetOpen: Boolean = false,
    val status: ExerciseExportImportStatus = ExerciseExportImportStatus.IDLE,
    val importResult: ImportResult? = null,
    val errorMessage: String? = null,
)

// ===== État du dialogue d'édition =====

data class EditDialogState(
    val visible: Boolean = false,
    val exercise: ExerciseEntity? = null,
    val muscles: List<MuscleGroup> = emptyList(),
    val equipment: Set<EquipmentCategory> = emptySet(),
    val exerciseType: String = "",
    val isBodyweight: Boolean = false,
)

@HiltViewModel
class ExerciseCatalogViewModel @Inject constructor(
    @ApplicationContext private val context: Context,
    private val exerciseDao: ExerciseDao,
    private val equipmentRepository: EquipmentRepository,
    private val exportManager: DataExportManager,
    private val importManager: DataImportManager,
    @Suppress("UnusedPrivateMember") private val catalogRepository: CatalogRepository,
) : ViewModel() {

    // ===== Filtres =====
    private val _query = MutableStateFlow("")
    private val _selectedGroup = MutableStateFlow<MuscleGroup?>(null)
    private val _onlyAvailable = MutableStateFlow(false)

    // ===== Dialogues création / édition (état structuré, pas de combine) =====
    private val _dialogState = MutableStateFlow(CreateDialogState())
    val dialogState: StateFlow<CreateDialogState> = _dialogState.asStateFlow()

    private val _editDialogState = MutableStateFlow(EditDialogState())
    val editDialogState: StateFlow<EditDialogState> = _editDialogState.asStateFlow()

    // ===== Menus top bar / réglages / import-export =====
    private val _menuState = MutableStateFlow(ExerciseMenuState())
    val menuState: StateFlow<ExerciseMenuState> = _menuState.asStateFlow()

    private val _shareIntent = MutableSharedFlow<Intent>(extraBufferCapacity = 1)
    val shareIntent: SharedFlow<Intent> = _shareIntent.asSharedFlow()

    // StateFlow 1 : liste filtrée
    val listState: StateFlow<ExerciseListState> = combine(
        exerciseDao.observeAll(),
        _query,
        _selectedGroup,
        _onlyAvailable,
        equipmentRepository.selectedEquipment,
    ) { exercises, query, group, onlyAvailable, equipment ->
        val filtered = exercises
            .filter { ex ->
                val matchesQuery = query.isBlank() ||
                    ex.name.normalizeSearch().contains(query.normalizeSearch())
                val matchesGroup = group == null ||
                    ex.muscleGroups.any { muscleToGroup(it) == group }
                val matchesEquipment = !onlyAvailable || run {
                    val required = ex.equipment.mapNotNull { rawEquipmentToCategory(it) }.toSet()
                    required.isEmpty() ||
                        required == setOf(EquipmentCategory.POIDS_DE_CORPS) ||
                        equipment.containsAll(required)
                }
                matchesQuery && matchesGroup && matchesEquipment
            }
            .sortedWith(
                if (group == null) {
                    compareBy({ muscleToGroup(it.effectivePrimary).ordinal }, { it.name })
                } else {
                    compareBy(
                        { if (muscleToGroup(it.effectivePrimary) == group) 0 else 1 },
                        { it.name },
                    )
                }
            )
        ExerciseListState(
            exercises = filtered,
            query = query,
            selectedGroup = group,
            onlyAvailable = onlyAvailable,
            userEquipment = equipment,
        )
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), ExerciseListState())

    // ===== Filtres =====
    fun setQuery(q: String) { _query.value = q }
    fun setGroup(g: MuscleGroup?) { _selectedGroup.value = g }
    fun toggleOnlyAvailable() { _onlyAvailable.value = !_onlyAvailable.value }

    // ===== Dialogue création =====
    fun openCreate() { _dialogState.value = CreateDialogState(visible = true) }
    fun closeCreate() { _dialogState.value = _dialogState.value.copy(visible = false) }
    fun setNewName(n: String) { _dialogState.value = _dialogState.value.copy(name = n, nameError = false) }
    fun toggleNewMuscle(g: MuscleGroup) {
        val current = _dialogState.value.muscles.toMutableList()
        if (g in current) current.remove(g) else current.add(g)
        _dialogState.value = _dialogState.value.copy(muscles = current)
    }
    fun toggleNewEquipment(cat: EquipmentCategory) {
        val current = _dialogState.value.equipment.toMutableSet()
        if (cat in current) current.remove(cat) else current.add(cat)
        _dialogState.value = _dialogState.value.copy(equipment = current)
    }
    fun toggleNewIsBodyweight() {
        _dialogState.value = _dialogState.value.copy(isBodyweight = !_dialogState.value.isBodyweight)
    }

    fun createCustomExercise() {
        val state = _dialogState.value
        val name = state.name.trim()
        if (name.isBlank()) return
        val muscles = state.muscles
        val primaryGroup = muscles.firstOrNull()
        viewModelScope.launch {
            // name est unique en base (v27) — vérifié ici pour un message clair plutôt qu'un crash
            // sur violation de contrainte.
            if (exerciseDao.getByName(name) != null) {
                _dialogState.value = _dialogState.value.copy(nameError = true)
                return@launch
            }
            exerciseDao.insertExercise(
                ExerciseEntity(
                    name = name,
                    category = primaryGroup?.toExerciseCategory()
                        ?: com.pandafit.core.database.entities.ExerciseCategory.OTHER,
                    musclePrimary = primaryGroup?.label ?: "",
                    muscleGroups = muscles.map { it.label },
                    equipment = state.equipment.map { it.label },
                    isCustom = true,
                    isBodyweight = state.isBodyweight,
                ),
            )
            _dialogState.value = _dialogState.value.copy(visible = false)
        }
    }

    fun deleteCustomExercise(exercise: ExerciseEntity) {
        if (!exercise.isCustom) return
        viewModelScope.launch { exerciseDao.deleteExercise(exercise) }
    }

    // ===== Dialogue édition =====
    fun openEdit(exercise: ExerciseEntity) {
        _editDialogState.value = EditDialogState(
            visible = true,
            exercise = exercise,
            muscles = exercise.muscleGroups.map { raw ->
                MuscleGroup.entries.find { it.label.equals(raw, ignoreCase = true) }
                    ?: muscleToGroup(raw)
            }.distinct(),
            equipment = exercise.equipment.mapNotNull { raw ->
                EquipmentCategory.entries.find { it.label.equals(raw, ignoreCase = true) }
                    ?: rawEquipmentToCategory(raw)
            }.toSet(),
            exerciseType = exercise.exerciseType,
            isBodyweight = exercise.isBodyweight,
        )
    }

    fun closeEdit() { _editDialogState.value = _editDialogState.value.copy(visible = false) }

    fun toggleEditMuscle(g: MuscleGroup) {
        val current = _editDialogState.value.muscles.toMutableList()
        if (g in current) current.remove(g) else current.add(g)
        _editDialogState.value = _editDialogState.value.copy(muscles = current)
    }

    fun toggleEditEquipment(cat: EquipmentCategory) {
        val current = _editDialogState.value.equipment.toMutableSet()
        if (cat in current) current.remove(cat) else current.add(cat)
        _editDialogState.value = _editDialogState.value.copy(equipment = current)
    }

    fun setEditExerciseType(type: String) {
        _editDialogState.value = _editDialogState.value.copy(exerciseType = type)
    }
    fun toggleEditIsBodyweight() {
        _editDialogState.value = _editDialogState.value.copy(isBodyweight = !_editDialogState.value.isBodyweight)
    }

    fun saveEdit() {
        val state = _editDialogState.value
        val target = state.exercise ?: return
        val muscles = state.muscles
        val primaryGroup = muscles.firstOrNull()
        viewModelScope.launch {
            exerciseDao.updateExercise(
                target.copy(
                    muscleGroups = muscles.map { it.label },
                    musclePrimary = primaryGroup?.label ?: "",
                    category = primaryGroup?.toExerciseCategory()
                        ?: com.pandafit.core.database.entities.ExerciseCategory.OTHER,
                    equipment = state.equipment.map { it.label },
                    exerciseType = state.exerciseType,
                    isBodyweight = state.isBodyweight,
                )
            )
            _editDialogState.value = _editDialogState.value.copy(visible = false)
        }
    }

    // ===== Menu top bar =====
    fun openTopBarMenu() { _menuState.value = _menuState.value.copy(topBarMenuOpen = true) }
    fun closeTopBarMenu() { _menuState.value = _menuState.value.copy(topBarMenuOpen = false) }

    // ===== Réglages (filtre "Mon matériel") =====
    fun openSettingsSheet() { _menuState.value = _menuState.value.copy(settingsSheetOpen = true) }
    fun closeSettingsSheet() { _menuState.value = _menuState.value.copy(settingsSheetOpen = false) }

    // ===== Import / export en masse =====
    fun openImportExportSheet() {
        _menuState.value = _menuState.value.copy(
            importExportSheetOpen = true,
            topBarMenuOpen = false,
            status = ExerciseExportImportStatus.IDLE,
        )
    }
    fun closeImportExportSheet() { _menuState.value = _menuState.value.copy(importExportSheetOpen = false) }

    fun exportExercisesJson() {
        viewModelScope.launch {
            _menuState.value = _menuState.value.copy(status = ExerciseExportImportStatus.RUNNING)
            try {
                val file = exportManager.exportExercisesToJson()
                _shareIntent.tryEmit(exportManager.buildShareIntent(file))
                _menuState.value = _menuState.value.copy(status = ExerciseExportImportStatus.SUCCESS)
            } catch (e: Exception) {
                _menuState.value = _menuState.value.copy(
                    status = ExerciseExportImportStatus.ERROR,
                    errorMessage = e.message,
                )
            }
        }
    }

    fun exportExercisesCsv() {
        viewModelScope.launch {
            _menuState.value = _menuState.value.copy(status = ExerciseExportImportStatus.RUNNING)
            try {
                val file = exportManager.exportExercisesToCsv()
                _shareIntent.tryEmit(exportManager.buildShareIntent(file, "text/csv"))
                _menuState.value = _menuState.value.copy(status = ExerciseExportImportStatus.SUCCESS)
            } catch (e: Exception) {
                _menuState.value = _menuState.value.copy(
                    status = ExerciseExportImportStatus.ERROR,
                    errorMessage = e.message,
                )
            }
        }
    }

    /** Détecte le format (JSON vs CSV) au contenu — évite de faire choisir le format à l'utilisateur. */
    fun importExercisesFromUri(uri: Uri) {
        viewModelScope.launch {
            _menuState.value = _menuState.value.copy(status = ExerciseExportImportStatus.RUNNING)
            try {
                val content = withContext(Dispatchers.IO) {
                    context.contentResolver.openInputStream(uri)?.bufferedReader(Charsets.UTF_8)?.readText()
                } ?: run {
                    _menuState.value = _menuState.value.copy(
                        status = ExerciseExportImportStatus.ERROR,
                        errorMessage = "Impossible de lire le fichier",
                    )
                    return@launch
                }
                val result = if (content.trimStart().startsWith("{")) importManager.importExercisesFromJson(content)
                else importManager.importExercisesFromCsv(content)
                _menuState.value = _menuState.value.copy(
                    status = ExerciseExportImportStatus.SUCCESS,
                    importResult = result,
                    errorMessage = result.parseError,
                )
            } catch (e: Exception) {
                _menuState.value = _menuState.value.copy(
                    status = ExerciseExportImportStatus.ERROR,
                    errorMessage = e.message,
                )
            }
        }
    }
}

private fun MuscleGroup.toExerciseCategory() = when (this) {
    MuscleGroup.PECTORAUX -> com.pandafit.core.database.entities.ExerciseCategory.CHEST
    MuscleGroup.DOS,
    MuscleGroup.TRAPEZES,
    MuscleGroup.LOMBAIRES -> com.pandafit.core.database.entities.ExerciseCategory.BACK
    MuscleGroup.EPAULES -> com.pandafit.core.database.entities.ExerciseCategory.SHOULDERS
    MuscleGroup.BICEPS -> com.pandafit.core.database.entities.ExerciseCategory.BICEPS
    MuscleGroup.TRICEPS -> com.pandafit.core.database.entities.ExerciseCategory.TRICEPS
    MuscleGroup.QUADRICEPS, MuscleGroup.ISCHIO,
    MuscleGroup.FESSIERS, MuscleGroup.MOLLETS,
    MuscleGroup.ADDUCTEURS -> com.pandafit.core.database.entities.ExerciseCategory.LEGS
    MuscleGroup.ABDOMINAUX,
    MuscleGroup.OBLIQUES -> com.pandafit.core.database.entities.ExerciseCategory.CORE
    else -> com.pandafit.core.database.entities.ExerciseCategory.OTHER
}
