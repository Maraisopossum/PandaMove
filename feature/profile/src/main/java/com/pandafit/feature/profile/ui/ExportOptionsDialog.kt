package com.pandafit.feature.profile.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.pandafit.core.database.export.DataCategory
import com.pandafit.designsystem.theme.KalyptusGreen
import com.pandafit.designsystem.theme.PandaSubtext
import com.pandafit.feature.profile.R

/** Dialog de sélection des catégories de données à exporter — toutes cochées par défaut. */
@Composable
fun ExportOptionsDialog(
    selected: Set<DataCategory>,
    onToggle: (DataCategory) -> Unit,
    onToggleAll: () -> Unit,
    onConfirm: () -> Unit,
    onDismiss: () -> Unit,
) {
    val allSelected = selected.size == DataCategory.entries.size
    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false),
    ) {
        Surface(
            shape = RoundedCornerShape(28.dp),
            tonalElevation = 6.dp,
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 24.dp),
        ) {
            Column(modifier = Modifier.padding(24.dp)) {
                Text(
                    stringResource(R.string.export_options_title),
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold,
                )
                Spacer(Modifier.height(8.dp))
                TextButton(onClick = onToggleAll) {
                    Text(
                        if (allSelected) stringResource(R.string.data_category_deselect_all)
                        else stringResource(R.string.data_category_select_all)
                    )
                }
                LazyColumn {
                    items(DataCategory.entries) { category ->
                        CategoryCheckboxRow(
                            category = category,
                            checked  = category in selected,
                            onToggle = { onToggle(category) },
                        )
                    }
                }
                Spacer(Modifier.height(16.dp))
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Button(
                        onClick  = onConfirm,
                        enabled  = selected.isNotEmpty(),
                        modifier = Modifier.fillMaxWidth(),
                        colors   = ButtonDefaults.buttonColors(containerColor = KalyptusGreen),
                    ) { Text(stringResource(R.string.export_options_confirm)) }
                    OutlinedButton(onClick = onDismiss, modifier = Modifier.fillMaxWidth()) {
                        Text(stringResource(R.string.export_options_cancel))
                    }
                }
            }
        }
    }
}

@Composable
internal fun CategoryCheckboxRow(category: DataCategory, checked: Boolean, onToggle: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onToggle)
            .padding(vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Checkbox(
            checked = checked,
            onCheckedChange = { onToggle() },
            colors = CheckboxDefaults.colors(checkedColor = KalyptusGreen),
        )
        Text(
            category.displayName(),
            style = MaterialTheme.typography.bodyMedium,
            color = if (checked) MaterialTheme.colorScheme.onSurface else PandaSubtext,
        )
    }
}

@Composable
internal fun DataCategory.displayName(): String = when (this) {
    DataCategory.STRENGTH -> stringResource(R.string.data_category_strength)
    DataCategory.RUNNING -> stringResource(R.string.data_category_running)
    DataCategory.CYCLING -> stringResource(R.string.data_category_cycling)
    DataCategory.HIKING -> stringResource(R.string.data_category_hiking)
    DataCategory.BREATHING -> stringResource(R.string.data_category_breathing)
    DataCategory.CUSTOM_EXERCISES -> stringResource(R.string.data_category_custom_exercises)
    DataCategory.PROGRESSION_OBJECTIVES -> stringResource(R.string.data_category_progression_objectives)
    DataCategory.EQUIPMENT -> stringResource(R.string.data_category_equipment)
}
