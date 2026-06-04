package com.pandafit.feature.strength.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.FitnessCenter
import androidx.compose.material3.Badge
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.rememberTopAppBarState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.pandafit.core.database.entities.WorkoutEntity
import com.pandafit.designsystem.components.AppButton
import com.pandafit.designsystem.components.PandaCard
import com.pandafit.designsystem.components.PandaEmptyState
import com.pandafit.designsystem.components.PandaErrorState
import com.pandafit.designsystem.components.PandaLoadingIndicator
import com.pandafit.designsystem.components.PandaTopBar
import com.pandafit.designsystem.components.SportIconBadge
import com.pandafit.designsystem.theme.PandaPurple
import com.pandafit.designsystem.theme.PandaSubtext
import com.pandafit.feature.strength.viewmodel.StrengthListViewModel
import java.time.format.DateTimeFormatter
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun StrengthScreen(
    onNavigateToDetail: (Long) -> Unit,
    onNavigateToCreate: () -> Unit,
    viewModel: StrengthListViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val scrollBehavior = TopAppBarDefaults.exitUntilCollapsedScrollBehavior(rememberTopAppBarState())

    Scaffold(
        modifier = Modifier.nestedScroll(scrollBehavior.nestedScrollConnection),
        topBar = { PandaTopBar(title = "Renforcement", scrollBehavior = scrollBehavior) },
        floatingActionButton = {
            FloatingActionButton(onClick = onNavigateToCreate, containerColor = PandaPurple) {
                Icon(Icons.Default.Add, "Nouvelle séance", tint = MaterialTheme.colorScheme.onPrimary)
            }
        },
        containerColor = MaterialTheme.colorScheme.background,
    ) { innerPadding ->
        when {
            uiState.isLoading -> PandaLoadingIndicator()
            uiState.error != null -> PandaErrorState(description = uiState.error!!, modifier = Modifier.padding(innerPadding))
            uiState.workouts.isEmpty() -> PandaEmptyState(
                title = "Aucune séance de renforcement",
                description = "Crée ta première séance musculaire.",
                icon = Icons.Default.FitnessCenter,
                action = { AppButton(label = "Créer une séance", onClick = onNavigateToCreate) },
                modifier = Modifier.padding(innerPadding),
            )
            else -> LazyColumn(
                modifier = Modifier.fillMaxSize().padding(innerPadding),
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                items(uiState.workouts, key = { it.id }) { workout ->
                    StrengthWorkoutCard(workout = workout, onClick = { onNavigateToDetail(workout.id) })
                }
            }
        }
    }
}

@Composable
private fun StrengthWorkoutCard(workout: WorkoutEntity, onClick: () -> Unit) {
    PandaCard(onClick = onClick, modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            SportIconBadge(icon = Icons.Default.FitnessCenter, contentDescription = null, accentColor = PandaPurple)
            Spacer(Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(text = workout.name, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                Spacer(Modifier.height(2.dp))
                Text(
                    text = workout.scheduledDate.format(DateTimeFormatter.ofPattern("EEEE d MMMM", Locale.FRENCH)),
                    style = MaterialTheme.typography.bodySmall, color = PandaSubtext,
                )
            }
            if (workout.isCompleted) {
                Badge(containerColor = PandaPurple) { Text("✓") }
            }
        }
    }
}
