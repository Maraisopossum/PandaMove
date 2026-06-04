package com.pandafit.feature.profile.ui

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.BarChart
import androidx.compose.material.icons.filled.Download
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Female
import androidx.compose.material.icons.filled.FitnessCenter
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Male
import androidx.compose.material.icons.filled.NotificationsActive
import androidx.compose.material.icons.filled.Share
import androidx.compose.material.icons.filled.SportsMartialArts
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.pandafit.designsystem.components.PandaCard
import com.pandafit.designsystem.components.PandaTopBar
import com.pandafit.designsystem.theme.KalyptusGreen
import com.pandafit.designsystem.theme.PandaGreen
import com.pandafit.designsystem.theme.PandaSubtext
import com.pandafit.feature.profile.viewmodel.ExportImportStatus
import com.pandafit.feature.profile.viewmodel.ProfileViewModel
import com.pandafit.feature.profile.viewmodel.UserGender
import kotlinx.coroutines.delay

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProfileScreen(
    onNavigateToEquipment: () -> Unit = {},
    onNavigateToExerciseCatalog: () -> Unit = {},
    onNavigateToStatsConfig: () -> Unit = {},
    onOpenDrawer: () -> Unit = {},
    viewModel: ProfileViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val context = LocalContext.current
    var showRenameDialog by remember { mutableStateOf(false) }

    // Lancement du partage depuis le ViewModel (séparation UI / logique)
    LaunchedEffect(Unit) {
        viewModel.shareIntent.collect { intent ->
            context.startActivity(intent)
        }
    }

    // Auto-clear SUCCESS_EXPORT after 3 seconds
    LaunchedEffect(uiState.exportImportStatus) {
        if (uiState.exportImportStatus == ExportImportStatus.SUCCESS_EXPORT) {
            delay(3000)
            viewModel.clearStatus()
        }
    }

    // File picker for import
    val importLauncher = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        uri ?: return@rememberLauncherForActivityResult
        val content = context.contentResolver.openInputStream(uri)?.bufferedReader()?.readText()
            ?: return@rememberLauncherForActivityResult
        viewModel.importData(content)
    }

    // Rename dialog
    if (showRenameDialog) {
        var inputName by remember(uiState.userName) { mutableStateOf(uiState.userName) }
        AlertDialog(
            onDismissRequest = { showRenameDialog = false },
            title = { Text("Modifier le nom") },
            text = {
                OutlinedTextField(
                    value = inputName,
                    onValueChange = { inputName = it },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text("Ton prénom ou pseudo") },
                )
            },
            confirmButton = {
                TextButton(onClick = {
                    viewModel.updateUserName(inputName.trim().ifBlank { "Sportif PandaMove" })
                    showRenameDialog = false
                }) { Text("Valider", fontWeight = FontWeight.SemiBold) }
            },
            dismissButton = { TextButton(onClick = { showRenameDialog = false }) { Text("Annuler") } },
        )
    }

    // Import result dialog
    val importResult = uiState.importResult
    if (uiState.exportImportStatus == ExportImportStatus.SUCCESS_IMPORT && importResult != null) {
        val result = importResult
        AlertDialog(
            onDismissRequest = { viewModel.clearStatus() },
            title = { Text("Import terminé", fontWeight = FontWeight.Bold) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(
                        "${result.imported} élément${if (result.imported > 1) "s" else ""} importé${if (result.imported > 1) "s" else ""}",
                        style = MaterialTheme.typography.bodyMedium,
                    )
                    Text(
                        "${result.skipped} ignoré${if (result.skipped > 1) "s" else ""} (déjà présent${if (result.skipped > 1) "s" else ""})",
                        style = MaterialTheme.typography.bodyMedium,
                        color = PandaSubtext,
                    )
                    if (result.errors > 0) {
                        Text(
                            "${result.errors} erreur${if (result.errors > 1) "s" else ""}",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.error,
                        )
                    }
                }
            },
            confirmButton = {
                TextButton(onClick = { viewModel.clearStatus() }) { Text("OK") }
            },
        )
    }

    Scaffold(
        topBar = { PandaTopBar(title = "Profil", onOpenDrawer = onOpenDrawer) },
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
                ProfileIdentityCard(
                    name = uiState.userName,
                    onEditClick = { showRenameDialog = true },
                )
            }

            item {
                Text("Profil", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                Spacer(Modifier.height(8.dp))
                PandaCard(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        Text(
                            "Genre",
                            style = MaterialTheme.typography.labelMedium,
                            color = androidx.compose.ui.graphics.Color(0xFF888888),
                        )
                        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                            val genders = listOf(
                                UserGender.MALE to ("Homme" to Icons.Default.Male),
                                UserGender.FEMALE to ("Femme" to Icons.Default.Female),
                            )
                            genders.forEach { (gender, labelIcon) ->
                                val (label, icon) = labelIcon
                                val selected = uiState.gender == gender
                                Row(
                                    modifier = Modifier
                                        .weight(1f)
                                        .border(
                                            width = if (selected) 2.dp else 1.dp,
                                            color = if (selected) KalyptusGreen else MaterialTheme.colorScheme.outline.copy(alpha = 0.4f),
                                            shape = androidx.compose.foundation.shape.RoundedCornerShape(10.dp),
                                        )
                                        .clickable { viewModel.setGender(gender) }
                                        .padding(horizontal = 12.dp, vertical = 10.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                                ) {
                                    Icon(
                                        icon,
                                        contentDescription = null,
                                        tint = if (selected) KalyptusGreen else MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f),
                                        modifier = Modifier.size(20.dp),
                                    )
                                    Text(
                                        label,
                                        style = MaterialTheme.typography.bodyMedium,
                                        fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Normal,
                                        color = if (selected) KalyptusGreen else MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f),
                                    )
                                }
                            }
                        }
                    }
                }
            }

            item {
                Text("Renforcement", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                Spacer(Modifier.height(8.dp))
                PandaCard(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(4.dp)) {
                        SettingsActionRow(
                            icon = Icons.Default.SportsMartialArts,
                            title = "Mon matériel",
                            subtitle = "Équipement disponible pour filtrer les exercices",
                            onClick = onNavigateToEquipment,
                        )
                        HorizontalDivider(modifier = Modifier.padding(horizontal = 16.dp))
                        SettingsActionRow(
                            icon = Icons.Default.FitnessCenter,
                            title = "Catalogue d'exercices",
                            subtitle = "${uiState.exerciseCount} exercice${if (uiState.exerciseCount > 1) "s" else ""} · filtrables par muscle et matériel",
                            onClick = onNavigateToExerciseCatalog,
                        )
                    }
                }
            }

            item {
                Text("Statistiques", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                Spacer(Modifier.height(8.dp))
                PandaCard(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(4.dp)) {
                        SettingsActionRow(
                            icon = Icons.Default.BarChart,
                            title = "Configuration des statistiques",
                            subtitle = "Distances, sommets et équivalents",
                            onClick = onNavigateToStatsConfig,
                        )
                    }
                }
            }

            item {
                Text("Sons", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                Spacer(Modifier.height(8.dp))
                PandaCard(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(4.dp)) {
                        SettingsToggleRow(
                            icon = Icons.Default.NotificationsActive,
                            title = "Sons en mode discret",
                            subtitle = "Les bips de timer sonnent même si le téléphone est en silencieux",
                            checked = uiState.soundOverrideSilent,
                            onCheckedChange = { viewModel.setSoundOverrideSilent(it) },
                        )
                    }
                }
            }

            item {
                Text("Données", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                Spacer(Modifier.height(8.dp))
                PandaCard(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(4.dp)) {
                        SettingsActionRow(
                            icon = Icons.Default.Share,
                            title = "Exporter mes données",
                            subtitle = when (uiState.exportImportStatus) {
                                ExportImportStatus.EXPORTING -> "Export en cours..."
                                ExportImportStatus.SUCCESS_EXPORT -> "Export terminé"
                                ExportImportStatus.ERROR -> uiState.errorMessage ?: "Erreur"
                                else -> "Export JSON complet de toutes vos données"
                            },
                            onClick = {
                                if (uiState.exportImportStatus != ExportImportStatus.EXPORTING) {
                                    viewModel.exportData()
                                }
                            },
                        )
                        HorizontalDivider(modifier = Modifier.padding(horizontal = 16.dp))
                        SettingsActionRow(
                            icon = Icons.Default.Download,
                            title = "Importer des données",
                            subtitle = when (uiState.exportImportStatus) {
                                ExportImportStatus.IMPORTING -> "Import en cours..."
                                ExportImportStatus.SUCCESS_IMPORT -> "Import terminé"
                                ExportImportStatus.ERROR -> uiState.errorMessage ?: "Erreur"
                                else -> "Depuis un fichier JSON PandaMove"
                            },
                            onClick = {
                                if (uiState.exportImportStatus != ExportImportStatus.IMPORTING) {
                                    importLauncher.launch("application/json")
                                }
                            },
                        )
                        HorizontalDivider(modifier = Modifier.padding(horizontal = 16.dp))
                        SettingsActionRow(
                            icon = Icons.Default.Info,
                            title = "A propos de PandaMove",
                            subtitle = "Version 1.0.0",
                            onClick = { },
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun ProfileIdentityCard(name: String, onEditClick: () -> Unit) {
    PandaCard(
        modifier = Modifier.fillMaxWidth(),
        containerColor = PandaGreen.copy(alpha = 0.06f),
        elevation = 0.dp,
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Box(
                modifier = Modifier
                    .size(72.dp)
                    .clip(CircleShape)
                    .background(PandaGreen.copy(alpha = 0.2f)),
                contentAlignment = Alignment.Center,
            ) {
                Text("🐼", style = MaterialTheme.typography.displaySmall)
            }
            Spacer(Modifier.height(12.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(name, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                Spacer(Modifier.padding(horizontal = 4.dp))
                Box(
                    modifier = Modifier
                        .size(28.dp)
                        .clip(CircleShape)
                        .clickable(onClick = onEditClick)
                        .padding(4.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(Icons.Default.Edit, "Modifier le nom", modifier = Modifier.size(16.dp), tint = PandaSubtext)
                }
            }
            Spacer(Modifier.height(4.dp))
            Text(
                "Toutes vos seances. Un seul endroit.",
                style = MaterialTheme.typography.bodySmall,
                color = PandaSubtext,
            )
        }
    }
}

@Composable
private fun SettingsActionRow(icon: ImageVector, title: String, subtitle: String, onClick: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(icon, null, tint = PandaGreen, modifier = Modifier.size(22.dp))
        Spacer(Modifier.width(16.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(title, style = MaterialTheme.typography.bodyMedium)
            Text(subtitle, style = MaterialTheme.typography.bodySmall, color = PandaSubtext)
        }
    }
}

@Composable
private fun SettingsToggleRow(
    icon: ImageVector,
    title: String,
    subtitle: String,
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onCheckedChange(!checked) }
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(icon, null, tint = PandaGreen, modifier = Modifier.size(22.dp))
        Spacer(Modifier.width(16.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(title, style = MaterialTheme.typography.bodyMedium)
            Text(subtitle, style = MaterialTheme.typography.bodySmall, color = PandaSubtext)
        }
        Spacer(Modifier.width(8.dp))
        Switch(
            checked = checked,
            onCheckedChange = onCheckedChange,
            colors = SwitchDefaults.colors(checkedThumbColor = PandaGreen, checkedTrackColor = PandaGreen.copy(alpha = 0.4f)),
        )
    }
}
