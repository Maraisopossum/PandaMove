package com.pandafit.feature.cycling.viewmodel

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.pandafit.core.database.analysis.DistanceSplitAnalysis
import com.pandafit.core.database.analysis.MascotVariant
import com.pandafit.core.database.analysis.MetricItem
import com.pandafit.core.database.analysis.SignatureMetric
import com.pandafit.core.database.analysis.SplitMetric
import com.pandafit.core.database.analysis.WorkoutFeedback
import com.pandafit.core.database.analysis.computeAvailableMetrics
import com.pandafit.core.database.analysis.computeDistanceSplitAnalysis
import com.pandafit.core.database.analysis.computeDistanceSplitAnalysisFromLaps
import com.pandafit.core.database.analysis.computeFeedback
import com.pandafit.core.database.analysis.computeMascotVariant
import com.pandafit.core.database.analysis.computeSignatureMetric
import com.pandafit.core.database.catalog.UserPreferencesRepository
import com.pandafit.core.database.dao.GpsTrackPointDao
import com.pandafit.core.database.dao.RunRepeatDao
import com.pandafit.core.database.dao.WorkoutBlockDao
import com.pandafit.core.database.dao.WorkoutDao
import com.pandafit.core.database.entities.BlockType
import com.pandafit.core.database.entities.WorkoutBlockEntity
import com.pandafit.core.database.entities.WorkoutEntity
import com.pandafit.core.database.model.IntervalRepResult
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.serialization.json.Json
import javax.inject.Inject

data class CyclingReportUiState(
    val isLoading: Boolean = true,
    val workout: WorkoutEntity? = null,
    val blocks: List<WorkoutBlockEntity> = emptyList(),
    val gpsPoints: List<Pair<Double, Double>> = emptyList(),
    val signatureMetric: SignatureMetric? = null,
    val feedback: WorkoutFeedback? = null,
    val availableMetrics: List<MetricItem> = emptyList(),
    val mascotVariant: MascotVariant = MascotVariant.JOY_MALE,
    /** Analyse "sortie libre" (vitesse + dénivelé par split) — null si aucune donnée exploitable (pas de GPS ni de laps). */
    val splitAnalysis: DistanceSplitAnalysis? = null,
)

private val json = Json { ignoreUnknownKeys = true }

@HiltViewModel
class CyclingReportViewModel @Inject constructor(
    savedStateHandle: SavedStateHandle,
    private val workoutDao: WorkoutDao,
    private val blockDao: WorkoutBlockDao,
    private val gpsDao: GpsTrackPointDao,
    private val repeatDao: RunRepeatDao,
    private val userPreferencesRepository: UserPreferencesRepository,
) : ViewModel() {

    val workoutId: Long = requireNotNull(savedStateHandle.get<String>("workoutId")?.toLongOrNull())

    private val _uiState = MutableStateFlow(CyclingReportUiState())
    val uiState: StateFlow<CyclingReportUiState> = _uiState.asStateFlow()

    init { load() }

    fun reload() { load() }

    private fun load() {
        viewModelScope.launch {
            val withBlocks = workoutDao.getWithBlocksById(workoutId) ?: run {
                _uiState.value = _uiState.value.copy(isLoading = false)
                return@launch
            }
            val workout = withBlocks.workout
            val blocks = withBlocks.blocks.sortedBy { it.position }
            val hasIntervals = blocks.any { it.blockType == BlockType.INTERVAL }

            val gpsTrackPoints = gpsDao.getByWorkout(workoutId).sortedBy { it.pointIndex }
            val gpsPoints = gpsTrackPoints.map { Pair(it.latitude, it.longitude) }
            val reps: List<IntervalRepResult> = repeatDao.getByWorkout(workoutId)
                .filter { it.resultsJson.isNotBlank() }
                .flatMap { runCatching { json.decodeFromString<List<IntervalRepResult>>(it.resultsJson) }.getOrDefault(emptyList()) }
            val isFemale = userPreferencesRepository.genderFlow.first() == "FEMALE"

            _uiState.value = CyclingReportUiState(
                isLoading = false,
                workout = workout,
                blocks = blocks,
                gpsPoints = gpsPoints,
                signatureMetric = computeSignatureMetric(workout),
                feedback = computeFeedback(workout, hasIntervals),
                availableMetrics = computeAvailableMetrics(workout),
                mascotVariant = computeMascotVariant(isFemale),
                splitAnalysis = computeDistanceSplitAnalysis(gpsTrackPoints, SplitMetric.SPEED_KMH)
                    ?: computeDistanceSplitAnalysisFromLaps(reps, gpsTrackPoints, SplitMetric.SPEED_KMH),
            )
        }
    }
}
