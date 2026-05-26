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
)

// ===== État du dialogue d'édition =====

data class EditDialogState(
    val visible: Boolean = false,
    val exercise: ExerciseEntity? = null,
    val muscles: List<MuscleGroup> = emptyList(),
    val equipment: Set<EquipmentCategory> = emptySet(),
    val exerciseType: String = "",
)

@HiltViewModel
class ExerciseCatalogViewModel @Inject constructor(
    private val exerciseDao: ExerciseDao,
    private val equipmentRepository: EquipmentRepository,
    @Suppress("UnusedPrivateMember") private val catalogRepository: CatalogRepository,
) : ViewModel() {

    // ===== Filtres (dans le combine) =====
    private val _query = MutableStateFlow("")
    private val _selectedGroup = MutableStateFlow<MuscleGroup?>(null)
    private val _onlyAvailable = MutableStateFlow(false)

    // ===== Dialogue de création (combine séparé) =====
    private val _showCreate = MutableStateFlow(false)
    private val _newName = MutableStateFlow("")
    private val _newMuscles = MutableStateFlow<List<MuscleGroup>>(emptyList())
    private val _newEquipment = MutableStateFlow<Set<EquipmentCategory>>(emptySet())

    // ===== Dialogue d'édition =====
    private val _showEdit = MutableStateFlow(false)
    private val _editTarget = MutableStateFlow<ExerciseEntity?>(null)
    private val _editMuscles = MutableStateFlow<List<MuscleGroup>>(emptyList())
    private val _editEquipment = MutableStateFlow<Set<EquipmentCategory>>(emptySet())
    private val _editExerciseType = MutableStateFlow("")

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

    // StateFlow 2 : état du dialogue de création
    val dialogState: StateFlow<CreateDialogState> = combine(
        _showCreate,
        _newName,
        _newMuscles,
        _newEquipment,
    ) { show, name, muscles, equip ->
        CreateDialogState(visible = show, name = name, muscles = muscles, equipment = equip)
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), CreateDialogState())

    // StateFlow 3 : état du dialogue d'édition
    val editDialogState: StateFlow<EditDialogState> = combine(
        _showEdit,
        _editTarget,
        _editMuscles,
        _editEquipment,
        _editExerciseType,
    ) { show, target, muscles, equip, type ->
        EditDialogState(visible = show, exercise = target, muscles = muscles, equipment = equip, exerciseType = type)
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), EditDialogState())

    // ===== Filtres =====
    fun setQuery(q: String) { _query.value = q }
    fun setGroup(g: MuscleGroup?) { _selectedGroup.value = g }
    fun toggleOnlyAvailable() { _onlyAvailable.value = !_onlyAvailable.value }

    // ===== Dialogue création =====
    fun openCreate() {
        _newName.value = ""
        _newMuscles.value = emptyList()
        _newEquipment.value = emptySet()
        _showCreate.value = true
    }
    fun closeCreate() { _showCreate.value = false }
    fun setNewName(n: String) { _newName.value = n }
    fun toggleNewMuscle(g: MuscleGroup) {
        val current = _newMuscles.value.toMutableList()
        if (g in current) current.remove(g) else current.add(g)
        _newMuscles.value = current
    }
    fun toggleNewEquipment(cat: EquipmentCategory) {
        val current = _newEquipment.value.toMutableSet()
        if (cat in current) current.remove(cat) else current.add(cat)
        _newEquipment.value = current
    }

    fun createCustomExercise() {
        val name = _newName.value.trim()
        if (name.isBlank()) return
        val muscles = _newMuscles.value
        val primaryGroup = muscles.firstOrNull()
        val musclePrimary = primaryGroup?.label ?: ""
        val muscleLabels = muscles.map { it.label }
        val equipmentLabels = _newEquipment.value.map { it.label }
        viewModelScope.launch {
            exerciseDao.insertExercise(
                ExerciseEntity(
                    name = name,
                    category = primaryGroup?.toExerciseCategory()
                        ?: com.pandafit.core.database.entities.ExerciseCategory.OTHER,
                    musclePrimary = musclePrimary,
                    muscleGroups = muscleLabels,
                    equipment = equipmentLabels,
                    isCustom = true,
                ),
            )
            _showCreate.value = false
        }
    }

    fun deleteCustomExercise(exercise: ExerciseEntity) {
        if (!exercise.isCustom) return
        viewModelScope.launch { exerciseDao.deleteExercise(exercise) }
    }

    // ===== Dialogue édition =====
    fun openEdit(exercise: ExerciseEntity) {
        _editTarget.value = exercise
        _editMuscles.value = exercise.muscleGroups.map { raw ->
            MuscleGroup.entries.find { it.label.equals(raw, ignoreCase = true) }
                ?: muscleToGroup(raw)
        }.distinct()
        _editEquipment.value = exercise.equipment.mapNotNull { raw ->
            EquipmentCategory.entries.find { it.label.equals(raw, ignoreCase = true) }
                ?: rawEquipmentToCategory(raw)
        }.toSet()
        _editExerciseType.value = exercise.exerciseType
        _showEdit.value = true
    }

    fun closeEdit() { _showEdit.value = false }

    fun toggleEditMuscle(g: MuscleGroup) {
        val current = _editMuscles.value.toMutableList()
        if (g in current) current.remove(g) else current.add(g)
        _editMuscles.value = current
    }

    fun toggleEditEquipment(cat: EquipmentCategory) {
        val current = _editEquipment.value.toMutableSet()
        if (cat in current) current.remove(cat) else current.add(cat)
        _editEquipment.value = current
    }

    fun setEditExerciseType(type: String) { _editExerciseType.value = type }

    fun saveEdit() {
        val target = _editTarget.value ?: return
        val muscles = _editMuscles.value
        val primaryGroup = muscles.firstOrNull()
        viewModelScope.launch {
            exerciseDao.updateExercise(
                target.copy(
                    muscleGroups = muscles.map { it.label },
                    musclePrimary = primaryGroup?.label ?: "",
                    category = primaryGroup?.toExerciseCategory()
                        ?: com.pandafit.core.database.entities.ExerciseCategory.OTHER,
                    equipment = _editEquipment.value.map { it.label },
                    exerciseType = _editExerciseType.value,
                )
            )
            _showEdit.value = false
        }
    }
}

private fun MuscleGroup.toExerciseCategory() = when (this) {
    MuscleGroup.PECTORAUX -> com.pandafit.core.database.entities.ExerciseCategory.CHEST
    MuscleGroup.DOS -> com.pandafit.core.database.entities.ExerciseCategory.BACK
    MuscleGroup.EPAULES -> com.pandafit.core.database.entities.ExerciseCategory.SHOULDERS
    MuscleGroup.BICEPS -> com.pandafit.core.database.entities.ExerciseCategory.BICEPS
    MuscleGroup.TRICEPS -> com.pandafit.core.database.entities.ExerciseCategory.TRICEPS
    MuscleGroup.QUADRICEPS, MuscleGroup.ISCHIO,
    MuscleGroup.FESSIERS, MuscleGroup.MOLLETS -> com.pandafit.core.database.entities.ExerciseCategory.LEGS
    MuscleGroup.ABDOMINAUX -> com.pandafit.core.database.entities.ExerciseCategory.CORE
    else -> com.pandafit.core.database.entities.ExerciseCategory.OTHER
}
