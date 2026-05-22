package com.pandafit.feature.strength.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.pandafit.core.database.dao.WorkoutDao
import com.pandafit.core.database.entities.WorkoutType
import com.pandafit.feature.strength.model.StrengthListUiState
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class StrengthListViewModel @Inject constructor(
    private val workoutDao: WorkoutDao,
) : ViewModel() {

    private val _uiState = MutableStateFlow(StrengthListUiState())
    val uiState: StateFlow<StrengthListUiState> = _uiState.asStateFlow()

    init {
        viewModelScope.launch {
            workoutDao.observeByType(WorkoutType.STRENGTH)
                .catch { e -> _uiState.value = _uiState.value.copy(error = e.message) }
                .collect { workouts ->
                    _uiState.value = StrengthListUiState(isLoading = false, workouts = workouts)
                }
        }
    }

    fun deleteWorkout(id: Long) {
        viewModelScope.launch { workoutDao.deleteById(id) }
    }
}
