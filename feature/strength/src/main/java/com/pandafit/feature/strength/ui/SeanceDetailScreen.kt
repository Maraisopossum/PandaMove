package com.pandafit.feature.strength.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
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
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.rememberTopAppBarState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.compose.runtime.LaunchedEffect
import com.pandafit.core.database.entities.BlocSeanceEntity
import com.pandafit.core.database.entities.BlocType
import com.pandafit.core.database.entities.InstanceSeanceEntity
import com.pandafit.core.database.entities.ObjectifProgressionEntity
import com.pandafit.core.database.entities.RepsType
import com.pandafit.core.database.relations.ExerciceSeanceWithExercise
import com.pandafit.designsystem.components.PandaLoadingIndicator
import com.pandafit.designsystem.components.PandaTopBar
import com.pandafit.designsystem.theme.PandaOrange
import com.pandafit.designsystem.theme.PandaPurple
import com.pandafit.designsystem.theme.PandaPurpleDark
import com.pandafit.designsystem.theme.PandaSubtext
import com.pandafit.feature.strength.R
import com.pandafit.feature.strength.model.formatRepsDisplay
import com.pandafit.feature.strength.viewmodel.SeanceDetailViewModel
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SeanceDetailScreen(
    seanceId: Long,
    onNavigateBack: () -> Unit,
    onNavigateToEdit: (Long) -> Unit,
    onNavigateToInstance: (Long) -> Unit,
    onNavigateToInstanceReport: (Long) -> Unit = {},
    viewModel: SeanceDetailViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val scrollBehavior = TopAppBarDefaults.exitUntilCollapsedScrollBehavior(rememberTopAppBarState())

    LaunchedEffect(Unit) {
        viewModel.navigateToInstance.collect { onNavigateToInstance(it) }
    }

    Scaffold(
        modifier = Modifier.nestedScroll(scrollBehavior.nestedScrollConnection),
        topBar = {
            PandaTopBar(
                title = uiState.seance?.nom ?: stringResource(R.string.seance_detail_title_fallback),
                onNavigateBack = onNavigateBack,
                scrollBehavior = scrollBehavior,
                containerColor = PandaPurple,
                contentColor = Color.White,
                actions = {
                    IconButton(onClick = { onNavigateToEdit(seanceId) }) {
                        Icon(Icons.Default.Edit, stringResource(R.string.common_edit_cd))
                    }
                },
            )
        },
        bottomBar = {
            Box(modifier = Modifier.fillMaxWidth().padding(16.dp)) {
                Button(
                    onClick = viewModel::startNow,
                    modifier = Modifier.fillMaxWidth(),
                    colors = androidx.compose.material3.ButtonDefaults.buttonColors(containerColor = PandaPurple),
                ) {
                    Text(stringResource(R.string.seance_detail_start_button), fontWeight = FontWeight.Bold)
                }
            }
        },
        containerColor = MaterialTheme.colorScheme.background,
    ) { innerPadding ->
        if (uiState.isLoading) { PandaLoadingIndicator(); return@Scaffold }

        val totalSeries = uiState.exercices.sumOf { it.exerciceSeance.nombreSeriesPrevues }
        val totalProgression = uiState.exercices.count { it.exerciceSeance.progressionActivee }

        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(innerPadding),
            contentPadding = PaddingValues(bottom = 24.dp),
        ) {
            item {
                SeanceHeroCard(
                    nom = uiState.seance?.nom ?: "",
                    nombreExercices = uiState.exercices.size,
                    nombreProgression = totalProgression,
                    nombreSeries = totalSeries,
                    dureeEstimeeMin = uiState.seance?.dureeEstimeeMin ?: 0,
                )
            }

            // Interleave libres et blocs selon leurs positions réelles (même logique que buildOrderedExercises)
            data class OrderedEntry(val pos: Int, val libre: ExerciceSeanceWithExercise? = null, val bloc: BlocSeanceEntity? = null)
            val orderedEntries = buildList {
                uiState.exercicesSansBloc.forEach { ex -> add(OrderedEntry(ex.exerciceSeance.position, libre = ex)) }
                uiState.blocs.forEach { bloc -> add(OrderedEntry(bloc.position, bloc = bloc)) }
            }.sortedBy { it.pos }

            orderedEntries.forEach { entry ->
                if (entry.libre != null) {
                    item(key = "ex_${entry.libre.exerciceSeance.id}") {
                        ExerciceCard(ex = entry.libre, objectif = uiState.objectifsParExercice[entry.libre.exercise.id])
                    }
                } else if (entry.bloc != null) {
                    val exercicesBloc = uiState.exercicesForBloc(entry.bloc.id)
                    item(key = "bloc_${entry.bloc.id}") {
                        BlocGroupFrame(bloc = entry.bloc) {
                            exercicesBloc.forEach { ex ->
                                ExerciceCard(
                                    ex = ex,
                                    bloc = entry.bloc,
                                    objectif = uiState.objectifsParExercice[ex.exercise.id],
                                    dense = true,
                                )
                            }
                        }
                    }
                }
            }

            if (uiState.instances.isNotEmpty()) {
                item {
                    Spacer(Modifier.height(16.dp))
                    Text(
                        stringResource(R.string.seance_detail_instances_section_title),
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.padding(horizontal = 16.dp),
                    )
                    Spacer(Modifier.height(8.dp))
                }
                items(uiState.instances, key = { "inst_${it.id}" }) { instance ->
                    InstanceItem(
                        instance = instance,
                        onClick = {
                            if (instance.isCompleted) onNavigateToInstanceReport(instance.id)
                            else onNavigateToInstance(instance.id)
                        },
                        onDelete = { viewModel.deleteInstance(instance) },
                        modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp),
                    )
                }
            }

            item { Spacer(Modifier.height(8.dp)) }
        }
    }
}

// ===== Hero =====

@Composable
private fun SeanceHeroCard(
    nom: String,
    nombreExercices: Int,
    nombreProgression: Int,
    nombreSeries: Int,
    dureeEstimeeMin: Int,
) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 8.dp)
            .background(
                Brush.linearGradient(listOf(PandaPurple, PandaPurpleDark)),
                shape = RoundedCornerShape(18.dp),
            )
            .padding(16.dp),
    ) {
        Column {
            Text(nom, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold, color = Color.White)
            Text(
                stringResource(R.string.seance_detail_subtitle),
                style = MaterialTheme.typography.bodySmall,
                color = Color.White.copy(alpha = 0.85f),
            )
            Spacer(Modifier.height(12.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                HeroStat(nombreExercices.toString(), stringResource(R.string.seance_detail_stat_exercices), Modifier.weight(1f))
                HeroStat(nombreProgression.toString(), stringResource(R.string.seance_detail_stat_progression), Modifier.weight(1f))
                HeroStat(nombreSeries.toString(), stringResource(R.string.seance_detail_stat_series), Modifier.weight(1f))
                HeroStat("~$dureeEstimeeMin", stringResource(R.string.seance_detail_stat_duree), Modifier.weight(1f))
            }
        }
    }
}

@Composable
private fun HeroStat(valeur: String, label: String, modifier: Modifier = Modifier) {
    Column(
        modifier = modifier
            .background(Color.White.copy(alpha = 0.16f), RoundedCornerShape(11.dp))
            .padding(vertical = 9.dp, horizontal = 4.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(valeur, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.ExtraBold, color = Color.White)
        Text(label, style = MaterialTheme.typography.labelSmall, color = Color.White.copy(alpha = 0.85f), textAlign = androidx.compose.ui.text.style.TextAlign.Center)
    }
}

// ===== Cadre de bloc — titre + exercices du bloc regroupés dans un seul cadre coloré =====

@Composable
private fun BlocGroupFrame(bloc: BlocSeanceEntity, content: @Composable ColumnScope.() -> Unit) {
    val color = blocColor(bloc.type)
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 6.dp)
            .border(BorderStroke(1.5.dp, color.copy(alpha = 0.4f)), RoundedCornerShape(16.dp))
            .padding(8.dp),
    ) {
        BlocGroupHeader(bloc = bloc, color = color)
        Spacer(Modifier.height(6.dp))
        content()
    }
}

@Composable
private fun BlocGroupHeader(bloc: BlocSeanceEntity, color: Color) {
    val meta = when (bloc.type) {
        BlocType.SUPERSET, BlocType.CIRCUIT -> stringResource(
            R.string.seance_detail_bloc_rest_label,
            formatRest(bloc.tempsReposInterSec),
            formatRest(bloc.tempsReposFinRoundSec),
        )
        else -> null
    }
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(color.copy(alpha = 0.1f), RoundedCornerShape(10.dp))
            .padding(horizontal = 10.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(blocTypeIcon(bloc.type), null, tint = color, modifier = Modifier.size(15.dp))
        Spacer(Modifier.width(8.dp))
        Text(
            bloc.nom.uppercase(),
            style = MaterialTheme.typography.labelMedium,
            fontWeight = FontWeight.Bold,
            color = color,
            modifier = Modifier.weight(1f),
        )
        if (meta != null) {
            Text(meta, style = MaterialTheme.typography.labelSmall, color = color.copy(alpha = 0.85f), fontWeight = FontWeight.Medium)
        }
    }
}

// ===== Carte exercice unifiée =====

@Composable
private fun ExerciceCard(
    ex: ExerciceSeanceWithExercise,
    bloc: BlocSeanceEntity? = null,
    objectif: ObjectifProgressionEntity?,
    dense: Boolean = false,
) {
    val e = ex.exerciceSeance
    val estDuree = e.repsType == RepsType.DURATION
    val enProgression = e.progressionActivee
    val hideExerciceRepos = bloc != null && (bloc.type == BlocType.SUPERSET || bloc.type == BlocType.CIRCUIT)

    val repsLabel = when {
        estDuree -> "${objectif?.dureeCibleSec ?: e.repsCibles.toIntOrNull() ?: 0}s"
        objectif?.repsCible != null -> objectif.repsCible.toString()
        enProgression && e.repsMin != null && e.repsMax != null -> "${e.repsMin}–${e.repsMax}"
        else -> formatRepsDisplay(e.repsCibles, e.repsType)
    }
    val chargeLabel = when {
        e.isBodyweight -> stringResource(R.string.seance_create_progression_type_pdc_short)
        else -> objectif?.chargeCible?.let { "%.1f kg".format(it) } ?: e.chargeCible.ifBlank { null }
    }

    Card(
        modifier = Modifier.fillMaxWidth().padding(horizontal = if (dense) 0.dp else 16.dp, vertical = if (dense) 3.dp else 4.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        border = BorderStroke(
            1.dp,
            when {
                enProgression -> PandaPurple.copy(alpha = 0.3f)
                dense -> Color.Transparent
                else -> MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f)
            },
        ),
        elevation = CardDefaults.cardElevation(if (dense) 0.dp else 1.dp),
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                e.supersetGroupe?.let { sg ->
                    Text(sg, style = MaterialTheme.typography.labelSmall, color = PandaOrange, fontWeight = FontWeight.Bold, modifier = Modifier.padding(end = 4.dp))
                }
                Text(
                    ex.exercise.name,
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.weight(1f),
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
                if (enProgression) {
                    Spacer(Modifier.width(6.dp))
                    Text(
                        stringResource(R.string.seance_detail_progression_badge),
                        style = MaterialTheme.typography.labelSmall,
                        fontWeight = FontWeight.Bold,
                        color = PandaPurple,
                    )
                }
                if (e.isBilateral) {
                    Spacer(Modifier.width(6.dp))
                    Text(
                        stringResource(R.string.seance_detail_bilateral_badge),
                        style = MaterialTheme.typography.labelSmall,
                        fontWeight = FontWeight.Bold,
                        color = PandaOrange.copy(alpha = 0.9f),
                    )
                }
            }
            if (e.equipement.isNotBlank()) {
                Text(e.equipement, style = MaterialTheme.typography.labelSmall, color = PandaSubtext)
            }
            Spacer(Modifier.height(6.dp))
            Row(verticalAlignment = Alignment.Bottom) {
                Text("${e.nombreSeriesPrevues} × $repsLabel", style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.Bold)
                if (chargeLabel != null) {
                    Spacer(Modifier.width(8.dp))
                    Text("@ $chargeLabel", style = MaterialTheme.typography.bodyMedium, color = PandaSubtext, fontWeight = FontWeight.SemiBold)
                }
                if (!hideExerciceRepos && e.tempsReposSec > 0) {
                    Spacer(Modifier.weight(1f))
                    Text(
                        stringResource(R.string.seance_detail_rest_label, formatRest(e.tempsReposSec)),
                        style = MaterialTheme.typography.labelSmall,
                        color = PandaSubtext,
                    )
                }
            }
            if (e.avertissement.isNotBlank()) {
                Spacer(Modifier.height(4.dp))
                Text("⚠️ ${e.avertissement}", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.error)
            }
            if (enProgression) {
                Spacer(Modifier.height(8.dp))
                HorizontalDivider(color = PandaPurple.copy(alpha = 0.25f))
                Spacer(Modifier.height(6.dp))
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    e.systemeProgression?.let { systeme ->
                        ConfigPill(systeme.name.lowercase().replaceFirstChar { it.uppercase() })
                    }
                    val incrementLabel = when {
                        e.isBodyweight -> stringResource(R.string.seance_detail_progression_increment_series)
                        estDuree -> "+${e.incrementDureeSec}s"
                        else -> e.incrementKg?.let { "+${if (it == it.toInt().toFloat()) it.toInt().toString() else it.toString()} kg" }
                    }
                    incrementLabel?.let { ConfigPill(it) }
                }
            }
        }
    }
}

@Composable
private fun ConfigPill(label: String) {
    Text(
        label,
        style = MaterialTheme.typography.labelSmall,
        fontWeight = FontWeight.Bold,
        color = PandaPurple,
        modifier = Modifier
            .background(PandaPurple.copy(alpha = 0.1f), RoundedCornerShape(7.dp))
            .padding(horizontal = 8.dp, vertical = 2.dp),
    )
}

// ===== Instances =====

@Composable
private fun InstanceItem(instance: InstanceSeanceEntity, onClick: () -> Unit, onDelete: () -> Unit, modifier: Modifier = Modifier) {
    val formatter = DateTimeFormatter.ofPattern("EEEE d MMMM yyyy", Locale.FRENCH)
    Card(
        modifier = modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f)),
        elevation = CardDefaults.cardElevation(0.dp),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().clickable(onClick = onClick).padding(start = 12.dp, end = 4.dp, top = 10.dp, bottom = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                modifier = Modifier
                    .size(26.dp)
                    .background(if (instance.isCompleted) PandaPurple else PandaPurple.copy(alpha = 0.12f), CircleShape),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    if (instance.isCompleted) Icons.Default.CheckCircle else Icons.Default.PlayArrow,
                    null,
                    tint = if (instance.isCompleted) Color.White else PandaPurple,
                    modifier = Modifier.size(15.dp),
                )
            }
            Spacer(Modifier.width(12.dp))
            Text(
                instance.date.format(formatter).replaceFirstChar { it.uppercase() },
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.Medium,
                modifier = Modifier.weight(1f),
            )
            IconButton(onClick = onDelete, modifier = Modifier.size(32.dp)) {
                Icon(Icons.Default.Delete, stringResource(R.string.seance_detail_delete_instance_cd), modifier = Modifier.size(16.dp), tint = PandaSubtext)
            }
            Icon(Icons.Default.ChevronRight, null, tint = PandaSubtext)
        }
    }
}

private fun formatRest(seconds: Int): String = if (seconds >= 60) "${seconds / 60} min" else "${seconds}s"
