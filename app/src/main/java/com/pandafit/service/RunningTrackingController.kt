package com.pandafit.service

import android.annotation.SuppressLint
import android.content.Context
import android.os.Looper
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.pandafit.core.database.catalog.GpsTrackingRepository
import com.pandafit.feature.running.GpsTrackingController
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject

class RunningTrackingController @Inject constructor(
    @ApplicationContext private val context: Context,
    private val gpsTrackingRepository: GpsTrackingRepository,
) : GpsTrackingController {

    private var calibFusedClient: FusedLocationProviderClient? = null
    private var calibCallback: LocationCallback? = null

    @SuppressLint("MissingPermission")
    override fun startCalibration() {
        gpsTrackingRepository.startCalibration()
        val client = LocationServices.getFusedLocationProviderClient(context)
        calibFusedClient = client
        val cb = object : LocationCallback() {
            override fun onLocationResult(result: LocationResult) {
                result.lastLocation?.let { loc ->
                    gpsTrackingRepository.updateCalibration(loc.latitude, loc.longitude, loc.accuracy)
                }
            }
        }
        calibCallback = cb
        val request = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 1_000L).build()
        client.requestLocationUpdates(request, cb, Looper.getMainLooper())
    }

    override fun stopCalibration() {
        calibCallback?.let { calibFusedClient?.removeLocationUpdates(it) }
        calibCallback = null
        calibFusedClient = null
        gpsTrackingRepository.clearCalibration()
    }

    override fun start(workoutId: Long) {
        stopCalibration()
        RunningTrackingService.start(context, workoutId)
    }

    override fun stop() = RunningTrackingService.stop(context)

    override fun pause() = gpsTrackingRepository.pauseTracking()

    override fun resume() = gpsTrackingRepository.resumeTracking()
}
