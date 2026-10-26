package com.pandafit.feature.stats.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.pandafit.feature.stats.model.StatsConfig
import com.pandafit.feature.stats.preferences.StatsPreferences
import com.pandafit.feature.stats.preferences.StatsPreferencesKeys
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class StatsConfigViewModel @Inject constructor(
    private val prefs: StatsPreferences,
) : ViewModel() {

    val config: StateFlow<StatsConfig> = prefs.configFlow
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), StatsConfig())

    fun setRunDist(idx: Int) { viewModelScope.launch { prefs.update(StatsPreferencesKeys.RUN_DIST, idx) } }
    fun setRunSummit(idx: Int) { viewModelScope.launch { prefs.update(StatsPreferencesKeys.RUN_SUMMIT, idx) } }
    fun setStrWeight(idx: Int) { viewModelScope.launch { prefs.update(StatsPreferencesKeys.STR_WEIGHT, idx) } }
    fun setStrMonument(idx: Int) { viewModelScope.launch { prefs.update(StatsPreferencesKeys.STR_MONUMENT, idx) } }
    fun setCycDist(idx: Int) { viewModelScope.launch { prefs.update(StatsPreferencesKeys.CYC_DIST, idx) } }
    fun setCycSummit(idx: Int) { viewModelScope.launch { prefs.update(StatsPreferencesKeys.CYC_SUMMIT, idx) } }
}
