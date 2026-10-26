package com.pandafit.feature.cycling.viewmodel

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.pandafit.core.common.GpsSessionDefaults
import com.pandafit.core.database.ActiveSessionManager
import com.pandafit.core.database.catalog.GpsTrackingRepository
import com.pandafit.core.database.catalog.LiveTrackState
import com.pandafit.core.database.dao.WorkoutDao
import com.pandafit.core.database.entities.WorkoutEntity
import com.pandafit.core.database.entities.WorkoutType
import com.pandafit.feature.cycling.GpsCyclingController
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter
import javax.inject.Inject

data class CyclingExecuteUiState(
    val isLoading: Boolean = true,
    val workout: WorkoutEntity? = null,
    /** Id réel une fois la séance créée en base (créée seulement au tap "Démarrer" pour une sortie directe). */
    val workoutId: Long? = null,
    val isCompleted: Boolean = false,

    // Champs résultats
    val resultDistanceKm: String = "",
    val resultDurationStr: String = "",       // format "hh:mm:ss" ou "mm:ss"
    val resultSpeedAvgKmh: String = "",       // auto-calculé (GPS ou dist/durée), read-only
    val resultSpeedMaxKmh: String = "",
    val resultHrAvg: String = "",
    val resultHrMax: String = "",
    val resultCadenceAvgRpm: String = "",
    val resultElevationM: String = "",
    val resultCalories: String = "",
    val resultRpe: String = "",
    val resultNotes: String = "",
    /** Secondes restantes du décompte avant démarrage réel du GPS ; null = pas de décompte en cours. */
    val startCountdownSeconds: Int? = null,
)

@HiltViewModel
class CyclingExecuteViewModel @Inject constructor(
    savedStateHandle: SavedStateHandle,
    private val workoutDao: WorkoutDao,
    private val sessionManager: ActiveSessionManager,
    private val gpsTrackingRepository: GpsTrackingRepository,
    private val gpsController: GpsCyclingController,
) : ViewModel() {

    /** 0 = "sortie directe" en brouillon, pas encore créée en base (créée au tap "Démarrer"). */
    private var workoutId: Long = requireNotNull(savedStateHandle.get<String>("workoutId")?.toLongOrNull())
    private var wasAutoCreated: Boolean = false
    private var countdownJob: Job? = null

    private val _uiState = MutableStateFlow(CyclingExecuteUiState())
    val uiState: StateFlow<CyclingExecuteUiState> = _uiState.asStateFlow()

    val liveTrackState: StateFlow<LiveTrackState> = gpsTrackingRepository.state
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), LiveTrackState())

    init {
        if (workoutId > 0L) loadWorkout() else _uiState.value = CyclingExecuteUiState(isLoading = false)
    }

    private fun loadWorkout() {
        viewModelScope.launch {
            val w = workoutDao.getById(workoutId) ?: run {
                _uiState.value = _uiState.value.copy(isLoading = false)
                return@launch
            }
            sessionManager.startWorkout(workoutId, w.name, WorkoutType.CYCLING)
            _uiState.value = CyclingExecuteUiState(
                isLoading           = false,
                workout             = w,
                workoutId           = workoutId,
                resultDistanceKm    = w.resultDistanceKm?.toString() ?: "",
                resultDurationStr   = w.resultDurationSec?.let { formatDurationSec(it) } ?: "",
                resultSpeedAvgKmh   = w.resultSpeedAvgKmh?.let { "%.1f".format(it) } ?: "",
                resultSpeedMaxKmh   = w.resultSpeedMaxKmh?.let { "%.1f".format(it) } ?: "",
                resultHrAvg         = w.resultHrAvg?.toString() ?: "",
                resultHrMax         = w.resultHrMax?.toString() ?: "",
                resultCadenceAvgRpm = w.resultCadenceAvgRpm?.toString() ?: "",
                resultElevationM    = w.resultElevationM?.toString() ?: "",
                resultCalories      = w.resultCalories?.toString() ?: "",
                resultRpe           = w.resultRpe?.toString() ?: "",
                resultNotes         = w.resultNotes,
            )
        }
    }

    /** Crée la séance en base au premier appel (brouillon → réel), idempotent ensuite. */
    private suspend fun ensureWorkoutCreated(): Long {
        if (workoutId > 0L) return workoutId
        val now = LocalDateTime.now()
        val id = workoutDao.insert(
            WorkoutEntity(
                workoutType = WorkoutType.CYCLING,
                name = "Sortie vélo libre",
                isTemplate = false,
                scheduledDate = LocalDate.now(),
                createdAt = now,
                updatedAt = now,
            )
        )
        workoutId = id
        wasAutoCreated = true
        val workout = workoutDao.getById(id)
        sessionManager.startWorkout(id, workout?.name ?: "Sortie vélo libre", WorkoutType.CYCLING)
        _uiState.value = _uiState.value.copy(workout = workout, workoutId = id)
        return id
    }

    // ── GPS tracking ──────────────────────────────────────────────────────────

    fun startCalibration() = gpsController.startCalibration()

    /**
     * Décompte de quelques secondes avant le vrai démarrage (le temps de ranger son téléphone).
     * Le service foreground GPS est démarré tout de suite (pendant que l'app est au premier
     * plan) puis mis en pause le temps du décompte visuel — sinon, si l'écran est verrouillé
     * pendant ces quelques secondes, `startForegroundService()` est appelé alors que l'app est
     * déjà en arrière-plan, ce qu'Android 12+ interdit (crash silencieux, §KNOWN_BUGS.md).
     */
    fun requestStartCountdown() {
        if (countdownJob?.isActive == true) return
        countdownJob = viewModelScope.launch {
            val id = ensureWorkoutCreated()
            gpsController.start(id, startPaused = true)
            for (s in GpsSessionDefaults.START_COUNTDOWN_SECONDS downTo 1) {
                _uiState.value = _uiState.value.copy(startCountdownSeconds = s)
                delay(1_000L)
            }
            _uiState.value = _uiState.value.copy(startCountdownSeconds = null)
            gpsController.resume()
        }
    }

    fun cancelStartCountdown() {
        countdownJob?.cancel()
        countdownJob = null
        _uiState.value = _uiState.value.copy(startCountdownSeconds = null)
        gpsController.stop()
    }

    fun pauseGpsTracking() = gpsController.pause()

    fun resumeGpsTracking() = gpsController.resume()

    // ── Saisie manuelle ───────────────────────────────────────────────────────

    fun updateField(field: String, value: String) {
        val newState = when (field) {
            "distanceKm" -> _uiState.value.copy(resultDistanceKm = value)
            "duration"   -> _uiState.value.copy(resultDurationStr = value)
            "speedMax"   -> _uiState.value.copy(resultSpeedMaxKmh = value)
            "hr"         -> _uiState.value.copy(resultHrAvg = value)
            "hrMax"      -> _uiState.value.copy(resultHrMax = value)
            "cadence"    -> _uiState.value.copy(resultCadenceAvgRpm = value)
            "elevation"  -> _uiState.value.copy(resultElevationM = value)
            "calories"   -> _uiState.value.copy(resultCalories = value)
            "rpe"        -> _uiState.value.copy(resultRpe = value)
            "notes"      -> _uiState.value.copy(resultNotes = value)
            else         -> _uiState.value
        }

        // Recalcul automatique de la vitesse moyenne si distance ou durée change manuellement
        if (field == "distanceKm" || field == "duration") {
            val computed = computeAvgSpeedKmh(
                distStr = if (field == "distanceKm") value else newState.resultDistanceKm,
                durStr  = if (field == "duration")   value else newState.resultDurationStr,
            )
            _uiState.value = newState.copy(resultSpeedAvgKmh = computed ?: newState.resultSpeedAvgKmh)
        } else {
            _uiState.value = newState
        }
    }

    // ── Fin de séance ─────────────────────────────────────────────────────────

    fun finishWorkout() {
        viewModelScope.launch {
            val id = ensureWorkoutCreated()
            val track = liveTrackState.value
            if (track.isTracking) gpsController.stop() else gpsController.stopCalibration()

            // Auto-remplissage depuis le GPS si un tracé a été enregistré
            val s = if (track.distanceM > 0) {
                val distKmStr = "%.3f".format(track.distanceM / 1000.0)
                val durStr    = formatDurationSec(track.durationSec)
                val speedAvg  = computeAvgSpeedKmh(distKmStr, durStr)
                val elevStr   = if (track.elevationGainM > 0) track.elevationGainM.toString()
                                else _uiState.value.resultElevationM
                _uiState.value.copy(
                    resultDistanceKm  = distKmStr,
                    resultDurationStr = durStr,
                    resultSpeedAvgKmh = speedAvg ?: _uiState.value.resultSpeedAvgKmh,
                    resultElevationM  = elevStr,
                )
            } else _uiState.value

            val completedAt = LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME)
            val distKm  = s.resultDistanceKm.replace(",", ".").toDoubleOrNull()
            val durSec  = parseDurationToSec(s.resultDurationStr)
            val speedAvg = s.resultSpeedAvgKmh.replace(",", ".").toDoubleOrNull()
                ?: computeAvgSpeedKmh(s.resultDistanceKm, s.resultDurationStr)?.replace(",", ".")?.toDoubleOrNull()

            workoutDao.saveCyclingResults(
                id         = id,
                distKm     = distKm,
                durSec     = durSec,
                speedAvg   = speedAvg,
                speedMax   = s.resultSpeedMaxKmh.replace(",", ".").toDoubleOrNull(),
                hr         = s.resultHrAvg.toIntOrNull(),
                hrMax      = s.resultHrMax.toIntOrNull(),
                cadence    = s.resultCadenceAvgRpm.toIntOrNull(),
                elevationM = s.resultElevationM.toIntOrNull(),
                calories   = s.resultCalories.toIntOrNull(),
                rpe        = s.resultRpe.toIntOrNull(),
                notes      = s.resultNotes,
                completedAt = completedAt,
            )
            gpsTrackingRepository.reset()
            sessionManager.endWorkout()
            _uiState.value = s.copy(isCompleted = true)
        }
    }

    /**
     * Arrête uniquement la calibration. Ne PAS arrêter le suivi GPS ni libérer la session active
     * ici : le retour arrière (popBackStack) efface ce ViewModel alors que [GpsCyclingController]
     * continue en arrière-plan (foreground service indépendant) — cf. cancelWorkout() pour l'arrêt explicite.
     */
    override fun onCleared() {
        gpsController.stopCalibration()
        super.onCleared()
    }

    /**
     * Annule la sortie en cours (choix "Annuler la séance" au retour arrière) : arrête le suivi GPS,
     * supprime le brouillon "sortie directe" s'il a été créé automatiquement, et libère la session active.
     */
    fun cancelWorkout() {
        viewModelScope.launch {
            if (liveTrackState.value.isTracking) gpsController.stop() else gpsController.stopCalibration()
            gpsTrackingRepository.reset()
            if (wasAutoCreated && workoutId > 0L) workoutDao.deleteById(workoutId)
            sessionManager.endWorkout()
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private fun computeAvgSpeedKmh(distStr: String, durStr: String): String? {
        val dist = distStr.replace(",", ".").toDoubleOrNull() ?: return null
        if (dist <= 0) return null
        val durSec = parseDurationToSec(durStr) ?: return null
        if (durSec <= 0) return null
        return "%.1f".format(dist / (durSec / 3600.0))
    }

    private fun parseDurationToSec(s: String): Int? {
        val parts = s.split(":").mapNotNull { it.toIntOrNull() }
        return when (parts.size) {
            2    -> parts[0] * 60 + parts[1]
            3    -> parts[0] * 3600 + parts[1] * 60 + parts[2]
            else -> s.toIntOrNull()
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
