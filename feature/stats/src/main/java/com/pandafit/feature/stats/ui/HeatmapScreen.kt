package com.pandafit.feature.stats.ui

import android.Manifest
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.DirectionsBike
import androidx.compose.material.icons.automirrored.filled.DirectionsRun
import androidx.compose.material.icons.filled.Landscape
import androidx.compose.material.icons.filled.Map
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.pandafit.core.database.entities.WorkoutType
import com.pandafit.designsystem.components.HeatmapMap
import com.pandafit.designsystem.components.PandaEmptyState
import com.pandafit.designsystem.components.PandaIconToggle
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
            // Toggles ronds pictogramme seul — même style que les filtres sport du Calendrier.
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                PandaIconToggle(
                    icon = Icons.Filled.Map,
                    color = PandaPurple,
                    selected = uiState.selectedSport == null,
                    onClick = { viewModel.selectSport(null) },
                    contentDescription = stringResource(R.string.heatmap_filter_all),
                )
                HEATMAP_SPORTS.forEach { sport ->
                    PandaIconToggle(
                        icon = sportIcon(sport),
                        color = sportColor(sport),
                        selected = uiState.selectedSport == sport,
                        onClick = { viewModel.selectSport(sport) },
                        contentDescription = sportLabel(sport),
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

private fun sportIcon(sport: WorkoutType): ImageVector = when (sport) {
    WorkoutType.RUNNING -> Icons.AutoMirrored.Filled.DirectionsRun
    WorkoutType.CYCLING -> Icons.AutoMirrored.Filled.DirectionsBike
    WorkoutType.HIKING -> Icons.Filled.Landscape
    WorkoutType.STRENGTH -> Icons.Filled.Map
}

private fun sportColor(sport: WorkoutType) = when (sport) {
    WorkoutType.RUNNING -> PandaGreen
    WorkoutType.CYCLING -> PandaBlue
    WorkoutType.HIKING -> PandaAmber
    WorkoutType.STRENGTH -> PandaPurple
}
