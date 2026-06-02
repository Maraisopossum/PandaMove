package com.pandafit.feature.profile.viewmodel

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.pandafit.core.database.catalog.UserPreferencesRepository
import com.pandafit.core.database.dao.ExerciseDao
import com.pandafit.core.database.export.DataExportManager
import com.pandafit.core.database.export.DataImportManager
import com.pandafit.core.database.export.ImportResult
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch
import javax.inject.Inject

enum class UserGender { MALE, FEMALE }

enum class ExportImportStatus { IDLE, EXPORTING, IMPORTING, SUCCESS_EXPORT, SUCCESS_IMPORT, ERROR }

data class ProfileUiState(
    val userName: String = "Sportif PandaMove",
    val isDarkMode: Boolean = false,
    val gender: UserGender = UserGender.MALE,
    val exerciseCount: Int = 0,
    val exportImportStatus: ExportImportStatus = ExportImportStatus.IDLE,
    val importResult: ImportResult? = null,
    val errorMessage: String? = null,
)

@HiltViewModel
class ProfileViewModel @Inject constructor(
    @ApplicationContext private val context: Context,
    private val userPrefs: UserPreferencesRepository,
    private val exerciseDao: ExerciseDao,
    private val exportManager: DataExportManager,
    private val importManager: DataImportManager,
) : ViewModel() {

    private val _uiState = MutableStateFlow(ProfileUiState())
    val uiState: StateFlow<ProfileUiState> = _uiState.asStateFlow()

    private val _isDarkMode = MutableStateFlow(false)
    val isDarkMode: StateFlow<Boolean> = _isDarkMode.asStateFlow()

    /** Passe à true dès que le premier emit DataStore est reçu. */
    private val _isReady = MutableStateFlow(false)
    val isReady: StateFlow<Boolean> = _isReady.asStateFlow()

    init {
        viewModelScope.launch {
            combine(
                userPrefs.userNameFlow,
                userPrefs.isDarkModeFlow,
                userPrefs.genderFlow,
                exerciseDao.observeAll().map { it.size },
            ) { name, dark, gender, count ->
                _uiState.value.copy(
                    userName = name.ifBlank { "Sportif PandaMove" },
                    isDarkMode = dark,
                    gender = if (gender == "FEMALE") UserGender.FEMALE else UserGender.MALE,
                    exerciseCount = count,
                )
            }
                .catch { /* ignore, use defaults */ }
                .collect { state ->
                    _uiState.value = state
                    _isDarkMode.value = state.isDarkMode
                    _isReady.value = true
                }
        }
    }

    fun updateUserName(name: String) {
        viewModelScope.launch { userPrefs.setUserName(name) }
    }

    fun setDarkMode(enabled: Boolean) {
        viewModelScope.launch { userPrefs.setDarkMode(enabled) }
    }

    fun setGender(gender: UserGender) {
        viewModelScope.launch { userPrefs.setGender(gender.name) }
    }

    fun clearStatus() {
        _uiState.value = _uiState.value.copy(
            exportImportStatus = ExportImportStatus.IDLE,
            importResult = null,
            errorMessage = null,
        )
    }

    fun exportData() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(exportImportStatus = ExportImportStatus.EXPORTING)
            try {
                val file = exportManager.export()
                exportManager.shareFile(file)
                _uiState.value = _uiState.value.copy(exportImportStatus = ExportImportStatus.SUCCESS_EXPORT)
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    exportImportStatus = ExportImportStatus.ERROR,
                    errorMessage = e.message ?: "Erreur inconnue",
                )
            }
        }
    }

    fun importData(jsonContent: String) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(exportImportStatus = ExportImportStatus.IMPORTING)
            try {
                val result = importManager.import(jsonContent)
                _uiState.value = _uiState.value.copy(
                    exportImportStatus = ExportImportStatus.SUCCESS_IMPORT,
                    importResult = result,
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
