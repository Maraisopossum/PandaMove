package com.pandafit.feature.warmup.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.SelfImprovement
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.pandafit.core.database.entities.SeanceCategory
import com.pandafit.core.database.entities.SeanceEntity
import com.pandafit.designsystem.components.AppButton
import com.pandafit.designsystem.components.PandaEmptyState
import com.pandafit.designsystem.components.PandaLoadingIndicator
import com.pandafit.designsystem.components.PandaTopBar
import com.pandafit.designsystem.theme.PandaOrange
import com.pandafit.designsystem.theme.PandaSubtext
import com.pandafit.feature.warmup.R
import com.pandafit.feature.warmup.viewmodel.WarmupListViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun WarmupListScreen(
    onNavigateToDetail: (Long) -> Unit,
    onNavigateToCreate: (category: String) -> Unit,
    onOpenDrawer: () -> Unit = {},
    viewModel: WarmupListViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val categories = listOf(
        SeanceCategory.WARMUP_GENERAL to stringResource(R.string.warmup_category_general),
        SeanceCategory.WARMUP_MOBILITY to stringResource(R.string.warmup_category_mobility),
        SeanceCategory.WARMUP_ACTIVATION to stringResource(R.string.warmup_category_activation),
    )
    val currentWarmups = uiState.warmupsByCategory[uiState.selectedCategory] ?: emptyList()

    Scaffold(
        topBar = { PandaTopBar(title = stringResource(R.string.warmup_screen_title), onOpenDrawer = onOpenDrawer) },
        floatingActionButton = {
            FloatingActionButton(
                onClick = { onNavigateToCreate(uiState.selectedCategory.name) },
                containerColor = PandaOrange,
            ) {
                Icon(Icons.Default.Add, stringResource(R.string.warmup_fab_new_cd), tint = Color.White)
            }
        },
        containerColor = MaterialTheme.colorScheme.background,
    ) { innerPadding ->
        if (uiState.isLoading) { PandaLoadingIndicator(); return@Scaffold }

        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(innerPadding),
            contentPadding = PaddingValues(bottom = 80.dp),
        ) {
            // Category tabs
            item {
                Row(
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    categories.forEach { (cat, label) ->
                        FilterChip(
                            selected = uiState.selectedCategory == cat,
                            onClick = { viewModel.selectCategory(cat) },
                            label = { Text(label) },
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = PandaOrange.copy(alpha = 0.15f),
                                selectedLabelColor = PandaOrange,
                            ),
                        )
                    }
                }
            }

            if (currentWarmups.isEmpty()) {
                item {
                    PandaEmptyState(
                        title = stringResource(R.string.warmup_empty_title),
                        description = stringResource(R.string.warmup_empty_description),
                        icon = Icons.Default.SelfImprovement,
                        action = {
                            AppButton(
                                label = stringResource(R.string.warmup_create_button),
                                onClick = { onNavigateToCreate(uiState.selectedCategory.name) },
                                color = PandaOrange,
                            )
                        },
                    )
                }
            } else {
                items(currentWarmups, key = { it.id }) { warmup ->
                    WarmupCard(warmup = warmup, onClick = { onNavigateToDetail(warmup.id) })
                }
            }
        }
    }
}

@Composable
private fun WarmupCard(warmup: SeanceEntity, onClick: () -> Unit) {
    Card(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(1.dp),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                modifier = Modifier.size(40.dp).padding(end = 12.dp),
                contentAlignment = Alignment.Center,
            ) {
                Icon(Icons.Default.SelfImprovement, null, tint = PandaOrange, modifier = Modifier.size(28.dp))
            }
            Column(modifier = Modifier.weight(1f)) {
                Text(warmup.nom, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold)
                if (warmup.notes.isNotBlank()) {
                    Text(warmup.notes, style = MaterialTheme.typography.bodySmall, color = PandaSubtext, maxLines = 1)
                }
            }
        }
    }
}
