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
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.pandafit.designsystem.components.PandaCard
import com.pandafit.designsystem.components.PandaFilterChip
import com.pandafit.designsystem.components.PandaTopBar
import com.pandafit.designsystem.theme.PandaBlue
import com.pandafit.designsystem.theme.PandaGreen
import com.pandafit.designsystem.theme.PandaPurple
import com.pandafit.designsystem.theme.PandaSubtext
import com.pandafit.feature.stats.model.DISTANCE_PRESETS
import com.pandafit.feature.stats.model.MONUMENT_PRESETS
import com.pandafit.feature.stats.model.SUMMIT_PRESETS
import com.pandafit.feature.stats.model.WEIGHT_PRESETS
import com.pandafit.feature.stats.R
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
                title = stringResource(R.string.stats_config_screen_title),
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
                    stringResource(R.string.stats_config_running_title),
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
                            title = stringResource(R.string.stats_config_distance1_title),
                            subtitle = stringResource(R.string.stats_config_distance1_subtitle),
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
                            title = stringResource(R.string.stats_config_distance2_title),
                            subtitle = stringResource(R.string.stats_config_distance2_subtitle),
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
                            title = stringResource(R.string.stats_config_summit_title),
                            subtitle = stringResource(R.string.stats_config_summit_subtitle_running),
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
                    stringResource(R.string.stats_config_cycling_title),
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
                            title = stringResource(R.string.stats_config_distance1_title),
                            subtitle = stringResource(R.string.stats_config_distance1_subtitle),
                            color = PandaBlue,
                        ) {
                            FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                DISTANCE_PRESETS.forEachIndexed { idx, preset ->
                                    PandaFilterChip(
                                        label = "${preset.emoji} ${preset.label}",
                                        selected = config.cycDist1Idx == idx,
                                        onSelectedChange = { if (it) viewModel.setCycDist1(idx) },
                                        selectedColor = PandaBlue,
                                    )
                                }
                            }
                        }

                        ChipSection(
                            title = stringResource(R.string.stats_config_distance2_title),
                            subtitle = stringResource(R.string.stats_config_distance2_subtitle),
                            color = PandaBlue,
                        ) {
                            FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                DISTANCE_PRESETS.forEachIndexed { idx, preset ->
                                    PandaFilterChip(
                                        label = "${preset.emoji} ${preset.label}",
                                        selected = config.cycDist2Idx == idx,
                                        onSelectedChange = { if (it) viewModel.setCycDist2(idx) },
                                        selectedColor = PandaBlue,
                                    )
                                }
                            }
                        }

                        ChipSection(
                            title = stringResource(R.string.stats_config_summit_title),
                            subtitle = stringResource(R.string.stats_config_summit_subtitle_cycling),
                            color = PandaBlue,
                        ) {
                            FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                SUMMIT_PRESETS.forEachIndexed { idx, preset ->
                                    PandaFilterChip(
                                        label = "${preset.emoji} ${preset.label} (${preset.elevationM} m)",
                                        selected = config.cycSummitIdx == idx,
                                        onSelectedChange = { if (it) viewModel.setCycSummit(idx) },
                                        selectedColor = PandaBlue,
                                    )
                                }
                            }
                        }
                    }
                }
            }

            item {
                Text(
                    stringResource(R.string.stats_config_strength_title),
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
                            title = stringResource(R.string.stats_config_weight1_title),
                            subtitle = stringResource(R.string.stats_config_weight1_subtitle),
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
                            title = stringResource(R.string.stats_config_weight2_title),
                            subtitle = stringResource(R.string.stats_config_weight2_subtitle),
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
                            title = stringResource(R.string.stats_config_weight3_title),
                            subtitle = stringResource(R.string.stats_config_weight3_subtitle),
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
                            title = stringResource(R.string.stats_config_monument_title),
                            subtitle = stringResource(R.string.stats_config_monument_subtitle),
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
