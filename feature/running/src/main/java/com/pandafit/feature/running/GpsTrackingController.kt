package com.pandafit.feature.running

interface GpsTrackingController {
    fun start(workoutId: Long)
    fun stop()
    fun startCalibration()
    fun stopCalibration()
    fun pause()
    fun resume()
}
