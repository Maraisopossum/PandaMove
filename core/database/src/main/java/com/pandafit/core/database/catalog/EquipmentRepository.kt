package com.pandafit.core.database.catalog

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringSetPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import javax.inject.Inject
import javax.inject.Singleton

private val Context.equipmentDataStore: DataStore<Preferences> by preferencesDataStore(name = "equipment_prefs")

private val KEY_EQUIPMENT = stringSetPreferencesKey("selected_equipment")

@Singleton
class EquipmentRepository @Inject constructor(
    @ApplicationContext private val context: Context,
) {
    val selectedEquipment: Flow<Set<EquipmentCategory>> = context.equipmentDataStore.data.map { prefs ->
        prefs[KEY_EQUIPMENT]
            ?.mapNotNull { name -> EquipmentCategory.entries.find { it.name == name } }
            ?.toSet()
            ?: setOf(EquipmentCategory.POIDS_DE_CORPS)
    }

    suspend fun setEquipment(categories: Set<EquipmentCategory>) {
        context.equipmentDataStore.edit { prefs ->
            prefs[KEY_EQUIPMENT] = categories.map { it.name }.toSet()
        }
    }
}
