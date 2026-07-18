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
import com.pandafit.core.database.analysis.HeatmapData
import com.pandafit.core.database.analysis.computeHeatmapData
import com.pandafit.core.database.dao.GpsTrackPointDao
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
    val data: HeatmapData? = null,
    /** Position actuelle (lat, lon) — utilisée pour centrer la carte à l'ouverture. */
    val currentLocation: Pair<Double, Double>? = null,
    /** Vrai une fois la tentative de localisation terminée (succès, échec ou permission absente) —
     * évite d'afficher la carte avant de savoir si on doit la centrer sur la position ou tout
     * englober, ce qui empêcherait tout recentrage ultérieur (cf. [HeatmapMap], cadrage one-shot). */
    val isLocationResolved: Boolean = false,
)

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

    private fun loadData() {
        viewModelScope.launch {
            // Lecture + binning (potentiellement des dizaines de milliers de points sur un
            // historique chargé) hors du thread principal.
            val data = withContext(Dispatchers.IO) {
                computeHeatmapData(gpsDao.getAll())
            }
            _uiState.value = _uiState.value.copy(isLoading = false, data = data)
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
