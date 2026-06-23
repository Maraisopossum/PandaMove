package com.pandafit.feature.profile.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Remove
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.pandafit.core.database.catalog.DisquesConfig
import com.pandafit.core.database.catalog.HalteresConfig
import com.pandafit.core.database.catalog.PlageConfig
import com.pandafit.designsystem.theme.PandaPurple
import com.pandafit.designsystem.theme.PandaSubtext
import com.pandafit.feature.profile.R

private val DENOMINATIONS_STANDARD = listOf(1.25f, 2.5f, 5f, 10f, 15f, 20f, 25f)

private fun Float.formatKg(): String = if (this == toInt().toFloat()) "${toInt()}" else "$this"

@Composable
private fun ConfigDialogShell(
    title: String,
    onDismiss: () -> Unit,
    onSave: () -> Unit,
    content: @Composable () -> Unit,
) {
    Dialog(onDismissRequest = onDismiss, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Surface(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 24.dp),
            shape = RoundedCornerShape(28.dp),
            color = MaterialTheme.colorScheme.surface,
            tonalElevation = 6.dp,
        ) {
            Column(modifier = Modifier.padding(24.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                Text(title, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.SemiBold)
                content()
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                    TextButton(onClick = onDismiss) { Text(stringResource(R.string.equipment_dialog_cancel)) }
                    TextButton(onClick = onSave) { Text(stringResource(R.string.equipment_dialog_save), color = PandaPurple, fontWeight = FontWeight.Bold) }
                }
            }
        }
    }
}

@Composable
private fun KgField(label: String, value: Float, onValueChange: (Float) -> Unit, modifier: Modifier = Modifier) {
    OutlinedTextField(
        value = value.formatKg(),
        onValueChange = { it.toFloatOrNull()?.let(onValueChange) },
        label = { Text(label) },
        singleLine = true,
        keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(keyboardType = KeyboardType.Decimal),
        modifier = modifier,
    )
}

/** Matériel modulable à crans (kettlebell ajustable, poulie/câble) — bible §4.3. */
@Composable
fun PlageConfigDialog(
    title: String,
    config: PlageConfig,
    onDismiss: () -> Unit,
    onSave: (PlageConfig) -> Unit,
) {
    var min by remember { mutableStateOf(config.minKg) }
    var max by remember { mutableStateOf(config.maxKg) }
    var pas by remember { mutableStateOf(config.pasKg) }

    ConfigDialogShell(
        title = title,
        onDismiss = onDismiss,
        onSave = { onSave(PlageConfig(min, max, pas)) },
    ) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            KgField(stringResource(R.string.equipment_plage_min), min, { min = it }, Modifier.weight(1f))
            KgField(stringResource(R.string.equipment_plage_max), max, { max = it }, Modifier.weight(1f))
        }
        KgField(stringResource(R.string.equipment_plage_pas), pas, { pas = it })
    }
}

/** Lignes éditables denomination/quantité, partagées entre la barre et les haltères chargeables. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun DisqueRowsEditor(
    disques: Map<Float, Int>,
    onChange: (Map<Float, Int>) -> Unit,
) {
    var customValue by remember { mutableStateOf("") }

    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(stringResource(R.string.equipment_disques_label), style = MaterialTheme.typography.labelSmall, color = PandaSubtext)

        disques.toSortedMap().forEach { (poids, quantite) ->
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
                Text(
                    stringResource(R.string.equipment_disque_row, poids.formatKg(), quantite),
                    style = MaterialTheme.typography.bodySmall,
                    modifier = Modifier.weight(1f),
                )
                IconButton(onClick = { onChange(disques + (poids to (quantite - 1).coerceAtLeast(0))) }, modifier = Modifier.size(28.dp)) {
                    Icon(Icons.Default.Remove, null, modifier = Modifier.size(14.dp), tint = PandaPurple)
                }
                IconButton(onClick = { onChange(disques + (poids to quantite + 1)) }, modifier = Modifier.size(28.dp)) {
                    Icon(Icons.Default.Add, null, modifier = Modifier.size(14.dp), tint = PandaPurple)
                }
                IconButton(onClick = { onChange(disques - poids) }, modifier = Modifier.size(28.dp)) {
                    Icon(Icons.Default.Close, stringResource(R.string.equipment_disque_remove_cd), modifier = Modifier.size(14.dp), tint = PandaSubtext)
                }
            }
        }

        FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            DENOMINATIONS_STANDARD.forEach { poids ->
                AssistChip(
                    onClick = { onChange(disques + (poids to (disques[poids] ?: 0) + 2)) },
                    label = { Text("${poids.formatKg()} kg", style = MaterialTheme.typography.labelSmall) },
                )
            }
        }

        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedTextField(
                value = customValue,
                onValueChange = { customValue = it },
                label = { Text(stringResource(R.string.equipment_disque_custom_placeholder)) },
                singleLine = true,
                keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(keyboardType = KeyboardType.Decimal),
                modifier = Modifier.weight(1f),
            )
            IconButton(onClick = {
                customValue.toFloatOrNull()?.let { poids ->
                    onChange(disques + (poids to (disques[poids] ?: 0) + 2))
                    customValue = ""
                }
            }) {
                Icon(Icons.Default.Add, stringResource(R.string.equipment_disque_add_cd), tint = PandaPurple)
            }
        }
    }
}

/** Barre + disques disponibles — bible §4.3. */
@Composable
fun DisquesConfigDialog(
    config: DisquesConfig,
    onDismiss: () -> Unit,
    onSave: (DisquesConfig) -> Unit,
) {
    var barreKg by remember { mutableStateOf(config.barreKg) }
    var disques by remember { mutableStateOf(config.disques) }

    ConfigDialogShell(
        title = stringResource(R.string.equipment_barre_title),
        onDismiss = onDismiss,
        onSave = { onSave(DisquesConfig(barreKg, disques)) },
    ) {
        KgField(stringResource(R.string.equipment_barre_poids), barreKg, { barreKg = it })
        DisqueRowsEditor(disques, onChange = { disques = it })
    }
}

/** Haltères : poids fixes possédés et/ou haltères chargeables — bible §4.3. */
@Composable
fun HalteresConfigDialog(
    config: HalteresConfig,
    onDismiss: () -> Unit,
    onSave: (HalteresConfig) -> Unit,
) {
    var poidsFixes by remember { mutableStateOf(config.poidsFixes) }
    var chargeableActif by remember { mutableStateOf(config.chargeable != null) }
    var poigneeKg by remember { mutableStateOf(config.chargeable?.barreKg ?: 1f) }
    var disques by remember { mutableStateOf(config.chargeable?.disques ?: emptyMap()) }
    var customValue by remember { mutableStateOf("") }

    ConfigDialogShell(
        title = stringResource(R.string.equipment_halteres_title),
        onDismiss = onDismiss,
        onSave = {
            onSave(
                HalteresConfig(
                    poidsFixes = poidsFixes,
                    chargeable = if (chargeableActif) DisquesConfig(poigneeKg, disques) else null,
                ),
            )
        },
    ) {
        Text(stringResource(R.string.equipment_halteres_fixes_label), style = MaterialTheme.typography.labelSmall, color = PandaSubtext)
        FlowRowFixesChips(poidsFixes, onRemove = { poidsFixes = poidsFixes - it })
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedTextField(
                value = customValue,
                onValueChange = { customValue = it },
                label = { Text(stringResource(R.string.equipment_halteres_fixes_add_placeholder)) },
                singleLine = true,
                keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(keyboardType = KeyboardType.Decimal),
                modifier = Modifier.weight(1f),
            )
            IconButton(onClick = {
                customValue.toFloatOrNull()?.let { poids ->
                    if (poids !in poidsFixes) poidsFixes = (poidsFixes + poids).sorted()
                    customValue = ""
                }
            }) {
                Icon(Icons.Default.Add, stringResource(R.string.equipment_disque_add_cd), tint = PandaPurple)
            }
        }

        Spacer(Modifier.height(4.dp))
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                stringResource(R.string.equipment_halteres_chargeable_label),
                style = MaterialTheme.typography.labelSmall,
                color = PandaSubtext,
                modifier = Modifier.weight(1f),
            )
            androidx.compose.material3.Switch(checked = chargeableActif, onCheckedChange = { chargeableActif = it })
        }
        if (chargeableActif) {
            KgField(stringResource(R.string.equipment_halteres_poignee_poids), poigneeKg, { poigneeKg = it })
            DisqueRowsEditor(disques, onChange = { disques = it })
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun FlowRowFixesChips(poidsFixes: List<Float>, onRemove: (Float) -> Unit) {
    FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
        poidsFixes.sorted().forEach { poids ->
            AssistChip(
                onClick = { onRemove(poids) },
                label = { Text("${poids.formatKg()} kg", style = MaterialTheme.typography.labelSmall) },
                trailingIcon = { Icon(Icons.Default.Close, null, modifier = Modifier.size(14.dp)) },
            )
        }
    }
}
