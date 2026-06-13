package com.pandafit.feature.breathing.viewmodel

import android.content.Context
import androidx.core.content.ContextCompat
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.pandafit.core.database.dao.BreathingSessionDao
import com.pandafit.core.database.dao.CustomBreathingMethodDao
import com.pandafit.core.database.entities.BreathingSessionEntity
import com.pandafit.core.database.entities.CustomBreathingMethodEntity
import com.pandafit.feature.breathing.audio.BreathingAudioManager
import com.pandafit.feature.breathing.engine.BreathingPhase
import com.pandafit.feature.breathing.engine.BreathingSessionEngine
import com.pandafit.feature.breathing.engine.PhaseState
import com.pandafit.feature.breathing.method.BreathingMethod
import com.pandafit.feature.breathing.method.BreathingMethodRegistry
import com.pandafit.feature.breathing.method.toBreathingMethod
import com.pandafit.feature.breathing.service.BreathingService
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.LocalDate
import javax.inject.Inject

@HiltViewModel
class BreathingViewModel @Inject constructor(
    @ApplicationContext private val context: Context,
    private val engine: BreathingSessionEngine,
    private val audioManager: BreathingAudioManager,
    private val breathingSessionDao: BreathingSessionDao,
    private val customBreathingMethodDao: CustomBreathingMethodDao,
) : ViewModel() {

    private val _uiState = MutableStateFlow(BreathingUiState())
    val uiState: StateFlow<BreathingUiState> = _uiState.asStateFlow()

    /** Liste fusionnée : intégrées en premier, puis custom par ordre de création. */
    private val _methods = MutableStateFlow<List<BreathingMethod>>(BreathingMethodRegistry.all)
    val methods: StateFlow<List<BreathingMethod>> = _methods.asStateFlow()

    /** Historique des séances (15 plus récentes, toutes dates confondues). */
    private val _sessions = MutableStateFlow<List<com.pandafit.core.database.entities.BreathingSessionEntity>>(emptyList())
    val sessions: StateFlow<List<com.pandafit.core.database.entities.BreathingSessionEntity>> = _sessions.asStateFlow()

    private var countdownJob: Job? = null

    init {
        // Chargement live des méthodes custom
        viewModelScope.launch {
            customBreathingMethodDao.observeAll().collect { entities ->
                _methods.value = BreathingMethodRegistry.all + entities.map { it.toBreathingMethod() }
            }
        }

        // Chargement live de l'historique des séances (15 plus récentes)
        viewModelScope.launch {
            breathingSessionDao.observeAll().collect { all ->
                _sessions.value = all.take(15)
            }
        }

        // Observe l'engine : audio continu + sauvegarde auto
        viewModelScope.launch {
            var lastPhase: BreathingPhase? = null
            var wasActive = false

            engine.state.collect { state ->
                _uiState.value = _uiState.value.copy(phaseState = state)

                if (state.isActive) {
                    val phaseChanged = state.phase != lastPhase
                    val justResumed  = !wasActive

                    if (phaseChanged || justResumed) {
                        val toneDurationMs = if (phaseChanged) {
                            state.phaseDurationMs
                        } else {
                            (state.phaseDurationMs - state.phaseProgressMs).coerceAtLeast(100L)
                        }
                        audioManager.startPhaseTone(state.phase, toneDurationMs)
                        lastPhase = state.phase
                    }
                } else if (wasActive) {
                    audioManager.stopPhaseTone()
                }

                wasActive = state.isActive

                if (state.isCompleted && !_uiState.value.isSessionSaved) {
                    audioManager.stopPhaseTone()
                    saveSession(state)
                }
            }
        }
    }

    // ── Sélection (écran de choix) ───────────────────────────────────────────

    fun selectMethod(method: BreathingMethod) {
        _uiState.value = _uiState.value.copy(
            selectedMethod = method,
            customCycles = null,
            customDurationMinutes = null,
        )
    }

    fun setConfigMode(mode: ConfigMode) {
        _uiState.value = _uiState.value.copy(configMode = mode)
    }

    fun setCustomCycles(cycles: Int) {
        _uiState.value = _uiState.value.copy(customCycles = cycles.coerceIn(1, 120))
    }

    fun setCustomDurationMinutes(minutes: Int) {
        _uiState.value = _uiState.value.copy(customDurationMinutes = minutes.coerceIn(1, 90))
    }

    // ── CRUD méthodes custom ─────────────────────────────────────────────────

    /** Crée une nouvelle méthode custom en base. Retourne son id généré. */
    suspend fun createCustomMethod(entity: CustomBreathingMethodEntity): Long =
        customBreathingMethodDao.insert(entity)

    /** Met à jour une méthode custom existante. */
    suspend fun updateCustomMethod(entity: CustomBreathingMethodEntity) =
        customBreathingMethodDao.update(entity)

    /** Supprime une méthode custom par son id Room. */
    fun deleteCustomMethod(customId: Long) {
        viewModelScope.launch { customBreathingMethodDao.deleteById(customId) }
    }

    /** Supprime une séance de respiration par son id Room. */
    fun deleteSession(sessionId: Long) {
        viewModelScope.launch { breathingSessionDao.deleteById(sessionId) }
    }

    /** Retourne l'entité Room brute d'une méthode custom (pour pré-remplir le formulaire d'édition). */
    suspend fun getCustomMethodEntity(customId: Long): CustomBreathingMethodEntity? =
        customBreathingMethodDao.getById(customId)

    // ── Session (écran de session) ───────────────────────────────────────────

    /**
     * Lance le décompte 5→1 puis démarre l'engine.
     * [methodId] peut être un id intégré ou "custom_<n>" pour une méthode custom.
     */
    fun startWithCountdown(methodId: String, cycles: Int) {
        val method = _methods.value.firstOrNull { it.id == methodId } ?: return
        val config  = method.config.copy(cycles = cycles)

        // Reset synchrone de l'engine : efface isCompleted=true avant le décompte,
        // ce qui évite que l'écran de fin reste affiché au prochain lancement.
        engine.stop()

        _uiState.value = _uiState.value.copy(
            selectedMethod   = method,
            isSessionSaved   = false,
            countdownSeconds = 0,
            phaseState       = com.pandafit.feature.breathing.engine.PhaseState(),
        )

        countdownJob?.cancel()
        countdownJob = viewModelScope.launch {
            for (i in 5 downTo 1) {
                _uiState.value = _uiState.value.copy(countdownSeconds = i)
                audioManager.playCountdownTick()
                delay(1_000L)
            }
            _uiState.value = _uiState.value.copy(countdownSeconds = 0)
            engine.start(config)
            ContextCompat.startForegroundService(context, BreathingService.startIntent(context))
        }
    }

    fun pauseSession()  { engine.pause() }
    fun resumeSession() { engine.resume() }

    fun stopSession() {
        countdownJob?.cancel()
        countdownJob = null
        _uiState.value = _uiState.value.copy(countdownSeconds = 0)
        audioManager.stopPhaseTone()
        engine.stop()
        context.startService(BreathingService.stopIntent(context))
    }

    private fun saveSession(state: PhaseState) {
        val method = _uiState.value.selectedMethod ?: return
        if (_uiState.value.isSessionSaved) return

        val durationSeconds = ((System.currentTimeMillis() - engine.sessionStartMs) / 1000)
            .toInt().coerceAtLeast(1)

        viewModelScope.launch {
            breathingSessionDao.insert(
                BreathingSessionEntity(
                    methodId        = method.id,
                    methodName      = method.name,
                    cyclesCompleted = state.currentCycle,
                    durationSeconds = durationSeconds,
                    sessionDate     = LocalDate.now(),
                )
            )
            _uiState.value = _uiState.value.copy(
                isSessionSaved              = true,
                sessionSavedDurationSeconds = durationSeconds,
            )
        }
    }

    override fun onCleared() {
        super.onCleared()
        audioManager.release()
    }
}
