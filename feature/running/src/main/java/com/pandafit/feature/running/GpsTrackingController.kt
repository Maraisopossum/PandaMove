package com.pandafit.feature.running

interface GpsTrackingController {
    fun start(workoutId: Long, startPaused: Boolean = false)
    fun stop()
    fun startCalibration()
    fun stopCalibration()
    fun pause()
    fun resume()
}
