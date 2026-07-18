package com.pandafit.feature.stats.ui

import android.Manifest
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Map
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.pandafit.designsystem.components.HeatmapMap
import com.pandafit.designsystem.components.PandaEmptyState
import com.pandafit.designsystem.components.PandaLoadingIndicator
import com.pandafit.designsystem.components.PandaTopBar
import com.pandafit.feature.stats.R
import com.pandafit.feature.stats.viewmodel.HeatmapViewModel

/**
 * Heatmap globale — toutes les séances GPS (course, vélo, randonnée) superposées en une grille de
 * cellules colorées par fréquence de passage. Carte interactive (zoom/pan), centrée par défaut sur
 * la position actuelle (cf. [HeatmapViewModel]), échelle de couleur relative à l'utilisateur.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HeatmapScreen(
    onOpenDrawer: () -> Unit,
    viewModel: HeatmapViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

    val permissionLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        if (granted) viewModel.fetchCurrentLocationIfPermitted()
    }
    LaunchedEffect(Unit) { permissionLauncher.launch(Manifest.permission.ACCESS_FINE_LOCATION) }

    Scaffold(
        topBar = { PandaTopBar(title = stringResource(R.string.heatmap_screen_title), onOpenDrawer = onOpenDrawer) },
        containerColor = MaterialTheme.colorScheme.background,
    ) { innerPadding ->
        when {
            uiState.isLoading || !uiState.isLocationResolved -> PandaLoadingIndicator(modifier = Modifier.padding(innerPadding))
            uiState.points.size < 2 -> PandaEmptyState(
                title = stringResource(R.string.heatmap_empty_title),
                description = stringResource(R.string.heatmap_empty_description),
                icon = Icons.Filled.Map,
                modifier = Modifier.padding(innerPadding),
            )
            else -> HeatmapMap(
                points = uiState.points,
                initialCenter = uiState.currentLocation,
                modifier = Modifier
                    .fillMaxSize()
                    .padding(innerPadding)
                    // Laisse la place au bandeau de séance active (rendu par-dessus, hors de cet
                    // écran) — sans cette marge la carte interactive s'étend jusqu'au bord et le
                    // recouvre.
                    .padding(bottom = 88.dp),
            )
        }
    }
}
