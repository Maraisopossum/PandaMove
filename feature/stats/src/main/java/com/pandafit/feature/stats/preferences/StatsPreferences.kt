package com.pandafit.feature.stats.preferences

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.intPreferencesKey
import androidx.datastore.preferences.preferencesDataStoreFile
import com.pandafit.feature.stats.model.StatsConfig
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
annotation class StatsDataStore

@Module
@InstallIn(SingletonComponent::class)
object StatsPreferencesModule {
    @Provides
    @Singleton
    @StatsDataStore
    fun provideDataStore(@ApplicationContext ctx: Context): DataStore<Preferences> =
        androidx.datastore.preferences.core.PreferenceDataStoreFactory.create(
            produceFile = { ctx.preferencesDataStoreFile("stats_config") }
        )
}

object StatsPreferencesKeys {
    val RUN_DIST_1   = intPreferencesKey("run_dist_1")
    val RUN_DIST_2   = intPreferencesKey("run_dist_2")
    val RUN_SUMMIT   = intPreferencesKey("run_summit")
    val STR_WEIGHT_1 = intPreferencesKey("str_weight_1")
    val STR_WEIGHT_2 = intPreferencesKey("str_weight_2")
    val STR_WEIGHT_3 = intPreferencesKey("str_weight_3")
    val STR_MONUMENT = intPreferencesKey("str_monument")
}

@Singleton
class StatsPreferences @Inject constructor(
    @StatsDataStore private val dataStore: DataStore<Preferences>,
) {
    val configFlow: Flow<StatsConfig> = dataStore.data.map { prefs ->
        StatsConfig(
            runDist1Idx    = prefs[StatsPreferencesKeys.RUN_DIST_1]   ?: 0,
            runDist2Idx    = prefs[StatsPreferencesKeys.RUN_DIST_2]   ?: 1,
            runSummitIdx   = prefs[StatsPreferencesKeys.RUN_SUMMIT]   ?: 0,
            strWeight1Idx  = prefs[StatsPreferencesKeys.STR_WEIGHT_1] ?: 0,
            strWeight2Idx  = prefs[StatsPreferencesKeys.STR_WEIGHT_2] ?: 2,
            strWeight3Idx  = prefs[StatsPreferencesKeys.STR_WEIGHT_3] ?: 4,
            strMonumentIdx = prefs[StatsPreferencesKeys.STR_MONUMENT] ?: 0,
        )
    }

    suspend fun update(key: Preferences.Key<Int>, value: Int) {
        dataStore.edit { it[key] = value }
    }
}
