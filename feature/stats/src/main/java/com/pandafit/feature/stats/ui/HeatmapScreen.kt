package com.pandafit.feature.stats.ui

import android.Manifest
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
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
import com.pandafit.core.database.entities.WorkoutType
import com.pandafit.designsystem.components.HeatmapMap
import com.pandafit.designsystem.components.PandaEmptyState
import com.pandafit.designsystem.components.PandaFilterChip
import com.pandafit.designsystem.components.PandaLoadingIndicator
import com.pandafit.designsystem.components.PandaTopBar
import com.pandafit.designsystem.theme.PandaAmber
import com.pandafit.designsystem.theme.PandaBlue
import com.pandafit.designsystem.theme.PandaGreen
import com.pandafit.designsystem.theme.PandaPurple
import com.pandafit.feature.stats.R
import com.pandafit.feature.stats.viewmodel.HEATMAP_SPORTS
import com.pandafit.feature.stats.viewmodel.HeatmapViewModel

/**
 * Heatmap globale — séances GPS (course, vélo, randonnée) superposées en densité de fréquentation,
 * filtrable par sport. Carte interactive (zoom/pan), centrée par défaut sur la position actuelle
 * (cf. [HeatmapViewModel]), échelle de couleur relative à l'utilisateur.
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
        Column(modifier = Modifier.fillMaxSize().padding(innerPadding)) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 10.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                PandaFilterChip(
                    label = stringResource(R.string.heatmap_filter_all),
                    selected = uiState.selectedSport == null,
                    onSelectedChange = { if (it) viewModel.selectSport(null) },
                    selectedColor = PandaPurple,
                    modifier = Modifier.weight(1f),
                )
                HEATMAP_SPORTS.forEach { sport ->
                    PandaFilterChip(
                        label = sportLabel(sport),
                        selected = uiState.selectedSport == sport,
                        onSelectedChange = { if (it) viewModel.selectSport(sport) },
                        selectedColor = sportColor(sport),
                        modifier = Modifier.weight(1f),
                    )
                }
            }

            // weight(1f) : le filtre au-dessus prend sa hauteur naturelle, le reste (carte, vide ou
            // chargement) occupe tout l'espace restant jusqu'au bord bas de l'écran.
            Box(modifier = Modifier.weight(1f).fillMaxWidth()) {
                when {
                    uiState.isLoading || !uiState.isLocationResolved -> PandaLoadingIndicator()
                    uiState.points.size < 2 -> PandaEmptyState(
                        title = stringResource(R.string.heatmap_empty_title),
                        description = stringResource(R.string.heatmap_empty_description),
                        icon = Icons.Filled.Map,
                    )
                    else -> HeatmapMap(
                        points = uiState.points,
                        initialCenter = uiState.currentLocation,
                        modifier = Modifier.fillMaxSize(),
                    )
                }
            }
        }
    }
}

@Composable
private fun sportLabel(sport: WorkoutType): String = when (sport) {
    WorkoutType.RUNNING -> stringResource(R.string.heatmap_filter_running)
    WorkoutType.CYCLING -> stringResource(R.string.heatmap_filter_cycling)
    WorkoutType.HIKING -> stringResource(R.string.heatmap_filter_hiking)
    WorkoutType.STRENGTH -> "" // jamais dans HEATMAP_SPORTS (pas de tracé GPS)
}

private fun sportColor(sport: WorkoutType) = when (sport) {
    WorkoutType.RUNNING -> PandaGreen
    WorkoutType.CYCLING -> PandaBlue
    WorkoutType.HIKING -> PandaAmber
    WorkoutType.STRENGTH -> PandaPurple
}
