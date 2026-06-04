package com.pandafit.core.database.catalog

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringSetPreferencesKey
import androidx.datastore.preferences.preferencesDataStoreFile
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import javax.inject.Inject
import javax.inject.Qualifier
import javax.inject.Singleton

@Qualifier
@Retention(AnnotationRetention.BINARY)
annotation class EquipmentDataStore

@Module
@InstallIn(SingletonComponent::class)
object EquipmentDataStoreModule {
    @Provides
    @Singleton
    @EquipmentDataStore
    fun provideDataStore(@ApplicationContext ctx: Context): DataStore<Preferences> =
        androidx.datastore.preferences.core.PreferenceDataStoreFactory.create(
            produceFile = { ctx.preferencesDataStoreFile("equipment_prefs") }
        )
}

private val KEY_EQUIPMENT = stringSetPreferencesKey("selected_equipment")

@Singleton
class EquipmentRepository @Inject constructor(
    @EquipmentDataStore private val dataStore: DataStore<Preferences>,
) {
    val selectedEquipment: Flow<Set<EquipmentCategory>> = dataStore.data.map { prefs ->
        prefs[KEY_EQUIPMENT]
            ?.mapNotNull { name -> EquipmentCategory.entries.find { it.name == name } }
            ?.toSet()
            ?: setOf(EquipmentCategory.POIDS_DE_CORPS)
    }

    suspend fun setEquipment(categories: Set<EquipmentCategory>) {
        dataStore.edit { prefs ->
            prefs[KEY_EQUIPMENT] = categories.map { it.name }.toSet()
        }
    }
}
