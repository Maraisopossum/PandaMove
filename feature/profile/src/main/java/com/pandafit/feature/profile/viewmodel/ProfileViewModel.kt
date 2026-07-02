package com.pandafit.feature.profile.viewmodel

import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import com.pandafit.core.database.catalog.BackupPreferencesRepository
import com.pandafit.core.database.catalog.UserPreferencesRepository
import com.pandafit.core.database.dao.ExerciseDao
import com.pandafit.core.database.export.DataExportManager
import com.pandafit.core.database.export.DataImportManager
import com.pandafit.core.database.export.ExportType
import com.pandafit.core.database.export.ImportResult
import com.pandafit.core.database.worker.DriveBackupWorker
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.withContext
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch
import javax.inject.Inject

enum class UserGender { MALE, FEMALE }

enum class ExportImportStatus { IDLE, EXPORTING, IMPORTING, SUCCESS_EXPORT, SUCCESS_IMPORT, ERROR }

data class ProfileUiState(
    val userName: String = "Sportif PandaMove",
    val gender: UserGender = UserGender.MALE,
    val soundOverrideSilent: Boolean = false,
    val isDarkMode: Boolean = false,
    val exerciseCount: Int = 0,
    val exportImportStatus: ExportImportStatus = ExportImportStatus.IDLE,
    val csvRunningStatus: ExportImportStatus = ExportImportStatus.IDLE,
    val csvStrengthStatus: ExportImportStatus = ExportImportStatus.IDLE,
    val backupStatus: ExportImportStatus = ExportImportStatus.IDLE,
    val backupFolderUri: String? = null,
    val lastBackupDate: String? = null,
    val importResult: ImportResult? = null,
    val errorMessage: String? = null,
)

@HiltViewModel
class ProfileViewModel @Inject constructor(
    @ApplicationContext private val context: Context,
    private val userPrefs: UserPreferencesRepository,
    private val backupPrefs: BackupPreferencesRepository,
    private val exerciseDao: ExerciseDao,
    private val exportManager: DataExportManager,
    private val importManager: DataImportManager,
) : ViewModel() {

    private val _uiState = MutableStateFlow(ProfileUiState())
    val uiState: StateFlow<ProfileUiState> = _uiState.asStateFlow()

    private val _shareIntent = MutableSharedFlow<Intent>(extraBufferCapacity = 1)
    val shareIntent: SharedFlow<Intent> = _shareIntent.asSharedFlow()

    /** Passe à true dès que le premier emit DataStore est reçu. */
    private val _isReady = MutableStateFlow(false)
    val isReady: StateFlow<Boolean> = _isReady.asStateFlow()

    init {
        viewModelScope.launch {
            combine(
                backupPrefs.backupFolderUri,
                backupPrefs.lastBackupDate,
            ) { uri, date -> uri to date }.collect { (uri, date) ->
                _uiState.value = _uiState.value.copy(backupFolderUri = uri, lastBackupDate = date)
            }
        }
        viewModelScope.launch {
            combine(
                userPrefs.userNameFlow,
                userPrefs.genderFlow,
                userPrefs.soundOverrideSilentFlow,
                userPrefs.isDarkModeFlow,
                exerciseDao.observeAll().map { it.size },
            ) { name, gender, soundOverride, isDarkMode, count ->
                _uiState.value.copy(
                    userName = name.ifBlank { "Sportif PandaMove" },
                    gender = if (gender == "FEMALE") UserGender.FEMALE else UserGender.MALE,
                    soundOverrideSilent = soundOverride,
                    isDarkMode = isDarkMode,
                    exerciseCount = count,
                )
            }
                .catch { /* ignore, use defaults */ }
                .collect { state ->
                    _uiState.value = state
                    _isReady.value = true
                }
        }
    }

    fun updateUserName(name: String) {
        viewModelScope.launch { userPrefs.setUserName(name) }
    }

    fun setGender(gender: UserGender) {
        viewModelScope.launch { userPrefs.setGender(gender.name) }
    }

    fun setSoundOverrideSilent(enabled: Boolean) {
        viewModelScope.launch { userPrefs.setSoundOverrideSilent(enabled) }
    }

    fun setDarkMode(enabled: Boolean) {
        viewModelScope.launch { userPrefs.setDarkMode(enabled) }
    }

    fun clearStatus() {
        _uiState.value = _uiState.value.copy(
            exportImportStatus = ExportImportStatus.IDLE,
            csvRunningStatus = ExportImportStatus.IDLE,
            csvStrengthStatus = ExportImportStatus.IDLE,
            backupStatus = ExportImportStatus.IDLE,
            importResult = null,
            errorMessage = null,
        )
    }

    fun onBackupFolderSelected(uri: Uri) {
        viewModelScope.launch {
            val flags = Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION
            context.contentResolver.takePersistableUriPermission(uri, flags)
            backupPrefs.setBackupFolderUri(uri.toString())
        }
    }

    fun clearBackupFolder() {
        viewModelScope.launch {
            val uri = backupPrefs.backupFolderUri.first()
            if (uri != null) {
                runCatching {
                    context.contentResolver.releasePersistableUriPermission(
                        Uri.parse(uri),
                        Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION,
                    )
                }
            }
            backupPrefs.clearBackupFolderUri()
        }
    }

    fun backupNow() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(backupStatus = ExportImportStatus.EXPORTING)
            try {
                WorkManager.getInstance(context).enqueueUniqueWork(
                    "${DriveBackupWorker.WORK_NAME}_manual",
                    ExistingWorkPolicy.REPLACE,
                    OneTimeWorkRequestBuilder<DriveBackupWorker>().build(),
                )
                _uiState.value = _uiState.value.copy(backupStatus = ExportImportStatus.SUCCESS_EXPORT)
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    backupStatus = ExportImportStatus.ERROR,
                    errorMessage = e.message ?: "Erreur backup",
                )
            }
        }
    }

    fun exportData() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(exportImportStatus = ExportImportStatus.EXPORTING)
            try {
                val file = exportManager.export()
                _shareIntent.tryEmit(exportManager.buildShareIntent(file))
                _uiState.value = _uiState.value.copy(exportImportStatus = ExportImportStatus.SUCCESS_EXPORT)
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    exportImportStatus = ExportImportStatus.ERROR,
                    errorMessage = e.message ?: "Erreur inconnue",
                )
            }
        }
    }

    fun exportCsvRunning() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(csvRunningStatus = ExportImportStatus.EXPORTING)
            try {
                val file = exportManager.exportToCsv(ExportType.RUNNING)
                _shareIntent.tryEmit(exportManager.buildShareIntent(file, "text/csv"))
                _uiState.value = _uiState.value.copy(csvRunningStatus = ExportImportStatus.SUCCESS_EXPORT)
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    csvRunningStatus = ExportImportStatus.ERROR,
                    errorMessage = e.message ?: "Erreur inconnue",
                )
            }
        }
    }

    fun exportCsvStrength() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(csvStrengthStatus = ExportImportStatus.EXPORTING)
            try {
                val file = exportManager.exportToCsv(ExportType.STRENGTH)
                _shareIntent.tryEmit(exportManager.buildShareIntent(file, "text/csv"))
                _uiState.value = _uiState.value.copy(csvStrengthStatus = ExportImportStatus.SUCCESS_EXPORT)
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    csvStrengthStatus = ExportImportStatus.ERROR,
                    errorMessage = e.message ?: "Erreur inconnue",
                )
            }
        }
    }

    fun importDataFromUri(uri: Uri) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(exportImportStatus = ExportImportStatus.IMPORTING)
            try {
                val jsonContent = withContext(Dispatchers.IO) {
                    context.contentResolver.openInputStream(uri)?.bufferedReader(Charsets.UTF_8)?.readText()
                } ?: run {
                    _uiState.value = _uiState.value.copy(
                        exportImportStatus = ExportImportStatus.ERROR,
                        errorMessage = "Impossible de lire le fichier",
                    )
                    return@launch
                }
                val result = importManager.import(jsonContent)
                _uiState.value = _uiState.value.copy(
                    exportImportStatus = ExportImportStatus.SUCCESS_IMPORT,
                    importResult = result,
                    errorMessage = result.parseError,
                )
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    exportImportStatus = ExportImportStatus.ERROR,
                    errorMessage = e.message ?: "Erreur d'import",
                )
            }
        }
    }
}
