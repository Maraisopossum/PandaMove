package com.pandafit.core.database.catalog

import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import javax.inject.Inject
import javax.inject.Singleton

private val KEY_BACKUP_FOLDER_URI  = stringPreferencesKey("backup_folder_uri")
private val KEY_LAST_BACKUP_DATE   = stringPreferencesKey("last_backup_date")

@Singleton
class BackupPreferencesRepository @Inject constructor(
    @PandaPrefsDataStore private val dataStore: DataStore<Preferences>,
) {
    val backupFolderUri: Flow<String?> = dataStore.data.map { it[KEY_BACKUP_FOLDER_URI] }
    val lastBackupDate: Flow<String?>  = dataStore.data.map { it[KEY_LAST_BACKUP_DATE] }

    suspend fun setBackupFolderUri(uri: String) {
        dataStore.edit { it[KEY_BACKUP_FOLDER_URI] = uri }
    }

    suspend fun clearBackupFolderUri() {
        dataStore.edit { it.remove(KEY_BACKUP_FOLDER_URI) }
    }

    suspend fun setLastBackupDate(date: String) {
        dataStore.edit { it[KEY_LAST_BACKUP_DATE] = date }
    }
}
