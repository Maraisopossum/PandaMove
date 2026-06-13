package com.pandafit.feature.breathing.ui

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.expandVertically
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.Image
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.KeyboardArrowUp
import androidx.compose.material.icons.filled.Remove
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.pandafit.designsystem.components.PandaTopBar
import com.pandafit.designsystem.theme.PandaBlue
import com.pandafit.designsystem.theme.PandaGreen
import com.pandafit.designsystem.theme.PandaSubtext
import com.pandafit.feature.breathing.R
import com.pandafit.feature.breathing.method.BreathingMethod
import com.pandafit.feature.breathing.viewmodel.BreathingViewModel
import com.pandafit.feature.breathing.viewmodel.ConfigMode
import java.time.format.DateTimeFormatter
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BreathingMethodSelectionScreen(
    onMethodSelected: (methodId: String, cycles: Int) -> Unit,
    onCreateCustomMethod: () -> Unit = {},
    onEditCustomMethod: (customId: Long) -> Unit = {},
    onOpenDrawer: () -> Unit = {},
    viewModel: BreathingViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val methods by viewModel.methods.collectAsStateWithLifecycle()
    val sessions by viewModel.sessions.collectAsStateWithLifecycle()
    val scrollBehavior = TopAppBarDefaults.exitUntilCollapsedScrollBehavior(rememberTopAppBarState())

    var expandedMethodId by remember { mutableStateOf<String?>(null) }
    var methodToDelete   by remember { mutableStateOf<BreathingMethod?>(null) }
    var historyExpanded  by remember { mutableStateOf(false) }
    var sessionToDelete  by remember { mutableStateOf<Long?>(null) }

    // Dialogue de confirmation de suppression — méthode custom
    methodToDelete?.let { method ->
        AlertDialog(
            onDismissRequest = { methodToDelete = null },
            title = { Text("Supprimer la méthode ?") },
            text  = { Text("« ${method.name} » sera définitivement supprimée.") },
            confirmButton = {
                TextButton(
                    onClick = {
                        method.customId?.let { viewModel.deleteCustomMethod(it) }
                        if (expandedMethodId == method.id) expandedMethodId = null
                        methodToDelete = null
                    }
                ) { Text("Supprimer", color = MaterialTheme.colorScheme.error) }
            },
            dismissButton = {
                TextButton(onClick = { methodToDelete = null }) { Text("Annuler") }
            },
        )
    }

    // Dialogue de confirmation de suppression — séance
    sessionToDelete?.let { id ->
        AlertDialog(
            onDismissRequest = { sessionToDelete = null },
            title = { Text("Supprimer la séance ?") },
            text  = { Text("Cette séance sera définitivement supprimée de l'historique.") },
            confirmButton = {
                TextButton(
                    onClick = { viewModel.deleteSession(id); sessionToDelete = null }
                ) { Text("Supprimer", color = MaterialTheme.colorScheme.error) }
            },
            dismissButton = {
                TextButton(onClick = { sessionToDelete = null }) { Text("Annuler") }
            },
        )
    }

    Scaffold(
        topBar = {
            PandaTopBar(
                title = "Respiration",
                onOpenDrawer = onOpenDrawer,
                scrollBehavior = scrollBehavior,
                actions = {
                    IconButton(onClick = onCreateCustomMethod) {
                        Icon(Icons.Default.Add, contentDescription = "Créer une méthode")
                    }
                },
            )
        },
        containerColor = MaterialTheme.colorScheme.background,
    ) { innerPadding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding),
            contentPadding = PaddingValues(bottom = 32.dp),
        ) {
            // Mascotte en header
            item {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(200.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    Image(
                        painter = painterResource(id = R.drawable.male_meditation_v1),
                        contentDescription = "Panda en méditation",
                        modifier = Modifier.fillMaxHeight(),
                        contentScale = ContentScale.Fit,
                    )
                }
            }

            item {
                Text(
                    "Choisissez une méthode",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                )
            }

            items(methods, key = { it.id }) { method ->
                val isExpanded = expandedMethodId == method.id

                BreathingMethodCard(
                    breathMethod  = method,
                    isExpanded    = isExpanded,
                    configMode    = uiState.configMode,
                    currentValue  = when (uiState.configMode) {
                        ConfigMode.CYCLES  -> uiState.customCycles  ?: method.config.cycles
                        ConfigMode.MINUTES -> uiState.customDurationMinutes ?: method.defaultMinutes()
                    },
                    onToggle = {
                        expandedMethodId = if (expandedMethodId == method.id) null else {
                            viewModel.selectMethod(method)
                            method.id
                        }
                    },
                    onConfigModeChange = viewModel::setConfigMode,
                    onDecrement = {
                        when (uiState.configMode) {
                            ConfigMode.CYCLES  -> viewModel.setCustomCycles(
                                (uiState.customCycles  ?: method.config.cycles) - 1
                            )
                            ConfigMode.MINUTES -> viewModel.setCustomDurationMinutes(
                                (uiState.customDurationMinutes ?: method.defaultMinutes()) - 1
                            )
                        }
                    },
                    onIncrement = {
                        when (uiState.configMode) {
                            ConfigMode.CYCLES  -> viewModel.setCustomCycles(
                                (uiState.customCycles  ?: method.config.cycles) + 1
                            )
                            ConfigMode.MINUTES -> viewModel.setCustomDurationMinutes(
                                (uiState.customDurationMinutes ?: method.defaultMinutes()) + 1
                            )
                        }
                    },
                    onStart = {
                        val cycles = effectiveCycles(
                            method, uiState.configMode, uiState.customCycles, uiState.customDurationMinutes
                        )
                        onMethodSelected(method.id, cycles)
                    },
                    onEdit   = if (method.isCustom) { { method.customId?.let(onEditCustomMethod) } } else null,
                    onDelete = if (method.isCustom) { { methodToDelete = method } } else null,
                )
            }

            // ── Section Historique (repliable) ──────────────────────────────
            if (sessions.isNotEmpty()) {
                item(key = "history_header") {
                    Spacer(Modifier.height(8.dp))
                    HorizontalDivider(modifier = Modifier.padding(horizontal = 16.dp))
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { historyExpanded = !historyExpanded }
                            .padding(horizontal = 16.dp, vertical = 12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween,
                    ) {
                        Text(
                            "Historique (${sessions.size})",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.SemiBold,
                        )
                        Icon(
                            imageVector = if (historyExpanded) Icons.Default.KeyboardArrowUp else Icons.Default.KeyboardArrowDown,
                            contentDescription = if (historyExpanded) "Replier" else "Déplier",
                            tint = PandaSubtext,
                        )
                    }
                }
            }

            if (historyExpanded) {
                items(sessions, key = { "session_${it.id}" }) { session ->
                    BreathingSessionHistoryItem(
                        session = session,
                        onDelete = { sessionToDelete = session.id },
                    )
                }
                item(key = "history_footer") { Spacer(Modifier.height(8.dp)) }
            }
        }
    }
}

// ── Historique item ───────────────────────────────────────────────────────────

private val DATE_FMT = DateTimeFormatter.ofPattern("d MMM yyyy", Locale.FRENCH)

@Composable
private fun BreathingSessionHistoryItem(
    session: com.pandafit.core.database.entities.BreathingSessionEntity,
    onDelete: () -> Unit,
) {
    val durMin = session.durationSeconds / 60
    val durSec = session.durationSeconds % 60
    val durStr = if (durMin > 0) "${durMin}min${if (durSec > 0) " ${durSec}s" else ""}" else "${durSec}s"

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                session.methodName,
                style = MaterialTheme.typography.bodySmall,
                fontWeight = FontWeight.SemiBold,
                maxLines = 1,
            )
            Text(
                "${session.sessionDate.format(DATE_FMT)}  ·  $durStr  ·  ${session.cyclesCompleted} cycles",
                style = MaterialTheme.typography.labelSmall,
                color = PandaSubtext,
            )
        }
        IconButton(onClick = onDelete, modifier = Modifier.size(36.dp)) {
            Icon(
                Icons.Default.Delete,
                contentDescription = "Supprimer",
                modifier = Modifier.size(18.dp),
                tint = MaterialTheme.colorScheme.error.copy(alpha = 0.7f),
            )
        }
    }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

private fun BreathingMethod.cycleDurationMs(): Long = config.activePhases.sumOf { it.second }

private fun BreathingMethod.defaultMinutes(): Int =
    ((config.cycles * cycleDurationMs()) / 60_000L).toInt().coerceAtLeast(1)

private fun effectiveCycles(
    method: BreathingMethod,
    configMode: ConfigMode,
    customCycles: Int?,
    customDurationMinutes: Int?,
): Int = when (configMode) {
    ConfigMode.CYCLES  -> customCycles ?: method.config.cycles
    ConfigMode.MINUTES -> {
        val minutes = customDurationMinutes ?: method.defaultMinutes()
        ((minutes * 60_000L) / method.cycleDurationMs().coerceAtLeast(1L)).toInt().coerceAtLeast(1)
    }
}

// ── Composable carte ──────────────────────────────────────────────────────────

@Composable
private fun BreathingMethodCard(
    breathMethod: BreathingMethod,
    isExpanded: Boolean,
    configMode: ConfigMode,
    currentValue: Int,
    onToggle: () -> Unit,
    onConfigModeChange: (ConfigMode) -> Unit,
    onDecrement: () -> Unit,
    onIncrement: () -> Unit,
    onStart: () -> Unit,
    onEdit: (() -> Unit)?,
    onDelete: (() -> Unit)?,
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 6.dp),
        shape     = MaterialTheme.shapes.medium,
        elevation = CardDefaults.cardElevation(defaultElevation = if (isExpanded) 3.dp else 1.dp),
        colors    = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
    ) {
        Column {
            // ── En-tête cliquable ──
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable(onClick = onToggle)
                    .padding(16.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Text(breathMethod.emoji, style = MaterialTheme.typography.headlineMedium)
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        breathMethod.name,
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.SemiBold,
                    )
                    Text(
                        breathMethod.description,
                        style = MaterialTheme.typography.bodySmall,
                        color = PandaSubtext,
                    )
                }
                // Actions custom (modifier / supprimer) — visibles même quand l'accordéon est fermé
                if (onEdit != null) {
                    IconButton(onClick = onEdit, modifier = Modifier.size(36.dp)) {
                        Icon(Icons.Default.Edit, contentDescription = "Modifier", modifier = Modifier.size(18.dp), tint = PandaSubtext)
                    }
                }
                if (onDelete != null) {
                    IconButton(onClick = onDelete, modifier = Modifier.size(36.dp)) {
                        Icon(Icons.Default.Delete, contentDescription = "Supprimer", modifier = Modifier.size(18.dp), tint = MaterialTheme.colorScheme.error.copy(alpha = 0.7f))
                    }
                }
                // Chevron
                Text(
                    if (isExpanded) "▲" else "▼",
                    style = MaterialTheme.typography.labelSmall,
                    color = PandaSubtext,
                )
            }

            // ── Accordéon de configuration ──
            AnimatedVisibility(
                visible = isExpanded,
                enter   = expandVertically(),
                exit    = shrinkVertically(),
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(start = 16.dp, end = 16.dp, bottom = 16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    HorizontalDivider()

                    // Toggle Cycles / Durée
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text("Durée", style = MaterialTheme.typography.labelMedium, color = PandaSubtext)
                        Spacer(Modifier.width(4.dp))
                        FilterChip(
                            selected = configMode == ConfigMode.CYCLES,
                            onClick  = { onConfigModeChange(ConfigMode.CYCLES) },
                            label    = { Text("Cycles") },
                        )
                        FilterChip(
                            selected = configMode == ConfigMode.MINUTES,
                            onClick  = { onConfigModeChange(ConfigMode.MINUTES) },
                            label    = { Text("Minutes") },
                        )
                    }

                    // Stepper
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.Center,
                    ) {
                        val minVal = 1
                        val maxVal = if (configMode == ConfigMode.CYCLES) 120 else 90
                        val unit   = if (configMode == ConfigMode.CYCLES) "cycles" else "min"

                        FilledIconButton(
                            onClick  = onDecrement,
                            enabled  = currentValue > minVal,
                            modifier = Modifier.size(40.dp),
                        ) { Icon(Icons.Default.Remove, "-", modifier = Modifier.size(18.dp)) }

                        Spacer(Modifier.width(16.dp))
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text(
                                "$currentValue",
                                style      = MaterialTheme.typography.headlineMedium,
                                fontWeight = FontWeight.Bold,
                                color      = PandaBlue,
                            )
                            Text(unit, style = MaterialTheme.typography.labelSmall, color = PandaSubtext)
                        }
                        Spacer(Modifier.width(16.dp))

                        FilledIconButton(
                            onClick  = onIncrement,
                            enabled  = currentValue < maxVal,
                            modifier = Modifier.size(40.dp),
                        ) { Icon(Icons.Default.Add, "+", modifier = Modifier.size(18.dp)) }
                    }

                    // Bouton Démarrer
                    Button(
                        onClick  = onStart,
                        modifier = Modifier.fillMaxWidth(),
                        colors   = ButtonDefaults.buttonColors(containerColor = PandaGreen),
                    ) {
                        Text("Démarrer", fontWeight = FontWeight.SemiBold, style = MaterialTheme.typography.bodyMedium)
                    }
                }
            }
        }
    }
}
