package com.pandafit.feature.hiking

interface GpsHikingController {
    fun start(workoutId: Long, startPaused: Boolean = false)
    fun stop()
    fun startCalibration()
    fun stopCalibration()
    fun pause()
    fun resume()
}
