package com.pandafit.feature.profile.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.pandafit.core.database.catalog.EquipmentCategory
import com.pandafit.designsystem.components.PandaTopBar
import com.pandafit.designsystem.theme.PandaGreen
import com.pandafit.feature.profile.viewmodel.EquipmentViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EquipmentScreen(
    onNavigateBack: () -> Unit,
    viewModel: EquipmentViewModel = hiltViewModel(),
) {
    val selected by viewModel.selected.collectAsStateWithLifecycle()

    Scaffold(
        topBar = { PandaTopBar(title = "Mon matériel", onNavigateBack = onNavigateBack) },
        containerColor = MaterialTheme.colorScheme.background,
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .padding(horizontal = 16.dp),
        ) {
            Spacer(Modifier.height(8.dp))
            Text(
                "Sélectionne le matériel que tu as à disposition. Les exercices seront filtrés en conséquence.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Spacer(Modifier.height(16.dp))
            LazyVerticalGrid(
                columns = GridCells.Fixed(2),
                modifier = Modifier.weight(1f),
                contentPadding = PaddingValues(bottom = 16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                items(EquipmentCategory.entries) { category ->
                    val isSelected = category in selected
                    Card(
                        onClick = { viewModel.toggle(category) },
                        colors = CardDefaults.cardColors(
                            containerColor = if (isSelected) PandaGreen.copy(alpha = 0.12f)
                            else MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
                        ),
                        border = if (isSelected) BorderStroke(1.5.dp, PandaGreen) else null,
                    ) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 16.dp, horizontal = 8.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(6.dp),
                        ) {
                            Text(category.emoji, style = MaterialTheme.typography.headlineSmall)
                            Text(
                                category.label,
                                style = MaterialTheme.typography.labelMedium,
                                fontWeight = if (isSelected) FontWeight.SemiBold else FontWeight.Normal,
                                color = if (isSelected) PandaGreen else MaterialTheme.colorScheme.onSurface,
                                textAlign = TextAlign.Center,
                            )
                        }
                    }
                }
            }
            Row(
                modifier = Modifier.fillMaxWidth().padding(bottom = 16.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Button(
                    onClick = { viewModel.selectAll() },
                    modifier = Modifier.weight(1f),
                ) { Text("Tout sélectionner") }
                Button(
                    onClick = { viewModel.clearAll() },
                    modifier = Modifier.weight(1f),
                ) { Text("Tout désélectionner") }
            }
        }
    }
}
