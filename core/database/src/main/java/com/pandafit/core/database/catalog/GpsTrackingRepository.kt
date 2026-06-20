package com.pandafit.core.database.catalog

import com.pandafit.core.database.dao.GpsTrackPointDao
import com.pandafit.core.database.entities.GpsTrackPointEntity
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
    val currentPosition: Pair<Double, Double>? = null,
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

        if (_state.value.isPaused) {
            _state.value = _state.value.copy(currentPosition = currentPos)
            return
        }

        val prev = _state.value

        val distIncrement = if (prev.points.isNotEmpty()) {
            val (prevLat, prevLng) = prev.points.last()
            haversineM(prevLat, prevLng, lat, lng)
        } else 0.0

        val elevGain = if (altM != null && lastAltitudeM != null && altM > lastAltitudeM!!) {
            prev.elevationGainM + (altM - lastAltitudeM!!).toInt()
        } else prev.elevationGainM
        lastAltitudeM = altM

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

    fun pauseTracking() {
        pauseStartMs = System.currentTimeMillis()
        _state.value = _state.value.copy(isPaused = true)
    }

    fun resumeTracking() {
        if (pauseStartMs > 0L) {
            totalPausedMs += System.currentTimeMillis() - pauseStartMs
            pauseStartMs = 0L
        }
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
