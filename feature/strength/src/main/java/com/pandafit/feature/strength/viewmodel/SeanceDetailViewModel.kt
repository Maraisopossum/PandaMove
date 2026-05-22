package com.pandafit.feature.strength.viewmodel

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.pandafit.core.database.dao.InstanceSeanceDao
import com.pandafit.core.database.dao.SeanceDao
import com.pandafit.core.database.entities.InstanceSeanceEntity
import com.pandafit.feature.strength.model.SeanceDetailUiState
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.launch
import java.time.LocalDate
import javax.inject.Inject

@HiltViewModel
class SeanceDetailViewModel @Inject constructor(
    savedStateHandle: SavedStateHandle,
    private val seanceDao: SeanceDao,
    private val instanceSeanceDao: InstanceSeanceDao,
) : ViewModel() {

    val seanceId: Long = requireNotNull(savedStateHandle.get<String>("seanceId")?.toLongOrNull())
    private val _uiState = MutableStateFlow(SeanceDetailUiState())
    val uiState: StateFlow<SeanceDetailUiState> = _uiState.asStateFlow()

    init { load() }

    private fun load() {
        // Observation réactive : séance + blocs template + exercices template
        viewModelScope.launch {
            combine(
                seanceDao.observeById(seanceId),
                seanceDao.observeTemplateBlocsForSeance(seanceId),
                seanceDao.observeExercicesForSeance(seanceId),
            ) { seance, blocs, exercices -> Triple(seance, blocs, exercices) }
                .catch { e -> _uiState.value = _uiState.value.copy(isLoading = false, error = e.message) }
                .collect { (seance, blocs, exercices) ->
                    if (seance == null) {
                        _uiState.value = _uiState.value.copy(isLoading = false, error = "Séance introuvable")
                        return@collect
                    }
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        seance = seance,
                        blocs = blocs.sortedBy { it.position },
                        exercices = exercices
                            .filter { it.exerciceSeance.instanceSeanceId == null }
                            .sortedBy { it.exerciceSeance.position },
                    )
                }
        }
        // Instances séparées (déjà réactif)
        viewModelScope.launch {
            instanceSeanceDao.observeForSeance(seanceId)
                .catch { e -> _uiState.value = _uiState.value.copy(error = e.message) }
                .collect { instances -> _uiState.value = _uiState.value.copy(instances = instances) }
        }
    }

    private suspend fun copySeanceToInstance(date: LocalDate) {
        val full = seanceDao.getSeanceFull(seanceId) ?: return
        val instanceId = instanceSeanceDao.insertInstance(InstanceSeanceEntity(seanceId = seanceId, date = date))
        val blocIdMap = mutableMapOf<Long, Long>()
        full.blocs.filter { it.instanceSeanceId == null }.sortedBy { it.position }.forEach { bloc ->
            val newId = seanceDao.insertBloc(bloc.copy(id = 0, instanceSeanceId = instanceId))
            blocIdMap[bloc.id] = newId
        }
        full.exercices.filter { it.exerciceSeance.instanceSeanceId == null }.forEach { exWithEx ->
            val ex = exWithEx.exerciceSeance
            seanceDao.insertExerciceSeance(
                ex.copy(id = 0, instanceSeanceId = instanceId, blocId = ex.blocId?.let { blocIdMap[it] })
            )
        }
    }

    fun createInstance(date: LocalDate) {
        viewModelScope.launch { copySeanceToInstance(date) }
    }

    fun createInstances(dates: Set<LocalDate>) {
        viewModelScope.launch { dates.forEach { copySeanceToInstance(it) } }
    }

    fun createRecurring(startDate: LocalDate, intervalDays: Int, occurrences: Int) {
        viewModelScope.launch {
            (0 until occurrences).forEach { i -> copySeanceToInstance(startDate.plusDays((i * intervalDays).toLong())) }
        }
    }

    fun deleteInstance(instance: InstanceSeanceEntity) {
        viewModelScope.launch {
            seanceDao.deleteBlocsForInstance(instance.id)
            seanceDao.deleteExercicesForInstance(instance.id)
            instanceSeanceDao.deleteInstance(instance)
        }
    }
}
