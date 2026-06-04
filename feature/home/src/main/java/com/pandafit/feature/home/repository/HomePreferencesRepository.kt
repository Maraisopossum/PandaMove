package com.pandafit.feature.home.repository

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
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
annotation class HomeDataStore

@Module
@InstallIn(SingletonComponent::class)
object HomeDataStoreModule {
    @Provides
    @Singleton
    @HomeDataStore
    fun provideDataStore(@ApplicationContext ctx: Context): DataStore<Preferences> =
        androidx.datastore.preferences.core.PreferenceDataStoreFactory.create(
            produceFile = { ctx.preferencesDataStoreFile("pandamove_home_prefs") }
        )
}

private val KEY_SECTION_ORDER = stringPreferencesKey("section_order")
private const val DEFAULT_SECTION_ORDER =
    "panda_running,panda_cycling,panda_strength,panda_calendar,panda_timer,panda_stats,panda_profile"

@Singleton
class HomePreferencesRepository @Inject constructor(
    @HomeDataStore private val dataStore: DataStore<Preferences>,
) {
    val sectionOrderFlow: Flow<List<String>> = dataStore.data.map { prefs ->
        (prefs[KEY_SECTION_ORDER] ?: DEFAULT_SECTION_ORDER)
            .split(",")
            .filter { it.isNotBlank() }
    }

    suspend fun saveSectionOrder(tags: List<String>) {
        dataStore.edit { it[KEY_SECTION_ORDER] = tags.joinToString(",") }
    }
}
