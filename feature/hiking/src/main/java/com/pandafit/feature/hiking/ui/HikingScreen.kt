package com.pandafit.feature.hiking.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Landscape
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.pandafit.core.database.entities.WorkoutEntity
import com.pandafit.designsystem.components.PandaEmptyState
import com.pandafit.designsystem.components.PandaLoadingIndicator
import com.pandafit.designsystem.components.PandaTopBar
import com.pandafit.designsystem.theme.PandaAmber
import com.pandafit.designsystem.theme.PandaSubtext
import com.pandafit.feature.hiking.viewmodel.HikingListViewModel
import java.time.format.DateTimeFormatter
import java.time.format.TextStyle
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class, androidx.compose.foundation.ExperimentalFoundationApi::class)
@Composable
fun HikingScreen(
    onNavigateToReport: (Long) -> Unit,
    onNavigateToEncode: () -> Unit,
    onOpenDrawer: () -> Unit = {},
    viewModel: HikingListViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val scrollBehavior = TopAppBarDefaults.exitUntilCollapsedScrollBehavior(rememberTopAppBarState())

    var selectedIds by remember { mutableStateOf(setOf<Long>()) }
    val isSelectionMode = selectedIds.isNotEmpty()
    var showDeleteDialog by remember { mutableStateOf(false) }

    if (showDeleteDialog) {
        AlertDialog(
            onDismissRequest = { showDeleteDialog = false },
            title = { Text("Supprimer ${selectedIds.size} sortie(s) ?") },
            text = { Text("Cette action est irréversible.") },
            confirmButton = {
                TextButton(onClick = {
                    selectedIds.forEach { viewModel.delete(it) }
                    selectedIds = emptySet()
                    showDeleteDialog = false
                }) { Text("Supprimer", color = MaterialTheme.colorScheme.error) }
            },
            dismissButton = {
                TextButton(onClick = { showDeleteDialog = false }) { Text("Annuler") }
            },
        )
    }

    Scaffold(
        topBar = {
            PandaTopBar(
                title = if (isSelectionMode) "${selectedIds.size} sélectionné(e)(s)" else "Randonnée",
                containerColor = PandaAmber,
                scrollBehavior = scrollBehavior,
                onNavigateBack = if (isSelectionMode) ({ selectedIds = emptySet() }) else null,
                onOpenDrawer = if (!isSelectionMode) onOpenDrawer else null,
                actions = {
                    if (isSelectionMode) {
                        IconButton(onClick = { showDeleteDialog = true }) {
                            Icon(Icons.Default.Delete, contentDescription = "Supprimer", tint = Color.White)
                        }
                    }
                },
            )
        },
        floatingActionButton = {
            if (!isSelectionMode) {
                FloatingActionButton(
                    onClick = onNavigateToEncode,
                    containerColor = PandaAmber,
                    contentColor = Color.White,
                ) {
                    Icon(Icons.Default.Add, contentDescription = "Encoder une sortie")
                }
            }
        },
        modifier = Modifier.nestedScroll(scrollBehavior.nestedScrollConnection),
    ) { innerPadding ->
        if (uiState.isLoading) { PandaLoadingIndicator(); return@Scaffold }

        if (uiState.completed.isEmpty()) {
            PandaEmptyState(
                icon = Icons.Default.Landscape,
                title = "Aucune sortie rando",
                description = "Encode ta première randonnée avec le bouton +",
                modifier = Modifier.padding(innerPadding),
            )
            return@Scaffold
        }

        LazyColumn(
            contentPadding = PaddingValues(
                top = innerPadding.calculateTopPadding() + 8.dp,
                bottom = innerPadding.calculateBottomPadding() + 80.dp,
                start = 16.dp,
                end = 16.dp,
            ),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            item {
                Text(
                    "SORTIES TERMINÉES",
                    style = MaterialTheme.typography.labelSmall,
                    color = PandaSubtext,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(bottom = 4.dp),
                )
            }
            items(uiState.completed, key = { it.id }) { workout ->
                HikingWorkoutCard(
                    workout = workout,
                    isSelected = workout.id in selectedIds,
                    onClick = {
                        if (isSelectionMode) {
                            selectedIds = if (workout.id in selectedIds) selectedIds - workout.id else selectedIds + workout.id
                        } else {
                            onNavigateToReport(workout.id)
                        }
                    },
                    onLongClick = {
                        selectedIds = if (workout.id in selectedIds) selectedIds - workout.id else selectedIds + workout.id
                    },
                )
            }
        }
    }
}

@OptIn(androidx.compose.foundation.ExperimentalFoundationApi::class)
@Composable
private fun HikingWorkoutCard(
    workout: WorkoutEntity,
    isSelected: Boolean,
    onClick: () -> Unit,
    onLongClick: () -> Unit,
) {
    val dateFmt = DateTimeFormatter.ofPattern("d MMMM yyyy", Locale.FRENCH)
    val dayName = workout.scheduledDate.dayOfWeek
        .getDisplayName(TextStyle.FULL, Locale.FRENCH)
        .replaceFirstChar { it.uppercaseChar() }

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .combinedClickable(onClick = onClick, onLongClick = onLongClick),
        shape = MaterialTheme.shapes.medium,
        colors = CardDefaults.cardColors(
            containerColor = if (isSelected) PandaAmber.copy(alpha = 0.12f) else MaterialTheme.colorScheme.surface,
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
    ) {
        Row(modifier = Modifier.fillMaxWidth()) {
            Box(
                modifier = Modifier
                    .width(4.dp)
                    .height(72.dp)
                    .background(PandaAmber)
            )
            Column(
                modifier = Modifier.padding(start = 12.dp, top = 12.dp, end = 12.dp, bottom = 12.dp)
            ) {
                Text(
                    workout.name,
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.onSurface,
                )
                Text(
                    "$dayName ${workout.scheduledDate.format(dateFmt)}",
                    style = MaterialTheme.typography.bodySmall,
                    color = PandaSubtext,
                )
                val stats = buildList {
                    workout.resultDistanceKm?.let { add("${"%.1f".format(it)} km") }
                    workout.resultDurationSec?.let {
                        val h = it / 3600; val m = (it % 3600) / 60
                        add(if (h > 0) "${h}h${m.toString().padStart(2, '0')}" else "${m}min")
                    }
                    workout.resultElevationM?.let { add("↑ ${it}m") }
                }.joinToString(" · ")
                if (stats.isNotBlank()) {
                    Text(
                        stats,
                        style = MaterialTheme.typography.labelMedium,
                        color = PandaAmber,
                        fontWeight = FontWeight.SemiBold,
                    )
                }
            }
        }
    }
}
