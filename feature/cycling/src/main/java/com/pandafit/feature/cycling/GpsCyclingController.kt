package com.pandafit.feature.cycling

interface GpsCyclingController {
    fun start(workoutId: Long)
    fun stop()
    fun startCalibration()
    fun stopCalibration()
    fun pause()
    fun resume()
}
