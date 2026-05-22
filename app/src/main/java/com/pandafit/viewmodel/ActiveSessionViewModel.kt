package com.pandafit.viewmodel

import androidx.lifecycle.ViewModel
import com.pandafit.core.database.ActiveSessionManager
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject

@HiltViewModel
class ActiveSessionViewModel @Inject constructor(
    val manager: ActiveSessionManager,
) : ViewModel() {
    val activeInstanceId = manager.activeInstanceId
    val sessionSeconds = manager.sessionSeconds
    val activeSeanceName = manager.activeSeanceName
    val restRemaining = manager.restRemaining
    val restFinishedEvent = manager.restFinishedEvent
    val restCountdownBeep = manager.restCountdownBeep
}
