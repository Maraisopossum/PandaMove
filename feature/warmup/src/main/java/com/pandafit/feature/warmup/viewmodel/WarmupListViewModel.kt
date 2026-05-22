package com.pandafit.feature.warmup.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.pandafit.core.database.dao.InstanceSeanceDao
import com.pandafit.core.database.dao.SeanceDao
import com.pandafit.core.database.entities.SeanceCategory
import com.pandafit.core.database.entities.SeanceEntity
import com.pandafit.core.database.entities.InstanceSeanceEntity
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.launch
import javax.inject.Inject

data class WarmupListUiState(
    val isLoading: Boolean = true,
    val selectedCategory: SeanceCategory = SeanceCategory.WARMUP_GENERAL,
    val warmupsByCategory: Map<SeanceCategory, List<SeanceEntity>> = emptyMap(),
    val instances: List<InstanceSeanceEntity> = emptyList(),
)

@HiltViewModel
class WarmupListViewModel @Inject constructor(
    private val seanceDao: SeanceDao,
    private val instanceSeanceDao: InstanceSeanceDao,
) : ViewModel() {

    private val _uiState = MutableStateFlow(WarmupListUiState())
    val uiState: StateFlow<WarmupListUiState> = _uiState.asStateFlow()

    init { load() }

    private fun load() {
        viewModelScope.launch {
            combine(
                seanceDao.observeAllWarmups(),
                instanceSeanceDao.observeAll(),
            ) { warmups, instances ->
                val byCategory = warmups.groupBy { it.seanceCategory }
                WarmupListUiState(
                    isLoading = false,
                    selectedCategory = _uiState.value.selectedCategory,
                    warmupsByCategory = byCategory,
                    instances = instances,
                )
            }.collect { _uiState.value = it }
        }
    }

    fun selectCategory(cat: SeanceCategory) {
        _uiState.value = _uiState.value.copy(selectedCategory = cat)
    }

    fun deleteSeance(id: Long) {
        viewModelScope.launch { seanceDao.deleteSeance(com.pandafit.core.database.entities.SeanceEntity(id = id, nom = "")) }
    }
}
