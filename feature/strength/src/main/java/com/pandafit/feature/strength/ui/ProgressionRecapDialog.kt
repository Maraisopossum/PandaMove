package com.pandafit.feature.strength.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.pandafit.core.database.progression.StatutExercice
import com.pandafit.designsystem.theme.PandaGreen
import com.pandafit.designsystem.theme.PandaSubtext
import com.pandafit.feature.strength.R
import com.pandafit.feature.strength.model.ChoixValidation
import com.pandafit.feature.strength.model.PropositionAffichee

// Récap unique à la clôture (bible §2.6) — une ligne par exercice en succès, Oui/Non/Ajuster.
// Les anomalies (NON_LOGGE) s'affichent en lecture seule. Échecs/deload déjà appliqués silencieusement.
@Composable
fun ProgressionRecapDialog(
    propositions: List<PropositionAffichee>,
    onDismiss: () -> Unit,
    onValider: (decisions: Map<Long, ChoixValidation>, ajustements: Map<Long, Float?>) -> Unit,
) {
    val decisions = remember(propositions) {
        mutableStateMapOf<Long, ChoixValidation>().apply {
            propositions.forEach { put(it.exerciceSeanceId, ChoixValidation.OUI) }
        }
    }
    val ajustements = remember(propositions) { mutableStateMapOf<Long, Float?>() }

    val actionnables = propositions.filter { it.proposition.statut != StatutExercice.NON_LOGGE }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(R.string.progression_recap_title), fontWeight = FontWeight.Bold) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
                if (actionnables.isNotEmpty()) {
                    Text(
                        stringResource(R.string.progression_recap_subtitle, actionnables.size),
                        style = MaterialTheme.typography.bodySmall,
                        color = PandaSubtext,
                    )
                }
                propositions.forEach { row ->
                    ProgressionRecapRow(
                        row = row,
                        choix = decisions[row.exerciceSeanceId] ?: ChoixValidation.OUI,
                        onChoixChange = { decisions[row.exerciceSeanceId] = it },
                        ajustementChargeKg = ajustements[row.exerciceSeanceId],
                        onAjustementChange = { ajustements[row.exerciceSeanceId] = it },
                    )
                }
            }
        },
        confirmButton = {
            TextButton(onClick = { onValider(decisions.toMap(), ajustements.toMap()) }) {
                Text(stringResource(R.string.common_validate), color = PandaGreen, fontWeight = FontWeight.Bold)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text(stringResource(R.string.common_cancel)) }
        },
    )
}

@Composable
private fun ProgressionRecapRow(
    row: PropositionAffichee,
    choix: ChoixValidation,
    onChoixChange: (ChoixValidation) -> Unit,
    ajustementChargeKg: Float?,
    onAjustementChange: (Float?) -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.25f), RoundedCornerShape(10.dp))
            .padding(10.dp),
    ) {
        Text(row.exerciceName, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold)

        if (row.proposition.statut == StatutExercice.NON_LOGGE) {
            Text(
                stringResource(R.string.progression_recap_non_logge),
                style = MaterialTheme.typography.labelSmall,
                color = PandaSubtext,
            )
            return@Column
        }

        val propositionLabel = when {
            row.proposition.nouvelleDureeCible != null -> stringResource(R.string.progression_recap_propose_duree, row.proposition.nouvelleDureeCible!!)
            row.proposition.nouveauRepsCible != null && row.proposition.nouvelleChargeCible != null ->
                stringResource(R.string.progression_recap_propose_reps_charge, row.proposition.nouveauRepsCible!!, row.proposition.nouvelleChargeCible!!)
            row.proposition.nouvelleChargeCible != null -> stringResource(R.string.progression_recap_propose_charge, row.proposition.nouvelleChargeCible!!)
            row.proposition.nouveauRepsCible != null -> stringResource(R.string.progression_recap_propose_reps, row.proposition.nouveauRepsCible!!)
            else -> ""
        }
        if (propositionLabel.isNotBlank()) {
            Text(propositionLabel, style = MaterialTheme.typography.bodySmall, color = PandaSubtext)
        }
        if (row.proposition.statut == StatutExercice.SUCCES_SANS_MARGE) {
            Text(
                stringResource(R.string.progression_recap_sans_marge),
                style = MaterialTheme.typography.labelSmall,
                color = PandaSubtext,
            )
        }

        Spacer(Modifier.height(6.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            FilterChip(
                selected = choix == ChoixValidation.OUI,
                onClick = { onChoixChange(ChoixValidation.OUI) },
                label = { Text(stringResource(R.string.progression_recap_choice_oui)) },
            )
            FilterChip(
                selected = choix == ChoixValidation.NON,
                onClick = { onChoixChange(ChoixValidation.NON) },
                label = { Text(stringResource(R.string.progression_recap_choice_non)) },
            )
            FilterChip(
                selected = choix == ChoixValidation.AJUSTER,
                onClick = { onChoixChange(ChoixValidation.AJUSTER) },
                label = { Text(stringResource(R.string.progression_recap_choice_ajuster)) },
            )
        }

        if (choix == ChoixValidation.AJUSTER) {
            Spacer(Modifier.height(6.dp))
            OutlinedTextField(
                value = ajustementChargeKg?.toString() ?: "",
                onValueChange = { onAjustementChange(it.toFloatOrNull()) },
                label = { Text(stringResource(R.string.progression_recap_ajuster_label)) },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
        }
    }
}
