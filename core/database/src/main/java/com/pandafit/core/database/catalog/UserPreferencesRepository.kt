package com.pandafit.core.database.catalog

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import javax.inject.Inject
import javax.inject.Singleton

private val Context.pandaPrefsDataStore: DataStore<Preferences> by preferencesDataStore(name = "pandamove_prefs")

private val KEY_USERNAME  = stringPreferencesKey("user_name")
private val KEY_DARK_MODE = booleanPreferencesKey("dark_mode")
private val KEY_GENDER    = stringPreferencesKey("gender")

@Singleton
class UserPreferencesRepository @Inject constructor(
    @ApplicationContext private val context: Context,
) {
    val userNameFlow: Flow<String> = context.pandaPrefsDataStore.data.map { prefs ->
        prefs[KEY_USERNAME] ?: ""
    }

    val isDarkModeFlow: Flow<Boolean> = context.pandaPrefsDataStore.data.map { prefs ->
        prefs[KEY_DARK_MODE] ?: false
    }

    val genderFlow: Flow<String> = context.pandaPrefsDataStore.data.map { prefs ->
        prefs[KEY_GENDER] ?: "MALE"
    }

    suspend fun setUserName(name: String) {
        context.pandaPrefsDataStore.edit { it[KEY_USERNAME] = name }
    }

    suspend fun setDarkMode(enabled: Boolean) {
        context.pandaPrefsDataStore.edit { it[KEY_DARK_MODE] = enabled }
    }

    suspend fun setGender(gender: String) {
        context.pandaPrefsDataStore.edit { it[KEY_GENDER] = gender }
    }
}
