package com.pandafit.feature.strength.viewmodel

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.pandafit.core.database.catalog.EquipmentRepository
import com.pandafit.core.database.catalog.MuscleGroup
import com.pandafit.core.database.catalog.muscleToGroup
import com.pandafit.core.database.entities.effectivePrimary
import com.pandafit.core.common.normalizeSearch
import com.pandafit.core.database.catalog.rawEquipmentToCategory
import com.pandafit.core.database.dao.ExerciseDao
import com.pandafit.core.database.dao.SeanceDao
import com.pandafit.core.database.entities.BlocSeanceEntity
import com.pandafit.core.database.entities.BlocType
import com.pandafit.core.database.entities.ExerciceSeanceEntity
import com.pandafit.core.database.entities.ExerciseEntity
import com.pandafit.core.database.entities.RepsType
import com.pandafit.core.database.entities.SeanceCategory
import com.pandafit.core.database.entities.SeanceEntity
import com.pandafit.feature.strength.model.BlocDraft
import com.pandafit.feature.strength.model.ExerciceDraft
import com.pandafit.feature.strength.model.SeanceCreateUiState
import com.pandafit.feature.strength.model.SeanceItem
import kotlinx.coroutines.flow.first
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.LocalDateTime
import javax.inject.Inject

@HiltViewModel
class SeanceCreateViewModel @Inject constructor(
    savedStateHandle: SavedStateHandle,
    private val seanceDao: SeanceDao,
    private val exerciseDao: ExerciseDao,
    private val equipmentRepository: EquipmentRepository,
    @Suppress("UnusedPrivateMember") private val catalogRepository: com.pandafit.core.database.catalog.CatalogRepository,
) : ViewModel() {

    private val seanceId: Long? = savedStateHandle.get<String>("seanceId")?.toLongOrNull()
    private val instanceId: Long? = savedStateHandle.get<String>("instanceId")?.toLongOrNull()
    val isInstanceEdit: Boolean = instanceId != null
    private val _uiState = MutableStateFlow(SeanceCreateUiState())
    val uiState: StateFlow<SeanceCreateUiState> = _uiState.asStateFlow()

    init {
        val seanceCategoryStr: String = savedStateHandle.get<String>("seanceCategory") ?: SeanceCategory.STRENGTH.name
        _uiState.value = _uiState.value.copy(seanceCategory = SeanceCategory.valueOf(seanceCategoryStr))
        if (seanceId != null) loadSeance(seanceId)
        loadAvailableExercises()
    }

    private fun loadSeance(id: Long) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true)
            val full = seanceDao.getSeanceFull(id) ?: return@launch

            // Source des blocs et exercices : instance ou template selon le mode
            val sourceBlocs: List<com.pandafit.core.database.entities.BlocSeanceEntity>
            val exercicesByBloc: Map<Long?, List<com.pandafit.core.database.relations.ExerciceSeanceWithExercise>>
            if (isInstanceEdit && instanceId != null) {
                sourceBlocs = seanceDao.getBlocsForInstance(instanceId)
                exercicesByBloc = seanceDao.getExercicesForInstance(instanceId)
                    .groupBy { it.exerciceSeance.blocId }
            } else {
                sourceBlocs = full.blocs.filter { it.instanceSeanceId == null }
                exercicesByBloc = full.exercices
                    .filter { it.exerciceSeance.instanceSeanceId == null }
                    .groupBy { it.exerciceSeance.blocId }
            }

            fun toExerciceDraft(e: com.pandafit.core.database.relations.ExerciceSeanceWithExercise) = ExerciceDraft(
                id = e.exerciceSeance.id,
                exercise = e.exercise,
                supersetGroupe = e.exerciceSeance.supersetGroupe,
                position = e.exerciceSeance.position,
                nombreSeriesPrevues = e.exerciceSeance.nombreSeriesPrevues,
                repsCibles = e.exerciceSeance.repsCibles,
                repsType = e.exerciceSeance.repsType,
                chargeCible = e.exerciceSeance.chargeCible,
                tempo = e.exerciceSeance.tempo,
                tempsReposSec = e.exerciceSeance.tempsReposSec,
                consigneCle = e.exerciceSeance.consigneCle,
                equipement = e.exerciceSeance.equipement,
                avertissement = e.exerciceSeance.avertissement,
            )

            // Reconstruire la liste unifiée en ordre global (position)
            data class OrderedRaw(val pos: Int, val ex: com.pandafit.core.database.relations.ExerciceSeanceWithExercise? = null, val bloc: com.pandafit.core.database.entities.BlocSeanceEntity? = null)
            val rawItems = mutableListOf<OrderedRaw>()
            (exercicesByBloc[null] ?: emptyList()).forEach { ex ->
                rawItems.add(OrderedRaw(ex.exerciceSeance.position, ex = ex))
            }
            sourceBlocs.forEach { bloc ->
                rawItems.add(OrderedRaw(bloc.position, bloc = bloc))
            }
            rawItems.sortBy { it.pos }

            val items = rawItems.map { raw ->
                if (raw.ex != null) {
                    SeanceItem.FreeExercise(toExerciceDraft(raw.ex))
                } else {
                    val bloc = raw.bloc!!
                    SeanceItem.Bloc(
                        run {
                            val exercicesBloc = (exercicesByBloc[bloc.id] ?: emptyList())
                                .sortedBy { it.exerciceSeance.position }
                                .map { toExerciceDraft(it) }
                            // Pour un CIRCUIT, récupérer le nombre de séries centralisé depuis le premier exercice
                            val seriesCentralises = if (bloc.type == BlocType.CIRCUIT)
                                exercicesBloc.firstOrNull()?.nombreSeriesPrevues ?: 3
                            else 3
                            BlocDraft(
                                id = bloc.id,
                                nom = bloc.nom,
                                type = bloc.type,
                                dureeMin = bloc.dureeMin,
                                description = bloc.description,
                                tempsReposInterSec = bloc.tempsReposInterSec,
                                tempsReposFinRoundSec = bloc.tempsReposFinRoundSec,
                                exercices = exercicesBloc,
                                nombreSeriesPrevues = seriesCentralises,
                            )
                        }
                    )
                }
            }

            _uiState.value = _uiState.value.copy(
                isLoading = false,
                isNew = false,
                nom = full.seance.nom,
                notes = full.seance.notes,
                dureeEstimeeMin = full.seance.dureeEstimeeMin,
                seanceCategory = full.seance.seanceCategory,
                items = items,
            )
        }
    }

    private fun loadAvailableExercises() {
        viewModelScope.launch {
            exerciseDao.observeAll().collect { exercises ->
                _uiState.value = _uiState.value.copy(availableExercises = exercises)
            }
        }
    }

    // ===== Séance =====
    fun updateNom(nom: String) { _uiState.value = _uiState.value.copy(nom = nom) }
    fun updateNotes(notes: String) { _uiState.value = _uiState.value.copy(notes = notes) }
    fun updateDuree(min: Int) { _uiState.value = _uiState.value.copy(dureeEstimeeMin = min) }

    // ===== Items (liste unifiée) =====

    fun addBloc(type: BlocType) {
        val items = _uiState.value.items.toMutableList()
        items.add(SeanceItem.Bloc(BlocDraft(nom = type.defaultName(), type = type)))
        _uiState.value = _uiState.value.copy(items = items)
    }

    fun updateItem(index: Int, updated: SeanceItem) {
        val items = _uiState.value.items.toMutableList()
        if (index in items.indices) { items[index] = updated; _uiState.value = _uiState.value.copy(items = items) }
    }

    fun removeItem(index: Int) {
        val items = _uiState.value.items.toMutableList()
        if (index in items.indices) { items.removeAt(index); _uiState.value = _uiState.value.copy(items = items) }
    }

    fun moveItemUp(index: Int) {
        val items = _uiState.value.items.toMutableList()
        if (index > 0 && index in items.indices) {
            val tmp = items[index - 1]; items[index - 1] = items[index]; items[index] = tmp
            _uiState.value = _uiState.value.copy(items = items)
        }
    }

    fun moveItemDown(index: Int) {
        val items = _uiState.value.items.toMutableList()
        if (index < items.size - 1 && index in items.indices) {
            val tmp = items[index + 1]; items[index + 1] = items[index]; items[index] = tmp
            _uiState.value = _uiState.value.copy(items = items)
        }
    }

    // ===== Exercices dans un bloc =====

    fun showExercisePickerFree() {
        _uiState.value = _uiState.value.copy(showExercisePicker = true, pickerTargetItemIndex = -1)
    }

    fun showExercisePicker(itemIndex: Int) {
        _uiState.value = _uiState.value.copy(showExercisePicker = true, pickerTargetItemIndex = itemIndex)
    }

    fun hideExercisePicker() {
        _uiState.value = _uiState.value.copy(showExercisePicker = false, exercisePickerQuery = "")
    }

    fun updatePickerQuery(query: String) {
        _uiState.value = _uiState.value.copy(exercisePickerQuery = query)
    }

    fun addExercise(exercise: ExerciseEntity) {
        val state = _uiState.value
        val items = state.items.toMutableList()
        val targetIdx = state.pickerTargetItemIndex

        if (targetIdx < 0) {
            items.add(SeanceItem.FreeExercise(ExerciceDraft(exercise = exercise)))
        } else if (targetIdx in items.indices && items[targetIdx] is SeanceItem.Bloc) {
            val bloc = (items[targetIdx] as SeanceItem.Bloc).bloc
            val newExercice = ExerciceDraft(
                exercise = exercise,
                position = bloc.exercices.size,
                repsType = if (bloc.type == BlocType.CIRCUIT) RepsType.DURATION else RepsType.REPS,
            )
            items[targetIdx] = SeanceItem.Bloc(bloc.copy(exercices = bloc.exercices + newExercice))
        }
        _uiState.value = state.copy(items = items, showExercisePicker = false, exercisePickerQuery = "")
    }

    // ===== Multi-sélection =====

    fun toggleExerciseMultiSelect(exerciseId: Long) {
        val current = _uiState.value.multiSelectedIds.toMutableSet()
        if (exerciseId in current) current.remove(exerciseId) else current.add(exerciseId)
        _uiState.value = _uiState.value.copy(multiSelectedIds = current)
    }

    fun confirmMultiSelection() {
        val state = _uiState.value
        // Respecter l'ordre de sélection de l'utilisateur (multiSelectedIds = LinkedHashSet,
        // insertion order préservée). Ne pas utiliser filter sur availableExercises car
        // l'ordre alphabétique DB (ORDER BY name ASC) peut différer de l'ordre de sélection
        // (ex : "É" de "Élévations" sort après "F" de "Face pull" en UTF-8 binaire).
        val exercisesById = state.availableExercises.associateBy { it.id }
        val selected = state.multiSelectedIds.mapNotNull { id -> exercisesById[id] }
        if (selected.isEmpty()) { _uiState.value = state.copy(showExercisePicker = false, multiSelectedIds = emptySet(), exercisePickerQuery = ""); return }
        val items = state.items.toMutableList()
        val targetIdx = state.pickerTargetItemIndex
        selected.forEach { exercise ->
            if (targetIdx < 0) {
                items.add(SeanceItem.FreeExercise(ExerciceDraft(exercise = exercise)))
            } else if (targetIdx in items.indices && items[targetIdx] is SeanceItem.Bloc) {
                val bloc = (items[targetIdx] as SeanceItem.Bloc).bloc
                val ex = ExerciceDraft(
                    exercise = exercise,
                    position = bloc.exercices.size,
                    repsType = if (bloc.type == BlocType.CIRCUIT) RepsType.DURATION else RepsType.REPS,
                )
                items[targetIdx] = SeanceItem.Bloc(bloc.copy(exercices = bloc.exercices + ex))
            }
        }
        _uiState.value = state.copy(items = items, showExercisePicker = false, multiSelectedIds = emptySet(), exercisePickerQuery = "", pickerGroupFilter = null)
    }

    fun setPickerGroupFilter(group: MuscleGroup?) {
        _uiState.value = _uiState.value.copy(pickerGroupFilter = group)
    }

    fun togglePickerOnlyAvailable() {
        _uiState.value = _uiState.value.copy(pickerOnlyAvailable = !_uiState.value.pickerOnlyAvailable)
    }

    fun filteredPickerExercises(): List<ExerciseEntity> {
        val state = _uiState.value
        return state.availableExercises.filter { ex ->
            val matchesQuery = state.exercisePickerQuery.isBlank() || ex.name.normalizeSearch().contains(state.exercisePickerQuery.normalizeSearch())
            val matchesGroup = state.pickerGroupFilter == null ||
                ex.muscleGroups.any { muscleToGroup(it) == state.pickerGroupFilter }
            val matchesEquip = !state.pickerOnlyAvailable || run {
                val required = ex.equipment.mapNotNull { rawEquipmentToCategory(it) }.toSet()
                required.isEmpty() ||
                    required == setOf(com.pandafit.core.database.catalog.EquipmentCategory.POIDS_DE_CORPS) ||
                    state.userEquipment.containsAll(required)
            }
            matchesQuery && matchesGroup && matchesEquip
        }
    }

    init {
        viewModelScope.launch {
            equipmentRepository.selectedEquipment.collect { equipment ->
                _uiState.value = _uiState.value.copy(userEquipment = equipment)
            }
        }
    }

    fun updateExerciceInBloc(itemIndex: Int, exerciceIndex: Int, updated: ExerciceDraft) {
        val items = _uiState.value.items.toMutableList()
        if (itemIndex in items.indices && items[itemIndex] is SeanceItem.Bloc) {
            val bloc = (items[itemIndex] as SeanceItem.Bloc).bloc
            val exercices = bloc.exercices.toMutableList()
            if (exerciceIndex in exercices.indices) {
                // Bloc CIRCUIT : repsType toujours forcé à DURATION
                val safe = if (bloc.type == BlocType.CIRCUIT) updated.copy(repsType = RepsType.DURATION) else updated
                exercices[exerciceIndex] = safe
                items[itemIndex] = SeanceItem.Bloc(bloc.copy(exercices = exercices))
                _uiState.value = _uiState.value.copy(items = items)
            }
        }
    }

    fun moveExerciceInBloc(itemIndex: Int, exerciceIndex: Int, delta: Int) {
        val items = _uiState.value.items.toMutableList()
        if (itemIndex !in items.indices || items[itemIndex] !is SeanceItem.Bloc) return
        val bloc = (items[itemIndex] as SeanceItem.Bloc).bloc
        val exercices = bloc.exercices.toMutableList()
        val targetIdx = exerciceIndex + delta
        if (targetIdx !in exercices.indices) return
        val tmp = exercices[exerciceIndex]; exercices[exerciceIndex] = exercices[targetIdx]; exercices[targetIdx] = tmp
        items[itemIndex] = SeanceItem.Bloc(bloc.copy(exercices = exercices))
        _uiState.value = _uiState.value.copy(items = items)
    }

    fun removeExerciceFromBloc(itemIndex: Int, exerciceIndex: Int) {
        val items = _uiState.value.items.toMutableList()
        if (itemIndex in items.indices && items[itemIndex] is SeanceItem.Bloc) {
            val bloc = (items[itemIndex] as SeanceItem.Bloc).bloc
            val exercices = bloc.exercices.toMutableList()
            if (exerciceIndex in exercices.indices) {
                exercices.removeAt(exerciceIndex)
                items[itemIndex] = SeanceItem.Bloc(bloc.copy(exercices = exercices))
                _uiState.value = _uiState.value.copy(items = items)
            }
        }
    }

    fun updateFreeExercice(itemIndex: Int, updated: ExerciceDraft) {
        val items = _uiState.value.items.toMutableList()
        if (itemIndex in items.indices && items[itemIndex] is SeanceItem.FreeExercise) {
            items[itemIndex] = SeanceItem.FreeExercise(updated)
            _uiState.value = _uiState.value.copy(items = items)
        }
    }

    // ===== Sauvegarde =====
    fun save() {
        val state = _uiState.value
        if (state.nom.isBlank() && !isInstanceEdit) { _uiState.value = state.copy(error = "Nom requis"); return }

        // Valider les durées des exercices de blocs CIRCUIT
        val circuitSansTemps = state.items
            .filterIsInstance<SeanceItem.Bloc>()
            .filter { it.bloc.type == BlocType.CIRCUIT }
            .flatMap { it.bloc.exercices }
            .filter { ex -> (ex.repsCibles.toIntOrNull() ?: 0) <= 0 }
        if (circuitSansTemps.isNotEmpty()) {
            val noms = circuitSansTemps.joinToString(", ") { it.exercise.name }
            _uiState.value = state.copy(error = "Durée manquante pour : $noms")
            return
        }

        viewModelScope.launch {
            _uiState.value = state.copy(isSaving = true)
            try {
                val savedId: Long
                if (isInstanceEdit) {
                    // Mode instance : ne jamais toucher la SeanceEntity template
                    savedId = seanceId ?: run {
                        _uiState.value = _uiState.value.copy(isSaving = false, error = "Séance introuvable")
                        return@launch
                    }
                    updateExistingSeanceContent(savedId, state)
                } else {
                    val now = LocalDateTime.now()
                    val seanceEntity = SeanceEntity(
                        id = seanceId ?: 0,
                        nom = state.nom.trim(),
                        notes = state.notes.trim(),
                        dureeEstimeeMin = state.dureeEstimeeMin,
                        seanceCategory = state.seanceCategory,
                        updatedAt = now,
                    )
                    savedId = if (state.isNew) seanceDao.insertSeance(seanceEntity)
                    else { seanceDao.updateSeance(seanceEntity.copy(id = seanceId!!)); seanceId!! }
                    if (state.isNew) saveNewSeanceContent(savedId, state)
                    else updateExistingSeanceContent(savedId, state)
                }

                _uiState.value = _uiState.value.copy(isSaving = false, isNew = false, savedSeanceId = savedId)
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(isSaving = false, error = e.message)
            }
        }
    }

    private suspend fun saveNewSeanceContent(savedId: Long, state: SeanceCreateUiState) {
        state.items.forEachIndexed { globalPos, item ->
            when (item) {
                is SeanceItem.FreeExercise -> {
                    seanceDao.insertExerciceSeance(toEntity(savedId, null, globalPos, item.exercice, if (isInstanceEdit) instanceId else null))
                }
                is SeanceItem.Bloc -> {
                    val blocId = seanceDao.insertBloc(toBlocEntity(savedId, globalPos, item.bloc))
                    item.bloc.exercices.forEachIndexed { eIdx, exDraft ->
                        val exEffectif = if (item.bloc.type == BlocType.CIRCUIT)
                            exDraft.copy(nombreSeriesPrevues = item.bloc.nombreSeriesPrevues)
                        else exDraft
                        seanceDao.insertExerciceSeance(toEntity(savedId, blocId, eIdx, exEffectif, if (isInstanceEdit) instanceId else null))
                    }
                }
            }
        }
    }

    private suspend fun updateExistingSeanceContent(savedId: Long, state: SeanceCreateUiState) {
        // Filtrer selon le mode : template (null) ou instance spécifique (instanceId)
        val targetInstanceId = if (isInstanceEdit) instanceId else null
        val existingExercices = seanceDao.getExercicesForSeance(savedId)
            .filter { it.exerciceSeance.instanceSeanceId == targetInstanceId }
        val existingBlocsMap = seanceDao.getBlocsForSeance(savedId)
            .filter { it.instanceSeanceId == targetInstanceId }
            .associateBy { it.id }

        val draftExerciceIds = mutableSetOf<Long>()
        val draftBlocIds = mutableSetOf<Long>()

        state.items.forEachIndexed { globalPos, item ->
            when (item) {
                is SeanceItem.FreeExercise -> {
                    val exDraft = item.exercice
                    if (exDraft.id != 0L) {
                        draftExerciceIds.add(exDraft.id)
                        seanceDao.updateExerciceSeance(toEntity(savedId, null, globalPos, exDraft, if (isInstanceEdit) instanceId else null).copy(id = exDraft.id))
                    } else {
                        seanceDao.insertExerciceSeance(toEntity(savedId, null, globalPos, exDraft, if (isInstanceEdit) instanceId else null))
                    }
                }
                is SeanceItem.Bloc -> {
                    val blocDraft = item.bloc
                    val blocId: Long
                    if (blocDraft.id != 0L) {
                        draftBlocIds.add(blocDraft.id)
                        seanceDao.updateBloc(toBlocEntity(savedId, globalPos, blocDraft).copy(id = blocDraft.id))
                        blocId = blocDraft.id
                    } else {
                        blocId = seanceDao.insertBloc(toBlocEntity(savedId, globalPos, blocDraft))
                    }
                    blocDraft.exercices.forEachIndexed { eIdx, exDraft ->
                        // Pour les circuits : propager le nombre de séries centralisé du bloc à chaque exercice
                        val exEffectif = if (blocDraft.type == BlocType.CIRCUIT)
                            exDraft.copy(nombreSeriesPrevues = blocDraft.nombreSeriesPrevues)
                        else exDraft
                        if (exEffectif.id != 0L) {
                            draftExerciceIds.add(exEffectif.id)
                            seanceDao.updateExerciceSeance(toEntity(savedId, blocId, eIdx, exEffectif, if (isInstanceEdit) instanceId else null).copy(id = exEffectif.id))
                        } else {
                            seanceDao.insertExerciceSeance(toEntity(savedId, blocId, eIdx, exEffectif, if (isInstanceEdit) instanceId else null))
                        }
                    }
                }
            }
        }

        existingExercices.forEach { ex ->
            if (ex.exerciceSeance.id !in draftExerciceIds) {
                seanceDao.deleteExerciceSeance(ex.exerciceSeance)
            }
        }
        existingBlocsMap.values.forEach { bloc ->
            if (bloc.id !in draftBlocIds) {
                seanceDao.deleteBloc(bloc)
            }
        }
    }

    private fun toBlocEntity(seanceId: Long, position: Int, d: BlocDraft) = BlocSeanceEntity(
        seanceId = seanceId,
        nom = d.nom,
        type = d.type,
        position = position,
        dureeMin = d.dureeMin,
        description = d.description,
        tempsReposInterSec = d.tempsReposInterSec,
        tempsReposFinRoundSec = d.tempsReposFinRoundSec,
        instanceSeanceId = if (isInstanceEdit) instanceId else null,
    )

    fun clearError() { _uiState.value = _uiState.value.copy(error = null) }

    fun updateSeanceCategory(category: SeanceCategory) {
        _uiState.value = _uiState.value.copy(seanceCategory = category)
    }

    fun showWarmupPicker() {
        if (isInstanceEdit) return // pas d'échauffement en mode édition d'instance
        viewModelScope.launch {
            val warmups = seanceDao.observeAllWarmups().first()
            _uiState.value = _uiState.value.copy(availableWarmups = warmups, showWarmupPicker = true)
        }
    }

    fun hideWarmupPicker() { _uiState.value = _uiState.value.copy(showWarmupPicker = false) }

    fun addWarmupToSeance(warmupId: Long) {
        viewModelScope.launch {
            val full = seanceDao.getSeanceFull(warmupId) ?: return@launch
            val exercices = full.exercices
                .sortedBy { it.exerciceSeance.position }
                .map { e ->
                    ExerciceDraft(
                        id = 0, exercise = e.exercise, position = 0,
                        nombreSeriesPrevues = e.exerciceSeance.nombreSeriesPrevues,
                        repsCibles = e.exerciceSeance.repsCibles,
                        repsType = e.exerciceSeance.repsType,
                        chargeCible = e.exerciceSeance.chargeCible,
                        tempsReposSec = e.exerciceSeance.tempsReposSec,
                    )
                }
            val warmupBloc = SeanceItem.Bloc(BlocDraft(
                id = 0,
                nom = full.seance.nom,
                type = BlocType.ECHAUFFEMENT,
                exercices = exercices,
            ))
            val current = _uiState.value.items.toMutableList()
            current.add(0, warmupBloc)
            _uiState.value = _uiState.value.copy(items = current, showWarmupPicker = false)
        }
    }
}

private fun toEntity(seanceId: Long, blocId: Long?, position: Int, d: ExerciceDraft, instanceSeanceId: Long? = null) =
    ExerciceSeanceEntity(
        seanceId = seanceId,
        exerciceId = d.exercise.id,
        blocId = blocId,
        supersetGroupe = d.supersetGroupe,
        position = position,
        nombreSeriesPrevues = d.nombreSeriesPrevues,
        repsCibles = d.repsCibles,
        repsType = d.repsType,
        chargeCible = d.chargeCible,
        tempo = d.tempo,
        tempsReposSec = d.tempsReposSec,
        consigneCle = d.consigneCle,
        equipement = d.equipement,
        avertissement = d.avertissement,
        instanceSeanceId = instanceSeanceId,
    )

fun BlocType.defaultName() = when (this) {
    BlocType.ECHAUFFEMENT -> "Échauffement"
    BlocType.SUPERSET -> "Superset"
    BlocType.CIRCUIT -> "Circuit"
    BlocType.RECUPERATION -> "Récupération"
}

fun BlocType.displayName() = defaultName()
