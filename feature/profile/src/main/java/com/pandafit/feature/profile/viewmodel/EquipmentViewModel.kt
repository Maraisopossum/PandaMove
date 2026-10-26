package com.pandafit.feature.profile.viewmodel

import android.content.Intent
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.pandafit.core.database.catalog.DisquesConfig
import com.pandafit.core.database.catalog.EquipmentCategory
import com.pandafit.core.database.catalog.EquipmentInventaire
import com.pandafit.core.database.catalog.EquipmentRepository
import com.pandafit.core.database.catalog.HalteresConfig
import com.pandafit.core.database.catalog.PlageConfig
import com.pandafit.core.database.export.DataExportManager
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class EquipmentViewModel @Inject constructor(
    private val repository: EquipmentRepository,
    private val exportManager: DataExportManager,
) : ViewModel() {

    private val _shareIntent = MutableSharedFlow<Intent>(extraBufferCapacity = 1)
    val shareIntent: SharedFlow<Intent> = _shareIntent.asSharedFlow()

    val selected: StateFlow<Set<EquipmentCategory>> = repository.selectedEquipment
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), setOf(EquipmentCategory.POIDS_DE_CORPS))

    val pasParCategorie: StateFlow<Map<EquipmentCategory, Float>> = repository.pasParCategorie
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyMap())

    val inventaire: StateFlow<EquipmentInventaire> = repository.inventaire
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), EquipmentInventaire())

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

    fun updatePas(category: EquipmentCategory, valeurKg: Float?) {
        viewModelScope.launch { repository.setPas(category, valeurKg) }
    }

    fun updateHalteres(config: HalteresConfig) {
        viewModelScope.launch { repository.setHalteresConfig(config) }
    }

    fun updateBarre(config: DisquesConfig) {
        viewModelScope.launch { repository.setBarreConfig(config) }
    }

    fun updateKettlebell(config: PlageConfig) {
        viewModelScope.launch { repository.setKettlebellConfig(config) }
    }

    fun updateCable(config: PlageConfig) {
        viewModelScope.launch { repository.setCableConfig(config) }
    }

    fun exportEquipment() {
        viewModelScope.launch {
            val file = exportManager.exportEquipmentToJson()
            _shareIntent.tryEmit(exportManager.buildShareIntent(file))
        }
    }
}
