package com.pandafit.feature.hiking.viewmodel

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.pandafit.core.common.GpsSessionDefaults
import com.pandafit.core.database.ActiveSessionManager
import com.pandafit.core.database.analysis.SplitMetric
import com.pandafit.core.database.analysis.computeAvailableMetrics
import com.pandafit.core.database.analysis.computeDistanceSplitAnalysis
import com.pandafit.core.database.analysis.computeDistanceSplitAnalysisFromLaps
import com.pandafit.core.database.analysis.computeFeedback
import com.pandafit.core.database.analysis.computeMascotVariant
import com.pandafit.core.database.analysis.computeSignatureMetric
import com.pandafit.core.database.catalog.GpsTrackingRepository
import com.pandafit.core.database.catalog.LiveTrackState
import com.pandafit.core.database.catalog.UserPreferencesRepository
import com.pandafit.core.database.dao.GpsTrackPointDao
import com.pandafit.core.database.dao.RunRepeatDao
import com.pandafit.core.database.dao.WorkoutDao
import com.pandafit.core.database.entities.WorkoutEntity
import com.pandafit.core.database.entities.WorkoutType
import com.pandafit.core.database.model.IntervalRepResult
import com.pandafit.feature.hiking.GpsHikingController
import com.pandafit.feature.hiking.model.HikingDetailUiState
import com.pandafit.feature.hiking.model.HikingExecuteUiState
import com.pandafit.feature.hiking.model.HikingListUiState
import com.pandafit.feature.hiking.model.HikingReportUiState
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import kotlinx.serialization.json.Json
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter
import java.util.Locale
import javax.inject.Inject

private val reportJson = Json { ignoreUnknownKeys = true }

@HiltViewModel
class HikingListViewModel @Inject constructor(
    private val workoutDao: WorkoutDao,
    private val gpsDao: GpsTrackPointDao,
) : ViewModel() {

    private val _uiState = MutableStateFlow(HikingListUiState())
    val uiState: StateFlow<HikingListUiState> = _uiState.asStateFlow()

    init { observe() }

    private fun observe() {
        viewModelScope.launch {
            workoutDao.observeCompletedByType(WorkoutType.HIKING)
                .map { completed ->
                    // Requête groupée (pas une par carte) pour la miniature de parcours.
                    val thumbnails = if (completed.isEmpty()) emptyMap() else {
                        gpsDao.getByWorkoutIds(completed.map { it.id })
                            .groupBy({ it.workoutId }, { Pair(it.latitude, it.longitude) })
                    }
                    completed to thumbnails
                }
                .catch { e -> _uiState.value = _uiState.value.copy(isLoading = false, error = e.message) }
                // Préserver quickStartWorkoutId : Room peut émettre entre l'insert et la mise à jour de l'état
                .collect { (completed, thumbnails) ->
                    _uiState.value = HikingListUiState(
                        isLoading = false,
                        completed = completed,
                        routeThumbnails = thumbnails,
                        quickStartWorkoutId = _uiState.value.quickStartWorkoutId,
                    )
                }
        }
    }

    fun delete(id: Long) = viewModelScope.launch { workoutDao.deleteById(id) }

    /**
     * "Randonnée directe" : navigue vers l'exécution GPS en mode brouillon, sans créer de séance
     * en base. La séance n'est créée qu'au tap "Démarrer" (voir [HikingExecuteViewModel]), pour
     * éviter les lignes orphelines si l'utilisateur quitte sans avoir démarré le suivi GPS.
     */
    fun quickStartFreeHike() {
        _uiState.value = _uiState.value.copy(quickStartWorkoutId = 0L)
    }

    /** À appeler une fois la navigation effectuée, pour ne pas redéclencher l'effet. */
    fun onQuickStartHandled() {
        _uiState.value = _uiState.value.copy(quickStartWorkoutId = null)
    }
}

@HiltViewModel
class HikingDetailViewModel @Inject constructor(
    private val workoutDao: WorkoutDao,
) : ViewModel() {

    private val _uiState = MutableStateFlow(HikingDetailUiState())
    val uiState: StateFlow<HikingDetailUiState> = _uiState.asStateFlow()

    private val dateFmt = DateTimeFormatter.ofPattern("dd/MM/yyyy", Locale.FRENCH)

    fun load(workoutId: Long) {
        viewModelScope.launch {
            val w = workoutDao.getById(workoutId) ?: return@launch
            val durationSec = w.resultDurationSec ?: 0
            _uiState.value = HikingDetailUiState(
                isLoading = false,
                workoutId = workoutId,
                name = w.name,
                dateStr = w.scheduledDate.format(dateFmt),
                distanceKm = w.resultDistanceKm?.let { "%.2f".format(it) } ?: "",
                durationH = "${durationSec / 3600}",
                durationMin = "${(durationSec % 3600) / 60}",
                elevationM = w.resultElevationM?.toString() ?: "",
                speedKmh = w.resultSpeedAvgKmh?.let { "%.1f".format(it) } ?: "",
                hrAvg = w.resultHrAvg?.toString() ?: "",
                rpe = w.resultRpe?.toString() ?: "",
                notes = w.resultNotes,
            )
        }
    }

    fun initNew() {
        _uiState.value = HikingDetailUiState(
            isLoading = false,
            dateStr = LocalDate.now().format(dateFmt),
        )
    }

    fun update(block: HikingDetailUiState.() -> HikingDetailUiState) {
        _uiState.value = _uiState.value.block()
    }

    fun save() {
        val s = _uiState.value
        if (s.name.isBlank()) {
            _uiState.value = s.copy(error = "Le nom est requis")
            return
        }
        val date = runCatching { LocalDate.parse(s.dateStr, dateFmt) }.getOrElse {
            _uiState.value = s.copy(error = "Date invalide (format jj/mm/aaaa)")
            return
        }
        val durationSec = ((s.durationH.toIntOrNull() ?: 0) * 3600) + ((s.durationMin.toIntOrNull() ?: 0) * 60)
        val distanceKm = s.distanceKm.replace(',', '.').toDoubleOrNull()
        val speedKmh = s.speedKmh.replace(',', '.').toDoubleOrNull()
            ?: if (distanceKm != null && durationSec > 0) distanceKm / (durationSec / 3600.0) else null

        _uiState.value = s.copy(isSaving = true, error = null)
        viewModelScope.launch {
            val now = LocalDateTime.now()
            val id = if (s.workoutId != null) {
                val existing = workoutDao.getById(s.workoutId) ?: return@launch
                workoutDao.update(
                    existing.copy(
                        name = s.name,
                        scheduledDate = date,
                        updatedAt = now,
                        resultDistanceKm = distanceKm,
                        resultDurationSec = durationSec.takeIf { it > 0 },
                        resultElevationM = s.elevationM.toIntOrNull(),
                        resultSpeedAvgKmh = speedKmh,
                        resultHrAvg = s.hrAvg.toIntOrNull(),
                        resultRpe = s.rpe.toIntOrNull(),
                        resultNotes = s.notes,
                    )
                )
                s.workoutId
            } else {
                workoutDao.insert(
                    WorkoutEntity(
                        workoutType = WorkoutType.HIKING,
                        name = s.name,
                        scheduledDate = date,
                        isCompleted = true,
                        completedAt = now,
                        createdAt = now,
                        updatedAt = now,
                        resultDistanceKm = distanceKm,
                        resultDurationSec = durationSec.takeIf { it > 0 },
                        resultElevationM = s.elevationM.toIntOrNull(),
                        resultSpeedAvgKmh = speedKmh,
                        resultHrAvg = s.hrAvg.toIntOrNull(),
                        resultRpe = s.rpe.toIntOrNull(),
                        resultNotes = s.notes,
                    )
                )
            }
            _uiState.value = _uiState.value.copy(isSaving = false, savedId = id)
        }
    }
}

@HiltViewModel
class HikingReportViewModel @Inject constructor(
    private val workoutDao: WorkoutDao,
    private val gpsDao: GpsTrackPointDao,
    private val repeatDao: RunRepeatDao,
    private val userPreferencesRepository: UserPreferencesRepository,
) : ViewModel() {

    private val _uiState = MutableStateFlow(HikingReportUiState())
    val uiState: StateFlow<HikingReportUiState> = _uiState.asStateFlow()

    fun load(workoutId: Long) {
        viewModelScope.launch {
            val workout = workoutDao.getById(workoutId) ?: run {
                _uiState.value = HikingReportUiState(isLoading = false)
                return@launch
            }

            val gpsTrackPoints = gpsDao.getByWorkout(workoutId).sortedBy { it.pointIndex }
            val gpsPoints = gpsTrackPoints.map { Pair(it.latitude, it.longitude) }
            val reps: List<IntervalRepResult> = repeatDao.getByWorkout(workoutId)
                .filter { it.resultsJson.isNotBlank() }
                .flatMap { runCatching { reportJson.decodeFromString<List<IntervalRepResult>>(it.resultsJson) }.getOrDefault(emptyList()) }
            val isFemale = userPreferencesRepository.genderFlow.first() == "FEMALE"

            _uiState.value = HikingReportUiState(
                isLoading = false,
                workout = workout,
                gpsPoints = gpsPoints,
                signatureMetric = computeSignatureMetric(workout),
                feedback = computeFeedback(workout, hasIntervals = false),
                availableMetrics = computeAvailableMetrics(workout),
                mascotVariant = computeMascotVariant(isFemale),
                splitAnalysis = computeDistanceSplitAnalysis(gpsTrackPoints, SplitMetric.SPEED_KMH)
                    ?: computeDistanceSplitAnalysisFromLaps(reps, gpsTrackPoints, SplitMetric.SPEED_KMH),
            )
        }
    }

    fun delete(workoutId: Long, onDone: () -> Unit) {
        viewModelScope.launch {
            workoutDao.deleteById(workoutId)
            onDone()
        }
    }
}

/**
 * Exécution GPS live d'une "Randonnée directe" — même base que RunningExecuteViewModel,
 * mais sans étapes/répétitions structurées (la rando libre n'a pas de plan à l'avance).
 */
@HiltViewModel
class HikingExecuteViewModel @Inject constructor(
    savedStateHandle: SavedStateHandle,
    private val workoutDao: WorkoutDao,
    private val sessionManager: ActiveSessionManager,
    private val gpsTrackingRepository: GpsTrackingRepository,
    private val gpsTrackingController: GpsHikingController,
) : ViewModel() {

    /** 0 = "randonnée directe" en brouillon, pas encore créée en base (créée au tap "Démarrer"). */
    private var workoutId: Long = requireNotNull(savedStateHandle.get<String>("workoutId")?.toLongOrNull())
    private var countdownJob: Job? = null
    private val _uiState = MutableStateFlow(HikingExecuteUiState())
    val uiState: StateFlow<HikingExecuteUiState> = _uiState.asStateFlow()

    val liveTrackState: StateFlow<LiveTrackState> = gpsTrackingRepository.state
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), LiveTrackState())

    init {
        if (workoutId > 0L) loadWorkout() else _uiState.value = HikingExecuteUiState(isLoading = false)
    }

    private fun loadWorkout() {
        viewModelScope.launch {
            val workout = workoutDao.getById(workoutId) ?: return@launch
            sessionManager.startWorkout(workoutId, workout.name, WorkoutType.HIKING)
            _uiState.value = HikingExecuteUiState(
                isLoading = false,
                workout = workout,
                workoutId = workoutId,
                resultDistanceKm = workout.resultDistanceKm?.toString() ?: "",
                resultDurationStr = workout.resultDurationSec?.let { formatDurationSec(it) } ?: "",
                resultSpeedKmh = workout.resultSpeedAvgKmh?.let { "%.1f".format(it) } ?: "",
                resultElevationM = workout.resultElevationM?.toString() ?: "",
                resultHrAvg = workout.resultHrAvg?.toString() ?: "",
                resultHrMax = workout.resultHrMax?.toString() ?: "",
                resultRpe = workout.resultRpe?.toString() ?: "",
                resultCalories = workout.resultCalories?.toString() ?: "",
                resultNotes = workout.resultNotes,
            )
        }
    }

    /** Crée la séance en base au premier appel (brouillon → réel), idempotent ensuite. */
    private suspend fun ensureWorkoutCreated(): Long {
        if (workoutId > 0L) return workoutId
        val now = LocalDateTime.now()
        val id = workoutDao.insert(
            WorkoutEntity(
                workoutType = WorkoutType.HIKING,
                name = "Randonnée libre",
                isTemplate = false,
                scheduledDate = LocalDate.now(),
                createdAt = now,
                updatedAt = now,
            )
        )
        workoutId = id
        val workout = workoutDao.getById(id)
        sessionManager.startWorkout(id, workout?.name ?: "Randonnée libre", WorkoutType.HIKING)
        _uiState.value = _uiState.value.copy(workout = workout, workoutId = id)
        return id
    }

    // ── GPS tracking ──────────────────────────────────────────────────────────

    fun startCalibration() = gpsTrackingController.startCalibration()
    fun startGpsTracking() {
        viewModelScope.launch {
            val id = ensureWorkoutCreated()
            gpsTrackingController.start(id)
        }
    }
    /** Décompte de quelques secondes avant le vrai démarrage (le temps de ranger son téléphone). */
    fun requestStartCountdown() {
        if (countdownJob?.isActive == true) return
        countdownJob = viewModelScope.launch {
            for (s in GpsSessionDefaults.START_COUNTDOWN_SECONDS downTo 1) {
                _uiState.value = _uiState.value.copy(startCountdownSeconds = s)
                delay(1_000L)
            }
            _uiState.value = _uiState.value.copy(startCountdownSeconds = null)
            startGpsTracking()
        }
    }

    fun cancelStartCountdown() {
        countdownJob?.cancel()
        countdownJob = null
        _uiState.value = _uiState.value.copy(startCountdownSeconds = null)
    }

    fun pauseGpsTracking() = gpsTrackingController.pause()
    fun resumeGpsTracking() = gpsTrackingController.resume()

    // ── Résultats (édition manuelle) ────────────────────────────────────────────

    fun updateOverallResult(field: String, value: String) {
        val s = _uiState.value
        val newState = when (field) {
            "distanceKm" -> s.copy(resultDistanceKm = value)
            "duration"   -> s.copy(resultDurationStr = value)
            "speed"      -> s.copy(resultSpeedKmh = value)
            "elevation"  -> s.copy(resultElevationM = value)
            "hr"         -> s.copy(resultHrAvg = value)
            "hrMax"      -> s.copy(resultHrMax = value)
            "rpe"        -> s.copy(resultRpe = value)
            "calories"   -> s.copy(resultCalories = value)
            "notes"      -> s.copy(resultNotes = value)
            else         -> s
        }
        _uiState.value = if (field == "distanceKm" || field == "duration") {
            val computed = computeSpeedKmh(newState.resultDistanceKm, newState.resultDurationStr)
            if (computed != null) newState.copy(resultSpeedKmh = computed) else newState
        } else newState
    }

    private fun computeSpeedKmh(distanceKm: String, durationStr: String): String? {
        val dist = distanceKm.replace(",", ".").toDoubleOrNull() ?: return null
        if (dist <= 0) return null
        val durSec = parseDurationToSec(durationStr) ?: return null
        if (durSec <= 0) return null
        return "%.1f".format(dist / (durSec / 3600.0))
    }

    // ── Finish ────────────────────────────────────────────────────────────────

    fun finishWorkout() {
        viewModelScope.launch {
            val id = ensureWorkoutCreated()
            val track = liveTrackState.value
            if (track.isTracking) gpsTrackingController.stop() else gpsTrackingController.stopCalibration()

            val s = if (track.distanceM > 0) {
                val distKmStr = "%.3f".format(track.distanceM / 1000.0)
                val durStr = formatDurationSec(track.durationSec)
                val speedStr = computeSpeedKmh(distKmStr, durStr) ?: _uiState.value.resultSpeedKmh
                val elevStr = if (track.elevationGainM > 0) track.elevationGainM.toString() else _uiState.value.resultElevationM
                _uiState.value.copy(
                    resultDistanceKm = distKmStr,
                    resultDurationStr = durStr,
                    resultSpeedKmh = speedStr,
                    resultElevationM = elevStr,
                )
            } else _uiState.value

            val now = LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME)

            workoutDao.saveCyclingResults(
                id = id,
                distKm = s.resultDistanceKm.replace(",", ".").toDoubleOrNull(),
                durSec = parseDurationToSec(s.resultDurationStr),
                speedAvg = s.resultSpeedKmh.replace(",", ".").toDoubleOrNull(),
                speedMax = null,
                hr = s.resultHrAvg.toIntOrNull(),
                hrMax = s.resultHrMax.toIntOrNull(),
                cadence = null,
                elevationM = s.resultElevationM.toIntOrNull(),
                calories = s.resultCalories.toIntOrNull(),
                rpe = s.resultRpe.toIntOrNull(),
                notes = s.resultNotes,
                completedAt = now,
            )

            gpsTrackingRepository.reset()
            sessionManager.endWorkout()
            _uiState.value = s.copy(isCompleted = true)
        }
    }

    override fun onCleared() {
        gpsTrackingController.stopCalibration()
        sessionManager.endWorkout()
        super.onCleared()
    }

    private fun parseDurationToSec(str: String): Int? {
        val parts = str.split(":").mapNotNull { it.toIntOrNull() }
        return when (parts.size) {
            2    -> parts[0] * 60 + parts[1]
            3    -> parts[0] * 3600 + parts[1] * 60 + parts[2]
            else -> str.toIntOrNull()
        }
    }
}

private fun formatDurationSec(totalSec: Int): String {
    val h = totalSec / 3600
    val m = (totalSec % 3600) / 60
    val s = totalSec % 60
    return if (h > 0) "$h:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}"
    else "$m:${s.toString().padStart(2, '0')}"
}
