package com.pandafit.feature.profile.viewmodel

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
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
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
    private val exerciseDao: ExerciseDao,
    private val equipmentRepository: EquipmentRepository,
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
    fun setNewName(n: String) { _dialogState.value = _dialogState.value.copy(name = n) }
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
