package com.pandafit.feature.strength.viewmodel

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.pandafit.core.database.dao.InstanceSeanceDao
import com.pandafit.core.database.dao.ObjectifProgressionDao
import com.pandafit.core.database.dao.SeanceDao
import com.pandafit.core.database.entities.InstanceSeanceEntity
import com.pandafit.feature.strength.model.SeanceDetailUiState
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
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
    private val objectifProgressionDao: ObjectifProgressionDao,
) : ViewModel() {

    val seanceId: Long = requireNotNull(savedStateHandle.get<String>("seanceId")?.toLongOrNull())
    private val _uiState = MutableStateFlow(SeanceDetailUiState())
    val uiState: StateFlow<SeanceDetailUiState> = _uiState.asStateFlow()

    /** Émis après startNow() pour naviguer vers l'instance créée. */
    private val _navigateToInstance = MutableSharedFlow<Long>(extraBufferCapacity = 1)
    val navigateToInstance: SharedFlow<Long> = _navigateToInstance.asSharedFlow()

    init { load(); loadProgression() }

    // Surcharge progressive : objectifs courants (réactif) + tendance des dernières charges réalisées
    // (calculée une fois depuis l'historique cross-séance déjà exploité pour le pré-remplissage)
    private fun loadProgression() {
        viewModelScope.launch {
            objectifProgressionDao.observeAllForSeance(seanceId).collect { objectifs ->
                _uiState.value = _uiState.value.copy(objectifsParExercice = objectifs.associateBy { it.exerciceId })
            }
        }
        viewModelScope.launch {
            val full = seanceDao.getSeanceFull(seanceId) ?: return@launch
            val exerciseIds = full.exercices
                .filter { it.exerciceSeance.instanceSeanceId == null && it.exerciceSeance.progressionActivee }
                .map { it.exercise.id }
                .distinct()
            val tendances = exerciseIds.mapNotNull { exerciseId ->
                val parDate = instanceSeanceDao.getHistoriqueForExercise(exerciseId, currentInstanceId = -1)
                    .groupBy { it.instanceDate }
                    .mapNotNull { (date, rows) ->
                        val charges = rows.mapNotNull { it.chargeKg }
                        if (charges.isEmpty()) null else date to charges.average().toFloat()
                    }
                    .sortedBy { it.first }
                    .takeLast(4)
                    .map { it.second }
                if (parDate.isEmpty()) null else exerciseId to parDate
            }.toMap()
            _uiState.value = _uiState.value.copy(tendanceParExercice = tendances)
        }
    }

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

    private suspend fun copySeanceToInstance(date: LocalDate): Long {
        val full = seanceDao.getSeanceFull(seanceId) ?: return -1
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
        return instanceId
    }

    fun createInstance(date: LocalDate) {
        viewModelScope.launch { copySeanceToInstance(date) }
    }

    /** Crée une instance à la date du jour et émet son id pour navigation immédiate vers l'exécution. */
    fun startNow() {
        viewModelScope.launch {
            val instanceId = copySeanceToInstance(LocalDate.now())
            if (instanceId > 0) _navigateToInstance.tryEmit(instanceId)
        }
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
