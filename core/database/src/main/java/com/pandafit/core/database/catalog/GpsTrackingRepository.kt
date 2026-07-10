package com.pandafit.core.database.catalog

import com.pandafit.core.database.dao.GpsTrackPointDao
import com.pandafit.core.database.entities.GpsTrackPointEntity
import com.pandafit.core.database.util.evaluateElevationSample
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import javax.inject.Inject
import javax.inject.Singleton
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.pow
import kotlin.math.sin
import kotlin.math.sqrt

data class LiveTrackState(
    val isTracking: Boolean = false,
    val isPaused: Boolean = false,
    /** null = pas en calibration · Float.MAX_VALUE = calibration en cours · <20f = prêt */
    val calibrationAccuracyM: Float? = null,
    val distanceM: Double = 0.0,
    val durationSec: Int = 0,
    val speedMps: Float = 0f,
    val paceMinkm: Double = 0.0,
    val elevationGainM: Int = 0,
    val points: List<Pair<Double, Double>> = emptyList(),
    /** Aligné sur [points] : true si le segment reliant points[i-1] à points[i] suit un trou de signal GPS */
    val weakSignalAt: List<Boolean> = emptyList(),
    val currentPosition: Pair<Double, Double>? = null,
    /** Nombre de pas détectés par le capteur matériel (TYPE_STEP_DETECTOR) depuis le début du suivi. */
    val stepCount: Int = 0,
)

@Singleton
class GpsTrackingRepository @Inject constructor(
    private val gpsTrackPointDao: GpsTrackPointDao,
) {

    private val _state = MutableStateFlow(LiveTrackState())
    val state: StateFlow<LiveTrackState> = _state.asStateFlow()

    private var workoutId: Long = 0L
    private var pointIndex: Int = 0
    private var startTimeMs: Long = 0L
    private var lastAltitudeM: Double? = null
    @Volatile private var pauseStartMs: Long = 0L
    @Volatile private var totalPausedMs: Long = 0L
    private var lowSpeedStreak: Int = 0
    @Volatile private var isAutoPaused: Boolean = false
    private var lastFixTimestampMs: Long = 0L

    // ── Calibration ──────────────────────────────────────────────────────────

    fun startCalibration() {
        _state.value = _state.value.copy(calibrationAccuracyM = Float.MAX_VALUE)
    }

    fun updateCalibration(lat: Double, lng: Double, accuracyM: Float) {
        _state.value = _state.value.copy(
            calibrationAccuracyM = accuracyM,
            currentPosition = lat to lng,
        )
    }

    fun clearCalibration() {
        _state.value = _state.value.copy(calibrationAccuracyM = null)
    }

    // ── Tracking ─────────────────────────────────────────────────────────────

    fun startTracking(wId: Long) {
        workoutId = wId
        pointIndex = 0
        startTimeMs = System.currentTimeMillis()
        lastAltitudeM = null
        pauseStartMs = 0L
        totalPausedMs = 0L
        lowSpeedStreak = 0
        isAutoPaused = false
        lastFixTimestampMs = 0L
        _state.value = LiveTrackState(isTracking = true)
    }

    suspend fun addPoint(
        lat: Double,
        lng: Double,
        altM: Double?,
        speedMps: Float,
        accuracyM: Float,
        timestampMs: Long,
    ) {
        val currentPos = lat to lng

        // Détection de trou de signal : écart entre deux fix valides (la précision a déjà
        // filtré les mauvais fix en amont dans RunningTrackingService). Mesuré sur chaque fix
        // reçu, y compris ceux ignorés pendant une pause, pour ne pas confondre arrêt et perte de signal.
        val isWeakSignalGap = lastFixTimestampMs > 0L && (timestampMs - lastFixTimestampMs) > SIGNAL_GAP_THRESHOLD_MS
        lastFixTimestampMs = timestampMs

        if (_state.value.isPaused) {
            // Reprise auto uniquement si la pause vient du filtre anti-drift (pas d'une pause manuelle)
            if (isAutoPaused && speedMps >= MIN_MOVING_SPEED_MPS) {
                totalPausedMs += timestampMs - pauseStartMs
                pauseStartMs = 0L
                isAutoPaused = false
                lowSpeedStreak = 0
                _state.value = _state.value.copy(isPaused = false, currentPosition = currentPos)
            } else {
                _state.value = _state.value.copy(currentPosition = currentPos)
                return
            }
        }

        // Filtre anti-drift : sous ce seuil de vitesse pendant plusieurs échantillons,
        // on considère l'utilisateur arrêté (feu rouge, lacet…) et on auto-pause comme Garmin,
        // sinon le bruit GPS stationnaire s'accumule en fausse distance.
        lowSpeedStreak = if (speedMps < MIN_MOVING_SPEED_MPS) lowSpeedStreak + 1 else 0
        if (lowSpeedStreak >= LOW_SPEED_STREAK_SAMPLES) {
            pauseStartMs = timestampMs
            isAutoPaused = true
            _state.value = _state.value.copy(isPaused = true, currentPosition = currentPos)
            return
        }

        val prev = _state.value

        val distIncrement = if (prev.points.isNotEmpty()) {
            val (prevLat, prevLng) = prev.points.last()
            haversineM(prevLat, prevLng, lat, lng)
        } else 0.0

        val elevGain = if (altM != null) {
            val step = evaluateElevationSample(lastAltitudeM, altM)
            lastAltitudeM = step.newBaselineM
            prev.elevationGainM + step.gainDeltaM
        } else prev.elevationGainM

        val totalDist = prev.distanceM + distIncrement
        val durationSec = ((timestampMs - startTimeMs - totalPausedMs) / 1000L).toInt().coerceAtLeast(0)
        val pace = if (speedMps > 0.5f) (1000.0 / speedMps / 60.0) else prev.paceMinkm

        _state.value = LiveTrackState(
            isTracking = true,
            isPaused = false,
            calibrationAccuracyM = null,
            distanceM = totalDist,
            durationSec = durationSec,
            speedMps = speedMps,
            paceMinkm = pace,
            elevationGainM = elevGain,
            points = prev.points + currentPos,
            weakSignalAt = prev.weakSignalAt + isWeakSignalGap,
            currentPosition = currentPos,
        )

        gpsTrackPointDao.insertOne(
            GpsTrackPointEntity(
                workoutId = workoutId,
                pointIndex = pointIndex++,
                latitude = lat,
                longitude = lng,
                altitudeM = altM,
                timestampMs = timestampMs,
                speedMps = speedMps,
                accuracyM = accuracyM,
            )
        )
    }

    /** Un pas détecté par le capteur matériel — ignoré si le suivi est en pause (arrêt réel, pas du bruit). */
    fun addStep() {
        if (!_state.value.isTracking || _state.value.isPaused) return
        _state.value = _state.value.copy(stepCount = _state.value.stepCount + 1)
    }

    fun pauseTracking() {
        pauseStartMs = System.currentTimeMillis()
        isAutoPaused = false
        lowSpeedStreak = 0
        _state.value = _state.value.copy(isPaused = true)
    }

    fun resumeTracking() {
        if (pauseStartMs > 0L) {
            totalPausedMs += System.currentTimeMillis() - pauseStartMs
            pauseStartMs = 0L
        }
        isAutoPaused = false
        lowSpeedStreak = 0
        _state.value = _state.value.copy(isPaused = false)
    }

    fun stopTracking() {
        _state.value = _state.value.copy(isTracking = false)
    }

    fun reset() {
        _state.value = LiveTrackState()
        workoutId = 0L
        pointIndex = 0
        startTimeMs = 0L
        lastAltitudeM = null
        pauseStartMs = 0L
        totalPausedMs = 0L
        lowSpeedStreak = 0
        isAutoPaused = false
        lastFixTimestampMs = 0L
    }

    companion object {
        private const val MIN_MOVING_SPEED_MPS = 0.6f // ~2.2 km/h, sous ce seuil = arrêté
        private const val LOW_SPEED_STREAK_SAMPLES = 3 // échantillons consécutifs avant auto-pause (~3s à 1Hz)
        private const val SIGNAL_GAP_THRESHOLD_MS = 5_000L // au-delà, le segment est marqué signal faible (cadence normale ~1-2s)
    }
}

private fun haversineM(lat1: Double, lng1: Double, lat2: Double, lng2: Double): Double {
    val R = 6_371_000.0
    val phi1 = Math.toRadians(lat1)
    val phi2 = Math.toRadians(lat2)
    val dphi = Math.toRadians(lat2 - lat1)
    val dlambda = Math.toRadians(lng2 - lng1)
    val a = sin(dphi / 2).pow(2) + cos(phi1) * cos(phi2) * sin(dlambda / 2).pow(2)
    return 2 * R * atan2(sqrt(a), sqrt(1 - a))
}
