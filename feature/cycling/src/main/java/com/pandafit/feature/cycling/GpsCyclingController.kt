package com.pandafit.feature.cycling

interface GpsCyclingController {
    fun start(workoutId: Long, startPaused: Boolean = false)
    fun stop()
    fun startCalibration()
    fun stopCalibration()
    fun pause()
    fun resume()
}
