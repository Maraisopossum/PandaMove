package com.pandafit.feature.profile.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.pandafit.core.database.catalog.EquipmentCategory
import com.pandafit.core.database.catalog.EquipmentRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class EquipmentViewModel @Inject constructor(
    private val repository: EquipmentRepository,
) : ViewModel() {

    val selected: StateFlow<Set<EquipmentCategory>> = repository.selectedEquipment
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), setOf(EquipmentCategory.POIDS_DE_CORPS))

    fun toggle(category: EquipmentCategory) {
        val current = selected.value.toMutableSet()
        if (category in current) current.remove(category) else current.add(category)
        viewModelScope.launch { repository.setEquipment(current) }
    }

    fun selectAll() {
        viewModelScope.launch { repository.setEquipment(EquipmentCategory.entries.toSet()) }
    }

    fun clearAll() {
        viewModelScope.launch { repository.setEquipment(emptySet()) }
    }
}
