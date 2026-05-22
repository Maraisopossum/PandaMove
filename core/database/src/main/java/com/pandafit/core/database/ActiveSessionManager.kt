package com.pandafit.core.database

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class ActiveSessionManager @Inject constructor() {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    private val _activeInstanceId = MutableStateFlow<Long?>(null)
    val activeInstanceId: StateFlow<Long?> = _activeInstanceId.asStateFlow()

    private val _sessionSeconds = MutableStateFlow(0)
    val sessionSeconds: StateFlow<Int> = _sessionSeconds.asStateFlow()

    private val _activeSeanceName = MutableStateFlow<String?>(null)
    val activeSeanceName: StateFlow<String?> = _activeSeanceName.asStateFlow()

    private val _restRemaining = MutableStateFlow(0)
    val restRemaining: StateFlow<Int> = _restRemaining.asStateFlow()

    private val _restFinishedEvent = MutableSharedFlow<Unit>(extraBufferCapacity = 1)
    val restFinishedEvent: SharedFlow<Unit> = _restFinishedEvent.asSharedFlow()

    private val _restCountdownBeep = MutableSharedFlow<Int>(extraBufferCapacity = 5)
    val restCountdownBeep: SharedFlow<Int> = _restCountdownBeep.asSharedFlow()

    private var timerJob: Job? = null
    private var restJob: Job? = null

    fun startSession(instanceId: Long, seanceName: String, initialSeconds: Int = 0) {
        if (_activeInstanceId.value == instanceId) return  // déjà actif
        _activeInstanceId.value = instanceId
        _activeSeanceName.value = seanceName
        _sessionSeconds.value = initialSeconds
        startTimer()
    }

    fun resumeSession(instanceId: Long, seanceName: String, currentSeconds: Int) {
        _activeInstanceId.value = instanceId
        _activeSeanceName.value = seanceName
        _sessionSeconds.value = currentSeconds
        if (timerJob?.isActive != true) startTimer()
    }

    fun endSession() {
        timerJob?.cancel()
        restJob?.cancel()
        timerJob = null
        _activeInstanceId.value = null
        _activeSeanceName.value = null
        _sessionSeconds.value = 0
        _restRemaining.value = 0
    }

    fun startRestTimer(seconds: Int) {
        restJob?.cancel()
        _restRemaining.value = seconds
        restJob = scope.launch {
            while (_restRemaining.value > 0) {
                delay(1000L)
                val newVal = (_restRemaining.value - 1).coerceAtLeast(0)
                _restRemaining.value = newVal
                if (newVal in 1..5) _restCountdownBeep.tryEmit(newVal)
            }
            _restFinishedEvent.tryEmit(Unit)
        }
    }

    fun adjustRestTimer(delta: Int) {
        val newVal = (_restRemaining.value + delta).coerceAtLeast(0)
        _restRemaining.value = newVal
        if (newVal == 0) restJob?.cancel()
    }

    fun stopRestTimer() {
        restJob?.cancel()
        _restRemaining.value = 0
    }

    fun syncSeconds(seconds: Int) {
        _sessionSeconds.value = seconds
    }

    private fun startTimer() {
        timerJob?.cancel()
        timerJob = scope.launch {
            while (true) {
                delay(1000L)
                _sessionSeconds.value++
            }
        }
    }
}
