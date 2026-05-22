package com.pandafit.feature.strength.ui

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
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.rememberTopAppBarState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.pandafit.core.database.entities.BlocSeanceEntity
import com.pandafit.core.database.entities.BlocType
import com.pandafit.core.database.entities.InstanceSeanceEntity
import com.pandafit.core.database.relations.ExerciceSeanceWithExercise
import com.pandafit.designsystem.components.PandaCard
import com.pandafit.designsystem.components.PandaLoadingIndicator
import com.pandafit.designsystem.components.PandaTopBar
import com.pandafit.designsystem.theme.PandaPurple
import com.pandafit.designsystem.theme.PandaSubtext
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

    Scaffold(
        modifier = Modifier.nestedScroll(scrollBehavior.nestedScrollConnection),
        topBar = {
            PandaTopBar(
                title = uiState.seance?.nom ?: "Séance",
                onNavigateBack = onNavigateBack,
                scrollBehavior = scrollBehavior,
                actions = {
                    IconButton(onClick = { onNavigateToEdit(seanceId) }) {
                        Icon(Icons.Default.Edit, "Modifier")
                    }
                },
            )
        },
        containerColor = MaterialTheme.colorScheme.background,
    ) { innerPadding ->
        if (uiState.isLoading) { PandaLoadingIndicator(); return@Scaffold }

        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(innerPadding),
            contentPadding = PaddingValues(bottom = 80.dp),
        ) {
            item {
                SeanceHeaderCard(
                    nom = uiState.seance?.nom ?: "",
                    groupesMusculaires = uiState.seance?.groupesMusculaires ?: emptyList(),
                    dureeEstimeeMin = uiState.seance?.dureeEstimeeMin ?: 0,
                    notes = uiState.seance?.notes ?: "",
                )
            }

            item { TableHeader() }

            // Interleave libres et blocs selon leurs positions réelles (même logique que buildOrderedExercises)
            data class OrderedEntry(val pos: Int, val libre: com.pandafit.core.database.relations.ExerciceSeanceWithExercise? = null, val bloc: com.pandafit.core.database.entities.BlocSeanceEntity? = null)
            val orderedEntries = buildList {
                uiState.exercicesSansBloc.forEach { ex -> add(OrderedEntry(ex.exerciceSeance.position, libre = ex)) }
                uiState.blocs.forEach { bloc -> add(OrderedEntry(bloc.position, bloc = bloc)) }
            }.sortedBy { it.pos }

            orderedEntries.forEach { entry ->
                if (entry.libre != null) {
                    item(key = "ex_${entry.libre.exerciceSeance.id}") {
                        ExerciceTableReadRow(entry.libre)
                        HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.4f))
                    }
                } else if (entry.bloc != null) {
                    val exercicesBloc = uiState.exercicesForBloc(entry.bloc.id)
                    item(key = "bloc_${entry.bloc.id}") { BlocSectionHeader(bloc = entry.bloc) }
                    items(exercicesBloc, key = { "ex_${it.exerciceSeance.id}" }) { ex ->
                        val c = blocColor(entry.bloc.type)
                        Box(modifier = Modifier.fillMaxWidth().background(c.copy(alpha = 0.04f))) {
                            ExerciceTableReadRow(ex, bloc = entry.bloc)
                        }
                        HorizontalDivider(color = c.copy(alpha = 0.15f))
                    }
                }
            }

            if (uiState.instances.isNotEmpty()) {
                item {
                    Spacer(Modifier.height(16.dp))
                    Text("Instances programmées", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(horizontal = 16.dp))
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

            item { Spacer(Modifier.height(80.dp)) }
        }
    }
}

// ===== Sélecteur multi-dates =====

// ===== Composants de lecture =====

@Composable
private fun SeanceHeaderCard(nom: String, groupesMusculaires: List<String>, dureeEstimeeMin: Int, notes: String) {
    PandaCard(modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp)) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(nom, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            if (groupesMusculaires.isNotEmpty()) {
                Text(groupesMusculaires.joinToString(" · "), style = MaterialTheme.typography.bodySmall, color = PandaSubtext)
            }
            if (notes.isNotBlank()) {
                Spacer(Modifier.height(6.dp))
                Text(notes, style = MaterialTheme.typography.bodySmall)
            }
        }
    }
}

@Composable
private fun TableHeader() {
    Row(
        modifier = Modifier.fillMaxWidth().background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.6f)).padding(horizontal = 16.dp, vertical = 6.dp),
        horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Text("EXERCICE", style = MaterialTheme.typography.labelSmall, modifier = Modifier.weight(3f), color = PandaSubtext, fontWeight = FontWeight.Bold)
        Text("SÉR.", style = MaterialTheme.typography.labelSmall, modifier = Modifier.weight(0.6f), color = PandaSubtext, fontWeight = FontWeight.Bold)
        Text("REPS", style = MaterialTheme.typography.labelSmall, modifier = Modifier.weight(0.9f), color = PandaSubtext, fontWeight = FontWeight.Bold)
        Text("CHARGE", style = MaterialTheme.typography.labelSmall, modifier = Modifier.weight(1.1f), color = PandaSubtext, fontWeight = FontWeight.Bold)
        Text("REPOS", style = MaterialTheme.typography.labelSmall, modifier = Modifier.weight(0.8f), color = PandaSubtext, fontWeight = FontWeight.Bold)
    }
}

@Composable
private fun BlocSectionHeader(bloc: BlocSeanceEntity) {
    val color = blocColor(bloc.type)
    Row(
        modifier = Modifier.fillMaxWidth().background(color.copy(alpha = 0.06f)).padding(start = 4.dp, top = 8.dp, bottom = 4.dp, end = 16.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(modifier = Modifier.width(4.dp).height(36.dp).background(color))
        Spacer(Modifier.width(12.dp))
        Column {
            Text(text = bloc.nom.uppercase(), style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.Bold, color = color)
            if (bloc.description.isNotBlank()) Text(bloc.description, style = MaterialTheme.typography.labelSmall, color = PandaSubtext)
            if (bloc.type == BlocType.SUPERSET || bloc.type == BlocType.CIRCUIT) {
                Text("Inter: ${formatRest(bloc.tempsReposInterSec)} · Fin round: ${formatRest(bloc.tempsReposFinRoundSec)}", style = MaterialTheme.typography.labelSmall, color = color.copy(alpha = 0.8f))
            }
        }
    }
}

@Composable
private fun ExerciceTableReadRow(ex: ExerciceSeanceWithExercise, bloc: BlocSeanceEntity? = null) {
    val e = ex.exerciceSeance
    val hideExerciceRepos = bloc != null && (bloc.type == BlocType.SUPERSET || bloc.type == BlocType.CIRCUIT)
    Row(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
        verticalAlignment = Alignment.Top,
        horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Column(modifier = Modifier.weight(3f)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                e.supersetGroupe?.let { sg ->
                    Text(sg, style = MaterialTheme.typography.labelSmall, color = Color(0xFFE65100), fontWeight = FontWeight.Bold, modifier = Modifier.padding(end = 4.dp))
                }
                Text(ex.exercise.name, style = MaterialTheme.typography.bodySmall, fontWeight = FontWeight.Medium, maxLines = 2, overflow = TextOverflow.Ellipsis)
            }
            if (e.equipement.isNotBlank()) Text(e.equipement, style = MaterialTheme.typography.labelSmall, color = PandaSubtext)
            if (e.avertissement.isNotBlank()) Text("⚠️ ${e.avertissement}", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.error)
        }
        Text(e.nombreSeriesPrevues.toString(), style = MaterialTheme.typography.bodySmall, modifier = Modifier.weight(0.6f), fontWeight = FontWeight.SemiBold, color = PandaPurple)
        Text(formatRepsDisplay(e.repsCibles, e.repsType), style = MaterialTheme.typography.bodySmall, modifier = Modifier.weight(0.9f))
        Text(e.chargeCible.ifBlank { "—" }, style = MaterialTheme.typography.bodySmall, modifier = Modifier.weight(1.1f))
        Text(if (!hideExerciceRepos && e.tempsReposSec > 0) formatRest(e.tempsReposSec) else "—", style = MaterialTheme.typography.bodySmall, modifier = Modifier.weight(0.8f), color = PandaPurple)
    }
}

@Composable
private fun InstanceItem(instance: InstanceSeanceEntity, onClick: () -> Unit, onDelete: () -> Unit, modifier: Modifier = Modifier) {
    val formatter = DateTimeFormatter.ofPattern("EEEE d MMMM yyyy", Locale.FRENCH)
    Card(
        modifier = modifier.fillMaxWidth().border(
            width = if (instance.isCompleted) 0.dp else 1.dp,
            color = PandaPurple.copy(alpha = 0.3f),
            shape = MaterialTheme.shapes.medium,
        ),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(if (instance.isCompleted) 0.dp else 1.dp),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().clickable(onClick = onClick).padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(if (instance.isCompleted) Icons.Default.CheckCircle else Icons.Default.PlayArrow, null, tint = if (instance.isCompleted) PandaPurple.copy(alpha = 0.6f) else PandaPurple, modifier = Modifier.padding(end = 8.dp))
            Text(instance.date.format(formatter).replaceFirstChar { it.uppercase() }, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.weight(1f))
        }
    }
}

private fun formatRest(seconds: Int): String = if (seconds >= 60) "${seconds / 60} min" else "${seconds}s"
