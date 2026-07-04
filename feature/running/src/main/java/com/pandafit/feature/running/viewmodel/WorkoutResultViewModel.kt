package com.pandafit.feature.running.viewmodel

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.pandafit.core.database.catalog.UserPreferencesRepository
import com.pandafit.core.database.dao.GpsTrackPointDao
import com.pandafit.core.database.dao.RunRepeatDao
import com.pandafit.core.database.dao.RunStepDao
import com.pandafit.core.database.dao.WorkoutDao
import com.pandafit.core.database.entities.RunStepType
import com.pandafit.core.database.entities.WorkoutEntity
import com.pandafit.core.database.model.IntervalRepResult
import com.pandafit.feature.running.model.MascotVariant
import com.pandafit.feature.running.model.MetricItem
import com.pandafit.feature.running.model.RunRepeatExecution
import com.pandafit.feature.running.model.SignatureMetric
import com.pandafit.feature.running.model.WorkoutFeedback
import com.pandafit.feature.running.model.IntervalAnalysis
import com.pandafit.feature.running.model.computeAvailableMetrics
import com.pandafit.feature.running.model.computeFeedback
import com.pandafit.feature.running.model.computeIntervalAnalysis
import com.pandafit.feature.running.model.computeMascotVariant
import com.pandafit.feature.running.model.computeSignatureMetric
import com.pandafit.feature.running.model.hasRealIntervals
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.serialization.json.Json
import javax.inject.Inject

data class WorkoutResultUiState(
    val isLoading: Boolean = true,
    val workout: WorkoutEntity? = null,
    val hasIntervals: Boolean = false,
    val repeatBlocks: List<RunRepeatExecution> = emptyList(),
    val signatureMetric: SignatureMetric? = null,
    val feedback: WorkoutFeedback? = null,
    val availableMetrics: List<MetricItem> = emptyList(),
    val gpsPoints: List<Pair<Double, Double>> = emptyList(),
    val mascotVariant: MascotVariant = MascotVariant.JOY_MALE,
    val intervalAnalysis: IntervalAnalysis? = null,
)

private val json = Json { ignoreUnknownKeys = true }

@HiltViewModel
class WorkoutResultViewModel @Inject constructor(
    savedStateHandle: SavedStateHandle,
    private val workoutDao: WorkoutDao,
    private val stepDao: RunStepDao,
    private val repeatDao: RunRepeatDao,
    private val gpsDao: GpsTrackPointDao,
    private val userPreferencesRepository: UserPreferencesRepository,
) : ViewModel() {

    private val workoutId: Long = requireNotNull(savedStateHandle.get<String>("workoutId")?.toLongOrNull())

    private val _uiState = MutableStateFlow(WorkoutResultUiState())
    val uiState: StateFlow<WorkoutResultUiState> = _uiState.asStateFlow()

    init { load() }

    private fun load() {
        viewModelScope.launch {
            val workout = workoutDao.getById(workoutId) ?: return@launch
            val repeats = repeatDao.getByWorkout(workoutId)
            val allSteps = stepDao.getByWorkout(workoutId)

            val repeatBlocks = repeats.sortedBy { it.position }.map { rep ->
                val childSteps = allSteps.filter { it.repeatId == rep.id }.sortedBy { it.position }
                val targetStep = childSteps.firstOrNull { it.stepType == RunStepType.RUNNING }
                    ?: childSteps.firstOrNull()
                val recoveryStep = childSteps.firstOrNull {
                    it.stepType == RunStepType.RECOVERY || it.stepType == RunStepType.REST || it.stepType == RunStepType.WALKING
                }
                val reps: List<IntervalRepResult> = if (rep.resultsJson.isNotBlank()) {
                    runCatching { json.decodeFromString<List<IntervalRepResult>>(rep.resultsJson) }.getOrDefault(emptyList())
                } else emptyList()
                RunRepeatExecution(repeat = rep, targetStep = targetStep, recoveryStep = recoveryStep, reps = reps)
            }

            val hasIntervals = hasRealIntervals(repeatBlocks)
            val isFemale = userPreferencesRepository.genderFlow.first() == "FEMALE"

            val gpsPoints = gpsDao.getByWorkout(workoutId)
                .sortedBy { it.pointIndex }
                .map { Pair(it.latitude, it.longitude) }

            _uiState.value = WorkoutResultUiState(
                isLoading = false,
                workout = workout,
                hasIntervals = hasIntervals,
                repeatBlocks = repeatBlocks,
                signatureMetric = computeSignatureMetric(workout),
                feedback = computeFeedback(workout, hasIntervals),
                availableMetrics = computeAvailableMetrics(workout),
                gpsPoints = gpsPoints,
                mascotVariant = computeMascotVariant(isFemale),
                intervalAnalysis = if (hasIntervals) computeIntervalAnalysis(repeatBlocks) else null,
            )
        }
    }
}
