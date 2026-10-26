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
    // Clés réutilisées depuis les anciens "preset 1" (3 presets réduits à 1) — préserve le choix
    // déjà fait par l'utilisateur sans migration destructive. Les anciennes clés _2/_3 ne sont
    // plus lues mais restent en base, sans effet.
    val RUN_DIST     = intPreferencesKey("run_dist_1")
    val RUN_SUMMIT   = intPreferencesKey("run_summit")
    val STR_WEIGHT   = intPreferencesKey("str_weight_1")
    val STR_MONUMENT = intPreferencesKey("str_monument")
    val CYC_DIST     = intPreferencesKey("cyc_dist_1")
    val CYC_SUMMIT   = intPreferencesKey("cyc_summit")
}

@Singleton
class StatsPreferences @Inject constructor(
    @StatsDataStore private val dataStore: DataStore<Preferences>,
) {
    val configFlow: Flow<StatsConfig> = dataStore.data.map { prefs ->
        StatsConfig(
            runDistIdx     = prefs[StatsPreferencesKeys.RUN_DIST]     ?: 0,
            runSummitIdx   = prefs[StatsPreferencesKeys.RUN_SUMMIT]   ?: 0,
            strWeightIdx   = prefs[StatsPreferencesKeys.STR_WEIGHT]   ?: 0,
            strMonumentIdx = prefs[StatsPreferencesKeys.STR_MONUMENT] ?: 0,
            cycDistIdx     = prefs[StatsPreferencesKeys.CYC_DIST]     ?: 2,
            cycSummitIdx   = prefs[StatsPreferencesKeys.CYC_SUMMIT]   ?: 0,
        )
    }

    suspend fun update(key: Preferences.Key<Int>, value: Int) {
        dataStore.edit { it[key] = value }
    }
}
