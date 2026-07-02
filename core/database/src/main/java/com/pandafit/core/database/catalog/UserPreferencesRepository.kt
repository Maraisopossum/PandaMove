package com.pandafit.core.database.catalog

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
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
annotation class PandaPrefsDataStore

@Module
@InstallIn(SingletonComponent::class)
object UserPreferencesDataStoreModule {
    @Provides
    @Singleton
    @PandaPrefsDataStore
    fun provideDataStore(@ApplicationContext ctx: Context): DataStore<Preferences> =
        androidx.datastore.preferences.core.PreferenceDataStoreFactory.create(
            produceFile = { ctx.preferencesDataStoreFile("pandamove_prefs") }
        )
}

private val KEY_USERNAME              = stringPreferencesKey("user_name")
private val KEY_GENDER                = stringPreferencesKey("gender")
private val KEY_SOUND_OVERRIDE_SILENT = booleanPreferencesKey("sound_override_silent")
private val KEY_DARK_MODE             = booleanPreferencesKey("dark_mode")

@Singleton
class UserPreferencesRepository @Inject constructor(
    @PandaPrefsDataStore private val dataStore: DataStore<Preferences>,
) {
    val userNameFlow: Flow<String> = dataStore.data.map { prefs ->
        prefs[KEY_USERNAME] ?: ""
    }

    val genderFlow: Flow<String> = dataStore.data.map { prefs ->
        prefs[KEY_GENDER] ?: "MALE"
    }

    val soundOverrideSilentFlow: Flow<Boolean> = dataStore.data.map { prefs ->
        prefs[KEY_SOUND_OVERRIDE_SILENT] ?: false
    }

    val isDarkModeFlow: Flow<Boolean> = dataStore.data.map { prefs ->
        prefs[KEY_DARK_MODE] ?: false
    }

    suspend fun setUserName(name: String) {
        dataStore.edit { it[KEY_USERNAME] = name }
    }

    suspend fun setGender(gender: String) {
        dataStore.edit { it[KEY_GENDER] = gender }
    }

    suspend fun setSoundOverrideSilent(enabled: Boolean) {
        dataStore.edit { it[KEY_SOUND_OVERRIDE_SILENT] = enabled }
    }

    suspend fun setDarkMode(enabled: Boolean) {
        dataStore.edit { it[KEY_DARK_MODE] = enabled }
    }
}
