package com.pandafit.core.database.catalog

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.floatPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.core.stringSetPreferencesKey
import androidx.datastore.preferences.preferencesDataStoreFile
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
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

// Pas par défaut (kg) pour les catégories sans inventaire structuré dédié (ex. MACHINE) — bible §4.3.
// HALTERES/BARRE/KETTLEBELL/CABLE ont désormais un inventaire réel (voir EquipmentInventory.kt).
private val PAS_DEFAUT: Map<EquipmentCategory, Float> = mapOf(
    EquipmentCategory.MACHINE to 5f,
)

private fun pasKey(category: EquipmentCategory) = floatPreferencesKey("pas_${category.name}")

private val KEY_HALTERES = stringPreferencesKey("config_halteres")
private val KEY_BARRE = stringPreferencesKey("config_barre")
private val KEY_KETTLEBELL = stringPreferencesKey("config_kettlebell")
private val KEY_CABLE = stringPreferencesKey("config_cable")

// Points de départ raisonnables — pleinement éditables, pas une hypothèse silencieuse sur le matériel réel.
private val HALTERES_DEFAUT = HalteresConfig(poidsFixes = listOf(4f, 6f, 8f, 10f, 12f, 16f, 20f))
private val BARRE_DEFAUT = DisquesConfig(barreKg = 20f, disques = mapOf(1.25f to 4, 2.5f to 4, 5f to 4, 10f to 2, 20f to 2))
private val KETTLEBELL_DEFAUT = PlageConfig(minKg = 8f, maxKg = 24f, pasKg = 4f)
private val CABLE_DEFAUT = PlageConfig(minKg = 5f, maxKg = 100f, pasKg = 2.5f)

private val json = Json { ignoreUnknownKeys = true }

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

    /** Pas réalisable (kg) par catégorie, configurable par l'utilisateur — bible §4.3. */
    val pasParCategorie: Flow<Map<EquipmentCategory, Float>> = dataStore.data.map { prefs ->
        EquipmentCategory.entries.mapNotNull { cat ->
            (prefs[pasKey(cat)] ?: PAS_DEFAUT[cat])?.let { cat to it }
        }.toMap()
    }

    suspend fun setPas(category: EquipmentCategory, pasKg: Float?) {
        dataStore.edit { prefs ->
            if (pasKg == null) prefs.remove(pasKey(category)) else prefs[pasKey(category)] = pasKg
        }
    }

    /** Inventaire réel (haltères/barre/kettlebell/câble) — bible §4.3. */
    val inventaire: Flow<EquipmentInventaire> = dataStore.data.map { prefs ->
        EquipmentInventaire(
            halteres = prefs[KEY_HALTERES]?.let { json.decodeFromString<HalteresConfig>(it) } ?: HALTERES_DEFAUT,
            barre = prefs[KEY_BARRE]?.let { json.decodeFromString<DisquesConfig>(it) } ?: BARRE_DEFAUT,
            kettlebell = prefs[KEY_KETTLEBELL]?.let { json.decodeFromString<PlageConfig>(it) } ?: KETTLEBELL_DEFAUT,
            cable = prefs[KEY_CABLE]?.let { json.decodeFromString<PlageConfig>(it) } ?: CABLE_DEFAUT,
        )
    }

    suspend fun setHalteresConfig(config: HalteresConfig) {
        dataStore.edit { prefs -> prefs[KEY_HALTERES] = json.encodeToString(config) }
    }

    suspend fun setBarreConfig(config: DisquesConfig) {
        dataStore.edit { prefs -> prefs[KEY_BARRE] = json.encodeToString(config) }
    }

    suspend fun setKettlebellConfig(config: PlageConfig) {
        dataStore.edit { prefs -> prefs[KEY_KETTLEBELL] = json.encodeToString(config) }
    }

    suspend fun setCableConfig(config: PlageConfig) {
        dataStore.edit { prefs -> prefs[KEY_CABLE] = json.encodeToString(config) }
    }
}
