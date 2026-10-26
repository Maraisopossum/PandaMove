package com.pandafit.feature.strength.ui

import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.pandafit.core.database.catalog.chargeNonComposableHint
import com.pandafit.feature.strength.R

/** Sans suffixe d'unité — ex. "11" ou "20.5" (jamais "11.0", contrairement à Float.toString()). */
fun formatKgValue(kg: Float): String = if (kg == kg.toLong().toFloat()) kg.toInt().toString() else kg.toString()

fun formatKgLabel(kg: Float): String = "${formatKgValue(kg)} kg"

/** Avertissement non-bloquant quand [chargeKg] n'est pas réellement composable avec l'inventaire
 * matériel déclaré (bible §4.3) — jamais de correction automatique silencieuse, toujours un hint
 * + action explicite "Arrondir" en un tap. */
@Composable
fun ChargeComposabiliteHint(chargeKg: Float?, chargesAtteignables: List<Float>, onArrondir: (Float) -> Unit) {
    val nearest = chargeKg?.let { chargesAtteignables.chargeNonComposableHint(it) } ?: return
    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth().padding(top = 2.dp)) {
        Text(
            stringResource(R.string.charge_non_composable_hint, formatKgLabel(nearest)),
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.error,
            modifier = Modifier.weight(1f),
        )
        TextButton(onClick = { onArrondir(nearest) }) {
            Text(stringResource(R.string.charge_non_composable_arrondir))
        }
    }
}
