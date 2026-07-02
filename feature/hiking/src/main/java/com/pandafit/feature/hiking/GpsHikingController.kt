package com.pandafit.feature.hiking

interface GpsHikingController {
    fun start(workoutId: Long)
    fun stop()
    fun startCalibration()
    fun stopCalibration()
    fun pause()
    fun resume()
}
