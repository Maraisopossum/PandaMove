package com.pandafit.feature.breathing.ui

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Remove
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.pandafit.core.database.entities.CustomBreathingMethodEntity
import androidx.compose.ui.graphics.Color
import com.pandafit.designsystem.components.PandaTopBar
import com.pandafit.designsystem.theme.KalyptusGreen
import com.pandafit.designsystem.theme.PandaSubtext
import com.pandafit.feature.breathing.R
import com.pandafit.feature.breathing.viewmodel.BreathingViewModel
import kotlinx.coroutines.launch

/**
 * Écran de création / modification d'une méthode de respiration personnalisée.
 *
 * [customId] = null → création ; non-null → édition de la méthode existante.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BreathingMethodCreateScreen(
    customId: Long? = null,
    onNavigateBack: () -> Unit,
    viewModel: BreathingViewModel = hiltViewModel(),
) {
    val scope = rememberCoroutineScope()
    val isEditing = customId != null

    // Champs du formulaire
    var name            by remember { mutableStateOf("") }
    var emoji           by remember { mutableStateOf("🌬️") }
    var inhaleSeconds   by remember { mutableIntStateOf(4) }
    var holdInEnabled   by remember { mutableStateOf(false) }
    var holdInSeconds   by remember { mutableIntStateOf(4) }
    var exhaleSeconds   by remember { mutableIntStateOf(4) }
    var holdOutEnabled  by remember { mutableStateOf(false) }
    var holdOutSeconds  by remember { mutableIntStateOf(4) }
    var defaultCycles   by remember { mutableIntStateOf(6) }

    // Pré-remplissage en mode édition
    var loaded by remember { mutableStateOf(false) }
    LaunchedEffect(customId) {
        if (customId != null && !loaded) {
            viewModel.getCustomMethodEntity(customId)?.let { entity ->
                name           = entity.name
                emoji          = entity.emoji
                inhaleSeconds  = entity.inhaleSeconds
                holdInEnabled  = entity.holdInSeconds > 0
                holdInSeconds  = entity.holdInSeconds.coerceAtLeast(1)
                exhaleSeconds  = entity.exhaleSeconds
                holdOutEnabled = entity.holdOutSeconds > 0
                holdOutSeconds = entity.holdOutSeconds.coerceAtLeast(1)
                defaultCycles  = entity.defaultCycles
            }
            loaded = true
        }
    }

    // Description auto-générée en temps réel
    val generatedDescription = remember(inhaleSeconds, holdInEnabled, holdInSeconds,
        exhaleSeconds, holdOutEnabled, holdOutSeconds, defaultCycles) {
        val phases = buildList {
            add("${inhaleSeconds}s")
            if (holdInEnabled)  add("${holdInSeconds}s")
            add("${exhaleSeconds}s")
            if (holdOutEnabled) add("${holdOutSeconds}s")
        }
        "${phases.joinToString(" · ")} — $defaultCycles cycles"
    }

    val canSave = name.isNotBlank()

    Scaffold(
        topBar = {
            PandaTopBar(
                title          = if (isEditing) stringResource(R.string.breathing_create_title_edit) else stringResource(R.string.breathing_create_title_new),
                onNavigateBack = onNavigateBack,
                containerColor = KalyptusGreen,
                contentColor   = Color.White,
            )
        },
        containerColor = MaterialTheme.colorScheme.background,
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(20.dp),
        ) {

            // ── Identité ────────────────────────────────────────────────────
            Text(stringResource(R.string.breathing_create_section_identity), style = MaterialTheme.typography.labelLarge, color = PandaSubtext)

            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                OutlinedTextField(
                    value         = emoji,
                    onValueChange = { if (it.length <= 8) emoji = it },
                    label         = { Text(stringResource(R.string.breathing_create_emoji_label)) },
                    singleLine    = true,
                    modifier      = Modifier.width(90.dp),
                )
                OutlinedTextField(
                    value         = name,
                    onValueChange = { name = it },
                    label         = { Text(stringResource(R.string.breathing_create_name_label)) },
                    singleLine    = true,
                    keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences),
                    modifier      = Modifier.weight(1f),
                )
            }

            // ── Phases ───────────────────────────────────────────────────────
            Text(stringResource(R.string.breathing_create_section_phases), style = MaterialTheme.typography.labelLarge, color = PandaSubtext)

            PhaseRow(
                label    = stringResource(R.string.breathing_create_phase_inhale),
                seconds  = inhaleSeconds,
                enabled  = true,    // toujours active
                onToggle = null,
                onDecrement = { if (inhaleSeconds > 1) inhaleSeconds-- },
                onIncrement = { if (inhaleSeconds < 60) inhaleSeconds++ },
            )
            PhaseRow(
                label    = stringResource(R.string.breathing_create_phase_hold_in),
                seconds  = holdInSeconds,
                enabled  = holdInEnabled,
                onToggle = { holdInEnabled = it },
                onDecrement = { if (holdInSeconds > 1) holdInSeconds-- },
                onIncrement = { if (holdInSeconds < 60) holdInSeconds++ },
            )
            PhaseRow(
                label    = stringResource(R.string.breathing_create_phase_exhale),
                seconds  = exhaleSeconds,
                enabled  = true,    // toujours active
                onToggle = null,
                onDecrement = { if (exhaleSeconds > 1) exhaleSeconds-- },
                onIncrement = { if (exhaleSeconds < 60) exhaleSeconds++ },
            )
            PhaseRow(
                label    = stringResource(R.string.breathing_create_phase_hold_out),
                seconds  = holdOutSeconds,
                enabled  = holdOutEnabled,
                onToggle = { holdOutEnabled = it },
                onDecrement = { if (holdOutSeconds > 1) holdOutSeconds-- },
                onIncrement = { if (holdOutSeconds < 60) holdOutSeconds++ },
            )

            // ── Nombre de cycles ─────────────────────────────────────────────
            Text(stringResource(R.string.breathing_create_cycles_section), style = MaterialTheme.typography.labelLarge, color = PandaSubtext)

            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                FilledIconButton(
                    onClick  = { if (defaultCycles > 1) defaultCycles-- },
                    enabled  = defaultCycles > 1,
                    modifier = Modifier.size(40.dp),
                ) { Icon(Icons.Default.Remove, "-", modifier = Modifier.size(18.dp)) }

                Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.width(72.dp)) {
                    Text(
                        "$defaultCycles",
                        style      = MaterialTheme.typography.headlineMedium,
                        fontWeight = FontWeight.Bold,
                        color      = KalyptusGreen,
                    )
                    Text(stringResource(R.string.breathing_create_cycles_unit), style = MaterialTheme.typography.labelSmall, color = PandaSubtext)
                }

                FilledIconButton(
                    onClick  = { if (defaultCycles < 120) defaultCycles++ },
                    enabled  = defaultCycles < 120,
                    modifier = Modifier.size(40.dp),
                ) { Icon(Icons.Default.Add, "+", modifier = Modifier.size(18.dp)) }
            }

            // ── Aperçu description ───────────────────────────────────────────
            Card(
                colors = CardDefaults.cardColors(containerColor = KalyptusGreen.copy(alpha = 0.08f)),
                elevation = CardDefaults.cardElevation(0.dp),
            ) {
                Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(
                        stringResource(R.string.breathing_create_preview_label),
                        style = MaterialTheme.typography.labelSmall,
                        color = PandaSubtext,
                    )
                    Text(
                        generatedDescription,
                        style      = MaterialTheme.typography.bodyMedium,
                        fontWeight = FontWeight.SemiBold,
                    )
                }
            }

            // ── Bouton de sauvegarde ─────────────────────────────────────────
            Button(
                onClick = {
                    scope.launch {
                        val entity = CustomBreathingMethodEntity(
                            id             = customId ?: 0L,
                            name           = name.trim(),
                            emoji          = emoji.trim().ifBlank { "🌬️" },
                            inhaleSeconds  = inhaleSeconds,
                            holdInSeconds  = if (holdInEnabled) holdInSeconds else 0,
                            exhaleSeconds  = exhaleSeconds,
                            holdOutSeconds = if (holdOutEnabled) holdOutSeconds else 0,
                            defaultCycles  = defaultCycles,
                        )
                        if (isEditing) viewModel.updateCustomMethod(entity)
                        else viewModel.createCustomMethod(entity)
                        onNavigateBack()
                    }
                },
                modifier = Modifier.fillMaxWidth(),
                enabled  = canSave,
                colors   = ButtonDefaults.buttonColors(containerColor = KalyptusGreen),
            ) {
                Text(
                    if (isEditing) stringResource(R.string.breathing_create_save_edit) else stringResource(R.string.breathing_create_save_new),
                    fontWeight = FontWeight.SemiBold,
                )
            }

            Spacer(Modifier.height(16.dp))
        }
    }
}

// ── Composant ligne de phase ──────────────────────────────────────────────────

@Composable
private fun PhaseRow(
    label: String,
    seconds: Int,
    enabled: Boolean,
    onToggle: ((Boolean) -> Unit)?,   // null = toujours active, pas de checkbox
    onDecrement: () -> Unit,
    onIncrement: () -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        // Checkbox d'activation (phases optionnelles uniquement)
        if (onToggle != null) {
            Checkbox(
                checked         = enabled,
                onCheckedChange = onToggle,
            )
        } else {
            Spacer(Modifier.size(48.dp))
        }

        Text(
            label,
            style    = MaterialTheme.typography.bodyMedium,
            modifier = Modifier.weight(1f),
            color    = if (enabled) MaterialTheme.colorScheme.onSurface
                       else PandaSubtext.copy(alpha = 0.5f),
        )

        // Stepper de durée
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            FilledIconButton(
                onClick  = onDecrement,
                enabled  = enabled && seconds > 1,
                modifier = Modifier.size(32.dp),
            ) { Icon(Icons.Default.Remove, "-", modifier = Modifier.size(14.dp)) }

            Text(
                "${seconds}s",
                style      = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.SemiBold,
                modifier   = Modifier.width(40.dp),
                color      = if (enabled) KalyptusGreen else PandaSubtext.copy(alpha = 0.5f),
            )

            FilledIconButton(
                onClick  = onIncrement,
                enabled  = enabled && seconds < 60,
                modifier = Modifier.size(32.dp),
            ) { Icon(Icons.Default.Add, "+", modifier = Modifier.size(14.dp)) }
        }
    }
}
