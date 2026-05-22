package com.pandafit.feature.stats.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.pandafit.designsystem.components.PandaCard
import com.pandafit.designsystem.components.PandaFilterChip
import com.pandafit.designsystem.components.PandaTopBar
import com.pandafit.designsystem.theme.PandaGreen
import com.pandafit.designsystem.theme.PandaPurple
import com.pandafit.designsystem.theme.PandaSubtext
import com.pandafit.feature.stats.model.DISTANCE_PRESETS
import com.pandafit.feature.stats.model.MONUMENT_PRESETS
import com.pandafit.feature.stats.model.SUMMIT_PRESETS
import com.pandafit.feature.stats.model.WEIGHT_PRESETS
import com.pandafit.feature.stats.viewmodel.StatsConfigViewModel

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun StatsConfigScreen(
    onNavigateBack: () -> Unit = {},
    viewModel: StatsConfigViewModel = hiltViewModel(),
) {
    val config by viewModel.config.collectAsStateWithLifecycle()

    Scaffold(
        topBar = {
            PandaTopBar(
                title = "Configuration des statistiques",
                onNavigateBack = onNavigateBack,
            )
        },
        containerColor = MaterialTheme.colorScheme.background,
    ) { innerPadding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            item {
                Text(
                    "Course à pieds",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                )
                Spacer(Modifier.height(8.dp))
                PandaCard(modifier = Modifier.fillMaxWidth()) {
                    Column(
                        modifier = Modifier.padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(16.dp),
                    ) {
                        ChipSection(
                            title = "Distance 1",
                            subtitle = "Référence principale de distance",
                            color = PandaGreen,
                        ) {
                            FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                DISTANCE_PRESETS.forEachIndexed { idx, preset ->
                                    PandaFilterChip(
                                        label = "${preset.emoji} ${preset.label}",
                                        selected = config.runDist1Idx == idx,
                                        onSelectedChange = { if (it) viewModel.setRunDist1(idx) },
                                        selectedColor = PandaGreen,
                                    )
                                }
                            }
                        }

                        ChipSection(
                            title = "Distance 2",
                            subtitle = "Référence secondaire de distance",
                            color = PandaGreen,
                        ) {
                            FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                DISTANCE_PRESETS.forEachIndexed { idx, preset ->
                                    PandaFilterChip(
                                        label = "${preset.emoji} ${preset.label}",
                                        selected = config.runDist2Idx == idx,
                                        onSelectedChange = { if (it) viewModel.setRunDist2(idx) },
                                        selectedColor = PandaGreen,
                                    )
                                }
                            }
                        }

                        ChipSection(
                            title = "Sommet",
                            subtitle = "Calculé avec le dénivelé réel de tes séances",
                            color = PandaGreen,
                        ) {
                            FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                SUMMIT_PRESETS.forEachIndexed { idx, preset ->
                                    PandaFilterChip(
                                        label = "${preset.emoji} ${preset.label} (${preset.elevationM} m)",
                                        selected = config.runSummitIdx == idx,
                                        onSelectedChange = { if (it) viewModel.setRunSummit(idx) },
                                        selectedColor = PandaGreen,
                                    )
                                }
                            }
                        }
                    }
                }
            }

            item {
                Text(
                    "Renforcement",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                )
                Spacer(Modifier.height(8.dp))
                PandaCard(modifier = Modifier.fillMaxWidth()) {
                    Column(
                        modifier = Modifier.padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(16.dp),
                    ) {
                        ChipSection(
                            title = "Animal / Objet 1",
                            subtitle = "Premier équivalent de tonnage",
                            color = PandaPurple,
                        ) {
                            FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                WEIGHT_PRESETS.forEachIndexed { idx, preset ->
                                    PandaFilterChip(
                                        label = "${preset.emoji} ${preset.label} (${preset.kg.toInt()} kg)",
                                        selected = config.strWeight1Idx == idx,
                                        onSelectedChange = { if (it) viewModel.setStrWeight1(idx) },
                                        selectedColor = PandaPurple,
                                    )
                                }
                            }
                        }

                        ChipSection(
                            title = "Animal / Objet 2",
                            subtitle = "Deuxième équivalent de tonnage",
                            color = PandaPurple,
                        ) {
                            FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                WEIGHT_PRESETS.forEachIndexed { idx, preset ->
                                    PandaFilterChip(
                                        label = "${preset.emoji} ${preset.label} (${preset.kg.toInt()} kg)",
                                        selected = config.strWeight2Idx == idx,
                                        onSelectedChange = { if (it) viewModel.setStrWeight2(idx) },
                                        selectedColor = PandaPurple,
                                    )
                                }
                            }
                        }

                        ChipSection(
                            title = "Animal / Objet 3",
                            subtitle = "Troisième équivalent de tonnage",
                            color = PandaPurple,
                        ) {
                            FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                WEIGHT_PRESETS.forEachIndexed { idx, preset ->
                                    PandaFilterChip(
                                        label = "${preset.emoji} ${preset.label} (${preset.kg.toInt()} kg)",
                                        selected = config.strWeight3Idx == idx,
                                        onSelectedChange = { if (it) viewModel.setStrWeight3(idx) },
                                        selectedColor = PandaPurple,
                                    )
                                }
                            }
                        }

                        ChipSection(
                            title = "Monument",
                            subtitle = "Référence de tonnage monumentale",
                            color = PandaPurple,
                        ) {
                            FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                MONUMENT_PRESETS.forEachIndexed { idx, preset ->
                                    val label = when {
                                        preset.kg >= 1_000_000 -> "${"%.1f".format(preset.kg / 1_000_000)} Mt"
                                        preset.kg >= 1_000 -> "${"%.0f".format(preset.kg / 1_000)} t"
                                        else -> "${preset.kg.toInt()} kg"
                                    }
                                    PandaFilterChip(
                                        label = "${preset.emoji} ${preset.label} ($label)",
                                        selected = config.strMonumentIdx == idx,
                                        onSelectedChange = { if (it) viewModel.setStrMonument(idx) },
                                        selectedColor = PandaPurple,
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ChipSection(
    title: String,
    subtitle: String,
    color: androidx.compose.ui.graphics.Color,
    content: @Composable () -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(title, style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.SemiBold, color = color)
        Text(subtitle, style = MaterialTheme.typography.labelSmall, color = PandaSubtext)
        content()
    }
}
