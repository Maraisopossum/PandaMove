package com.pandafit.feature.profile.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Remove
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material.icons.filled.Settings
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.pandafit.core.database.catalog.EquipmentCategory
import com.pandafit.core.database.catalog.chargesAtteignablesPour
import com.pandafit.designsystem.components.PandaTopBar
import com.pandafit.designsystem.theme.PandaGreen
import com.pandafit.designsystem.theme.PandaSubtext
import com.pandafit.feature.profile.R
import com.pandafit.feature.profile.viewmodel.EquipmentViewModel

private val CATEGORIES_AVEC_INVENTAIRE = setOf(
    EquipmentCategory.HALTERES,
    EquipmentCategory.BARRE,
    EquipmentCategory.KETTLEBELL,
    EquipmentCategory.CABLE,
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EquipmentScreen(
    onNavigateBack: () -> Unit,
    viewModel: EquipmentViewModel = hiltViewModel(),
) {
    val context = LocalContext.current
    val selected by viewModel.selected.collectAsStateWithLifecycle()
    val pasParCategorie by viewModel.pasParCategorie.collectAsStateWithLifecycle()
    val inventaire by viewModel.inventaire.collectAsStateWithLifecycle()
    var dialogOuvert by remember { mutableStateOf<EquipmentCategory?>(null) }

    LaunchedEffect(Unit) {
        viewModel.shareIntent.collect { intent -> context.startActivity(intent) }
    }

    Scaffold(
        topBar = {
            PandaTopBar(
                title = stringResource(R.string.equipment_screen_title),
                onNavigateBack = onNavigateBack,
                actions = {
                    IconButton(onClick = { viewModel.exportEquipment() }) {
                        Icon(Icons.Default.Share, stringResource(R.string.equipment_export_cd))
                    }
                },
            )
        },
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
                stringResource(R.string.equipment_description),
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
                    val pas = pasParCategorie[category]
                    val avecInventaire = category in CATEGORIES_AVEC_INVENTAIRE
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
                            if (isSelected && pas != null) {
                                PasStepperField(
                                    valeurKg = pas,
                                    onValueChange = { viewModel.updatePas(category, it) },
                                )
                            }
                            if (isSelected && avecInventaire) {
                                val nbCharges = inventaire.chargesAtteignablesPour(category)?.size ?: 0
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Text(
                                        if (nbCharges > 0) stringResource(R.string.equipment_charges_count, nbCharges)
                                        else stringResource(R.string.equipment_charges_none),
                                        style = MaterialTheme.typography.labelSmall,
                                        color = PandaSubtext,
                                    )
                                    IconButton(onClick = { dialogOuvert = category }, modifier = Modifier.size(24.dp)) {
                                        Icon(Icons.Default.Settings, stringResource(R.string.equipment_configure_cd), modifier = Modifier.size(14.dp), tint = PandaGreen)
                                    }
                                }
                            }
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
                ) { Text(stringResource(R.string.equipment_select_all)) }
                Button(
                    onClick = { viewModel.clearAll() },
                    modifier = Modifier.weight(1f),
                ) { Text(stringResource(R.string.equipment_deselect_all)) }
            }
        }
    }

    when (dialogOuvert) {
        EquipmentCategory.HALTERES -> HalteresConfigDialog(
            config = inventaire.halteres,
            onDismiss = { dialogOuvert = null },
            onSave = { viewModel.updateHalteres(it); dialogOuvert = null },
        )
        EquipmentCategory.BARRE -> DisquesConfigDialog(
            config = inventaire.barre ?: com.pandafit.core.database.catalog.DisquesConfig(barreKg = 20f),
            onDismiss = { dialogOuvert = null },
            onSave = { viewModel.updateBarre(it); dialogOuvert = null },
        )
        EquipmentCategory.KETTLEBELL -> PlageConfigDialog(
            title = stringResource(R.string.equipment_plage_title_kettlebell),
            config = inventaire.kettlebell ?: com.pandafit.core.database.catalog.PlageConfig(8f, 24f, 4f),
            onDismiss = { dialogOuvert = null },
            onSave = { viewModel.updateKettlebell(it); dialogOuvert = null },
        )
        EquipmentCategory.CABLE -> PlageConfigDialog(
            title = stringResource(R.string.equipment_plage_title_cable),
            config = inventaire.cable ?: com.pandafit.core.database.catalog.PlageConfig(5f, 100f, 2.5f),
            onDismiss = { dialogOuvert = null },
            onSave = { viewModel.updateCable(it); dialogOuvert = null },
        )
        else -> Unit
    }
}

/** Pas réalisable (kg) pour une catégorie d'équipement — bible §4.3. */
@Composable
private fun PasStepperField(
    valeurKg: Float,
    onValueChange: (Float) -> Unit,
    step: Float = 0.5f,
    min: Float = 0.5f,
) {
    Column {
        Text(
            stringResource(R.string.equipment_pas_label),
            style = MaterialTheme.typography.labelSmall,
            color = PandaSubtext,
        )
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier
                .background(MaterialTheme.colorScheme.surfaceVariant, RoundedCornerShape(10.dp)),
        ) {
            IconButton(
                onClick = { if (valeurKg - step >= min) onValueChange(valeurKg - step) },
                modifier = Modifier.size(28.dp),
            ) {
                Icon(Icons.Default.Remove, "-", modifier = Modifier.size(12.dp), tint = PandaGreen)
            }
            val display = if (valeurKg == valeurKg.toInt().toFloat()) "${valeurKg.toInt()} kg" else "$valeurKg kg"
            Text(
                display,
                style = MaterialTheme.typography.labelSmall,
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.Center,
                modifier = Modifier.weight(1f),
            )
            IconButton(
                onClick = { onValueChange(valeurKg + step) },
                modifier = Modifier.size(28.dp),
            ) {
                Icon(Icons.Default.Add, "+", modifier = Modifier.size(12.dp), tint = PandaGreen)
            }
        }
    }
}
