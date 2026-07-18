package com.pandafit.feature.stats.viewmodel

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import androidx.core.content.ContextCompat
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.pandafit.core.database.analysis.computeHeatmapPoints
import com.pandafit.core.database.dao.GpsTrackPointDao
import com.pandafit.core.database.entities.WorkoutType
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import javax.inject.Inject
import kotlin.coroutines.resume

data class HeatmapUiState(
    val isLoading: Boolean = true,
    val points: List<Pair<Double, Double>> = emptyList(),
    /** null = tous sports confondus. */
    val selectedSport: WorkoutType? = null,
    /** Position actuelle (lat, lon) — utilisée pour centrer la carte à l'ouverture. */
    val currentLocation: Pair<Double, Double>? = null,
    /** Vrai une fois la tentative de localisation terminée (succès, échec ou permission absente) —
     * évite d'afficher la carte avant de savoir si on doit la centrer sur la position ou tout
     * englober, ce qui empêcherait tout recentrage ultérieur (cf. [HeatmapMap], cadrage one-shot). */
    val isLocationResolved: Boolean = false,
)

/** Sports GPS pouvant alimenter la heatmap — STRENGTH exclu, jamais de tracé GPS. */
val HEATMAP_SPORTS = listOf(WorkoutType.RUNNING, WorkoutType.CYCLING, WorkoutType.HIKING)

@HiltViewModel
class HeatmapViewModel @Inject constructor(
    private val gpsDao: GpsTrackPointDao,
    @ApplicationContext private val context: Context,
) : ViewModel() {

    private val fusedLocationClient by lazy { LocationServices.getFusedLocationProviderClient(context) }

    private val _uiState = MutableStateFlow(HeatmapUiState())
    val uiState: StateFlow<HeatmapUiState> = _uiState.asStateFlow()

    init {
        loadData()
        fetchCurrentLocationIfPermitted()
    }

    /** Change le filtre sport et recharge — null pour revenir à "Tous sports". */
    fun selectSport(sport: WorkoutType?) {
        if (sport == _uiState.value.selectedSport) return
        _uiState.value = _uiState.value.copy(selectedSport = sport, isLoading = true)
        loadData()
    }

    private fun loadData() {
        val sport = _uiState.value.selectedSport
        viewModelScope.launch {
            // Lecture hors du thread principal — le calcul de densité/flou lui-même est fait par
            // HeatmapMap, également hors thread principal.
            val points = withContext(Dispatchers.IO) {
                val entities = if (sport != null) gpsDao.getAllByWorkoutType(sport) else gpsDao.getAll()
                computeHeatmapPoints(entities)
            }
            // Le filtre a pu changer pendant le chargement — n'écrase pas une sélection plus récente.
            if (_uiState.value.selectedSport == sport) {
                _uiState.value = _uiState.value.copy(isLoading = false, points = points)
            }
        }
    }

    /** Appelé à l'ouverture, et à nouveau si l'utilisateur vient d'accorder la permission localisation. */
    fun fetchCurrentLocationIfPermitted() {
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            _uiState.value = _uiState.value.copy(isLocationResolved = true)
            return
        }
        viewModelScope.launch {
            // Ne bloque jamais l'affichage indéfiniment si le GPS ne peut pas obtenir de position
            // rapidement (ex. en intérieur) — au pire on retombe sur le cadrage "toutes les cellules".
            val location = withTimeoutOrNull(4_000) { getLastOrCurrentLocation() }
            _uiState.value = _uiState.value.copy(
                currentLocation = location?.let { it.latitude to it.longitude },
                isLocationResolved = true,
            )
        }
    }

    @SuppressLint("MissingPermission")
    private suspend fun getLastOrCurrentLocation(): Location? = suspendCancellableCoroutine { cont ->
        fusedLocationClient.lastLocation
            .addOnSuccessListener { last ->
                if (last != null) {
                    if (cont.isActive) cont.resume(last)
                } else {
                    fusedLocationClient.getCurrentLocation(Priority.PRIORITY_BALANCED_POWER_ACCURACY, null)
                        .addOnSuccessListener { if (cont.isActive) cont.resume(it) }
                        .addOnFailureListener { if (cont.isActive) cont.resume(null) }
                }
            }
            .addOnFailureListener { if (cont.isActive) cont.resume(null) }
    }
}
