package com.pandafit.feature.strength.ui

import androidx.compose.foundation.background
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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import android.app.Activity
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Canvas
import android.view.View
import android.view.ViewGroup
import android.view.ViewTreeObserver
import android.widget.FrameLayout
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.platform.ComposeView
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.ViewCompositionStrategy
import androidx.core.content.FileProvider
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import java.io.File
import com.pandafit.core.database.entities.BlocSeanceEntity
import com.pandafit.core.database.entities.BlocType
import com.pandafit.core.database.entities.InstanceSeanceEntity
import com.pandafit.core.database.entities.SeanceEntity
import com.pandafit.core.database.relations.ExerciceSeanceWithExercise
import com.pandafit.designsystem.components.PandaLoadingIndicator
import com.pandafit.designsystem.theme.KalyptusGreen
import com.pandafit.designsystem.theme.KalyptusGreenLight
import com.pandafit.designsystem.theme.PandaGreen
import com.pandafit.designsystem.theme.PandaOrange
import com.pandafit.designsystem.theme.PandaOrangeLight
import com.pandafit.designsystem.theme.PandaSubtext
import com.pandafit.feature.strength.model.SerieRealiseeState
import com.pandafit.feature.strength.viewmodel.InstanceExecuteViewModel
import java.time.format.DateTimeFormatter
import java.util.Locale

// ══════════════════════════════════════════════════════════════════════════════
// ÉCRAN RAPPORT DE FIN DE SÉANCE (7.1)
//
// Partagé le même ViewModel que InstanceExecuteScreen — données déjà chargées.
// Navigation : InstanceExecute → [bouton FINIR] → InstanceReport → [Terminer] → popBackStack
// ══════════════════════════════════════════════════════════════════════════════

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun InstanceReportScreen(
    onNavigateBack: () -> Unit,
    onFinish: () -> Unit,
    onNavigateToEdit: () -> Unit = {},
    viewModel: InstanceExecuteViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val sessionSeconds by viewModel.sessionSeconds.collectAsStateWithLifecycle()

    // Recharger les données quand on revient depuis l'écran de modification
    val lifecycleOwner = LocalLifecycleOwner.current
    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) viewModel.reload()
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

    if (uiState.isLoading) { PandaLoadingIndicator(); return }

    val seance = uiState.seance
    val instance = uiState.instance
    val exercices = uiState.exercices
    val blocs = uiState.blocs
    val seriesMap = uiState.seriesParExercice

    // ── KPIs globaux ──────────────────────────────────────────────────────────
    val totalTonnageKg = seriesMap.values.flatten()
        .filter { it.isCompleted && it.chargeKg != null && it.repsRealisees != null }
        .sumOf { it.chargeKg!!.toDouble() * it.repsRealisees!! }
    val seriesCompleted = seriesMap.values.flatten().count { it.isCompleted }
    val seriesTotal = seriesMap.values.flatten().size
    val durationLabel = run {
        val s = instance?.durationSeconds?.takeIf { it > 0 } ?: sessionSeconds
        val m = s / 60; val sec = s % 60
        if (m > 0) "${m}min${if (sec > 0) "${sec}s" else ""}" else if (s > 0) "${s}s" else "—"
    }
    val tonnageLabel = when {
        totalTonnageKg >= 1000.0 -> "${"%.1f".format(totalTonnageKg / 1000.0)} T"
        else                    -> "${"%.0f".format(totalTonnageKg)} kg"
    }

    // ── Structure groupée exercices (ordre de buildOrderedExercises = positions réelles) ──
    val groups = buildList<ExerciceGroup> {
        var currentBlocId: Long? = -1L
        var currentItems = mutableListOf<ExerciceSeanceWithExercise>()
        var currentBloc: BlocSeanceEntity? = null
        exercices.forEach { ex ->
            val blocId = ex.exerciceSeance.blocId
            if (blocId != currentBlocId) {
                if (currentItems.isNotEmpty()) add(ExerciceGroup(currentBloc, currentItems.toList()))
                currentItems = mutableListOf()
                currentBlocId = blocId
                currentBloc = blocId?.let { bid -> blocs.find { it.id == bid } }
            }
            currentItems.add(ex)
        }
        if (currentItems.isNotEmpty()) add(ExerciceGroup(currentBloc, currentItems.toList()))
    }

    val context = LocalContext.current

    fun shareFullReport(printContent: @Composable () -> Unit) {
        val activity = context as? Activity ?: return
        val decorView = activity.window.decorView as? FrameLayout ?: return
        val width = decorView.width.takeIf { it > 0 } ?: return

        val composeView = ComposeView(activity).apply {
            setViewCompositionStrategy(ViewCompositionStrategy.DisposeOnDetachedFromWindow)
            layoutParams = FrameLayout.LayoutParams(width, ViewGroup.LayoutParams.WRAP_CONTENT)
            visibility = View.INVISIBLE
            setContent { printContent() }
        }
        decorView.addView(composeView)

        composeView.viewTreeObserver.addOnGlobalLayoutListener(object : ViewTreeObserver.OnGlobalLayoutListener {
            override fun onGlobalLayout() {
                composeView.viewTreeObserver.removeOnGlobalLayoutListener(this)
                composeView.post {
                    composeView.post {
                        try {
                            val h = composeView.height.coerceAtLeast(1)
                            val bmp = Bitmap.createBitmap(width, h, Bitmap.Config.ARGB_8888)
                            composeView.draw(Canvas(bmp))
                            decorView.removeView(composeView)
                            val file = File(activity.cacheDir, "rapport_seance.png")
                            file.outputStream().use { bmp.compress(Bitmap.CompressFormat.PNG, 95, it) }
                            bmp.recycle()
                            val uri = FileProvider.getUriForFile(activity, "${activity.packageName}.fileprovider", file)
                            val intent = Intent(Intent.ACTION_SEND).apply {
                                type = "image/png"
                                putExtra(Intent.EXTRA_STREAM, uri)
                                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                            }
                            activity.startActivity(Intent.createChooser(intent, "Partager le rapport"))
                        } catch (_: Exception) { decorView.removeView(composeView) }
                    }
                }
            }
        })
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Rapport de séance", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold) },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, "Retour")
                    }
                },
                actions = {
                    IconButton(onClick = onNavigateToEdit) {
                        Icon(Icons.Default.Edit, "Modifier", tint = KalyptusGreen)
                    }
                    IconButton(onClick = {
                        shareFullReport {
                            ReportPrintContent(
                                seance = seance,
                                instance = instance,
                                groups = groups,
                                seriesMap = seriesMap,
                                durationLabel = durationLabel,
                                tonnageLabel = tonnageLabel,
                                seriesCompleted = seriesCompleted,
                                seriesTotal = seriesTotal,
                            )
                        }
                    }) {
                        Icon(Icons.Default.Share, "Exporter", tint = KalyptusGreen)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.surface),
            )
        },
        containerColor = MaterialTheme.colorScheme.background,
    ) { innerPadding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(innerPadding),
            contentPadding = PaddingValues(start = 16.dp, end = 16.dp, bottom = 24.dp),
        ) {
            // ── En-tête résumé ─────────────────────────────────────────────────
            item {
                Spacer(Modifier.height(12.dp))
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(KalyptusGreenLight, RoundedCornerShape(14.dp))
                        .padding(14.dp),
                ) {
                    Column {
                        Text(
                            seance?.nom ?: "Séance de renforcement",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.ExtraBold,
                        )
                        if (!seance?.notes.isNullOrBlank()) {
                            Text(
                                "${seance!!.notes} · ${instance?.date?.format(DateTimeFormatter.ofPattern("EEEE d MMMM yyyy", Locale.FRENCH))?.replaceFirstChar { it.uppercase() } ?: ""}",
                                style = MaterialTheme.typography.bodySmall,
                                color = KalyptusGreen,
                                fontWeight = FontWeight.SemiBold,
                            )
                        } else if (instance != null) {
                            Text(
                                instance.date.format(DateTimeFormatter.ofPattern("EEEE d MMMM yyyy", Locale.FRENCH)).replaceFirstChar { it.uppercase() },
                                style = MaterialTheme.typography.bodySmall,
                                color = KalyptusGreen,
                            )
                        }
                        Spacer(Modifier.height(10.dp))
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                        ) {
                            listOf(
                                Triple("⏱", durationLabel, "Durée"),
                                Triple("💪", tonnageLabel, "Tonnage"),
                                Triple("✅", "$seriesCompleted / $seriesTotal", "Séries"),
                            ).forEach { (emoji, value, label) ->
                                Column(
                                    modifier = Modifier
                                        .weight(1f)
                                        .background(Color.White, RoundedCornerShape(10.dp))
                                        .padding(8.dp),
                                    horizontalAlignment = Alignment.CenterHorizontally,
                                ) {
                                    Text(emoji, style = MaterialTheme.typography.titleMedium)
                                    Text(value, style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.ExtraBold)
                                    Text(label, style = MaterialTheme.typography.labelSmall, color = PandaSubtext)
                                }
                            }
                        }
                    }
                }
                Spacer(Modifier.height(14.dp))
            }

            // ── En-tête tableau ────────────────────────────────────────────────
            item {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(MaterialTheme.colorScheme.surfaceVariant, RoundedCornerShape(8.dp))
                        .padding(horizontal = 8.dp, vertical = 6.dp),
                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text("#", style = MaterialTheme.typography.labelSmall, color = PandaSubtext, modifier = Modifier.width(20.dp))
                    Text("EXERCICE", style = MaterialTheme.typography.labelSmall, color = PandaSubtext, modifier = Modifier.weight(1f))
                    Text("REPS", style = MaterialTheme.typography.labelSmall, color = PandaSubtext, modifier = Modifier.width(36.dp))
                    Text("KG", style = MaterialTheme.typography.labelSmall, color = PandaSubtext, modifier = Modifier.width(40.dp))
                    Text("REPOS", style = MaterialTheme.typography.labelSmall, color = PandaSubtext, modifier = Modifier.width(44.dp))
                }
                Spacer(Modifier.height(6.dp))
            }

            // ── Groupes d'exercices ────────────────────────────────────────────
            groups.forEach { group ->
                val isSuperset = group.bloc?.type == BlocType.SUPERSET || group.bloc?.type == BlocType.CIRCUIT
                val isEchauffement = group.bloc?.type == BlocType.ECHAUFFEMENT
                val groupAccentColor = when {
                    isEchauffement -> Color(0xFFFF8F00)
                    isSuperset -> PandaOrange
                    else -> Color.Transparent
                }
                val groupBgColor = when {
                    isEchauffement -> Color(0xFFFFF3E0)
                    isSuperset -> PandaOrangeLight
                    else -> Color.Transparent
                }

                if ((isSuperset || isEchauffement) && group.bloc != null) {
                    item {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .background(groupBgColor, RoundedCornerShape(8.dp))
                                .padding(horizontal = 10.dp, vertical = 6.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(6.dp),
                        ) {
                            Box(Modifier.width(3.dp).height(14.dp).background(groupAccentColor, RoundedCornerShape(2.dp)))
                            Text(
                                buildString {
                                    append(group.bloc.nom.uppercase())
                                    if (isSuperset) {
                                        append(" · Inter: ${formatRestReport(group.bloc.tempsReposInterSec)}")
                                        append(" · Fin round: ${formatRestReport(group.bloc.tempsReposFinRoundSec)}")
                                    }
                                },
                                style = MaterialTheme.typography.labelSmall,
                                fontWeight = FontWeight.ExtraBold,
                                color = groupAccentColor,
                            )
                        }
                        Spacer(Modifier.height(4.dp))
                    }
                }

                group.exercices.forEach { ex ->
                    val exerciceId = ex.exerciceSeance.id
                    val series = seriesMap[exerciceId] ?: emptyList()

                    item {
                        val isGrouped = isSuperset || isEchauffement
                        val borderColor = if (isGrouped) groupAccentColor.copy(alpha = 0.3f) else MaterialTheme.colorScheme.outline.copy(alpha = 0.4f)
                        val bgColor = if (isGrouped) groupBgColor.copy(alpha = 0.4f) else MaterialTheme.colorScheme.surface
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .background(bgColor, RoundedCornerShape(10.dp)),
                        ) {
                            // Nom exercice
                            Text(
                                ex.exercise.name,
                                style = MaterialTheme.typography.labelLarge,
                                fontWeight = FontWeight.SemiBold,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 6.dp),
                            )
                            HorizontalDivider(color = borderColor)

                            // Lignes de séries
                            series.forEachIndexed { idx, serie ->
                                ReportSerieRow(serie = serie, isEvenRow = idx % 2 == 0)
                            }
                        }
                        Spacer(Modifier.height(6.dp))
                    }
                }

                if (isSuperset || isEchauffement) {
                    item { Spacer(Modifier.height(6.dp)) }
                }
            }

            // ── Note de séance ─────────────────────────────────────────────────
            if (!instance?.notes.isNullOrBlank()) {
                item {
                    Spacer(Modifier.height(8.dp))
                    Text("NOTE DE SÉANCE", style = MaterialTheme.typography.labelSmall, color = PandaSubtext, fontWeight = FontWeight.Bold)
                    Spacer(Modifier.height(4.dp))
                    Text(instance!!.notes, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurface)
                    Spacer(Modifier.height(16.dp))
                }
            }

            // ── Bouton Terminer ────────────────────────────────────────────────
            item {
                Spacer(Modifier.height(16.dp))
                Button(
                    onClick = { viewModel.finishInstance(); onFinish() },
                    modifier = Modifier.fillMaxWidth().height(52.dp),
                    shape = RoundedCornerShape(14.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = PandaGreen),
                ) {
                    Text("✓  Terminer la séance", style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.Bold, color = Color.White)
                }
            }
        }
    }
}

// ── Ligne d'une série ──────────────────────────────────────────────────────────

@Composable
private fun ReportSerieRow(serie: SerieRealiseeState, isEvenRow: Boolean) {
    val strikethrough = !serie.isCompleted
    val textColor = if (strikethrough) PandaSubtext.copy(alpha = 0.5f) else MaterialTheme.colorScheme.onSurface

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(if (isEvenRow) Color.Transparent else MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f))
            .padding(horizontal = 8.dp, vertical = 5.dp),
        horizontalArrangement = Arrangement.spacedBy(4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            "${serie.numeroSerie}",
            style = MaterialTheme.typography.bodySmall,
            fontWeight = FontWeight.Bold,
            color = if (strikethrough) PandaSubtext.copy(alpha = 0.4f) else Color(0xFFE53935),
            modifier = Modifier.width(20.dp),
        )
        Text(
            "Série ${serie.numeroSerie}",
            style = MaterialTheme.typography.bodySmall,
            color = PandaSubtext.copy(alpha = if (strikethrough) 0.4f else 0.7f),
            textDecoration = if (strikethrough) TextDecoration.LineThrough else TextDecoration.None,
            modifier = Modifier.weight(1f),
        )
        Text(
            serie.repsRealisees?.toString() ?: "—",
            style = MaterialTheme.typography.bodySmall,
            fontWeight = FontWeight.SemiBold,
            color = textColor,
            textDecoration = if (strikethrough) TextDecoration.LineThrough else TextDecoration.None,
            modifier = Modifier.width(36.dp),
        )
        Text(
            serie.chargeLabel ?: serie.chargeKg?.let { "$it kg" } ?: "PDC",
            style = MaterialTheme.typography.bodySmall,
            fontWeight = FontWeight.SemiBold,
            color = textColor,
            textDecoration = if (strikethrough) TextDecoration.LineThrough else TextDecoration.None,
            modifier = Modifier.width(40.dp),
        )
        Text(
            "—",   // repos affiché dans la vue d'exécution, pas dans le rapport
            style = MaterialTheme.typography.bodySmall,
            color = PandaSubtext.copy(alpha = 0.4f),
            modifier = Modifier.width(44.dp),
        )
    }
}

private fun formatRestReport(seconds: Int): String = when {
    seconds <= 0  -> "—"
    seconds >= 60 -> "${seconds / 60}min${if (seconds % 60 > 0) "${seconds % 60}s" else ""}"
    else          -> "${seconds}s"
}

// ── Contenu du rapport pour l'export image (Column, pas LazyColumn) ────────────

data class ExerciceGroup(val bloc: BlocSeanceEntity?, val exercices: List<ExerciceSeanceWithExercise>)

@Composable
internal fun ReportPrintContent(
    seance: SeanceEntity?,
    instance: InstanceSeanceEntity?,
    groups: List<ExerciceGroup>,
    seriesMap: Map<Long, List<SerieRealiseeState>>,
    durationLabel: String,
    tonnageLabel: String,
    seriesCompleted: Int,
    seriesTotal: Int,
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(Color.White)
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(0.dp),
    ) {
        // En-tête résumé
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .background(KalyptusGreenLight, RoundedCornerShape(14.dp))
                .padding(14.dp),
        ) {
            Column {
                Text(
                    seance?.nom ?: "Séance de renforcement",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.ExtraBold,
                )
                if (!seance?.notes.isNullOrBlank()) {
                    Text(
                        "${seance!!.notes} · ${instance?.date?.format(DateTimeFormatter.ofPattern("EEEE d MMMM yyyy", Locale.FRENCH))?.replaceFirstChar { it.uppercase() } ?: ""}",
                        style = MaterialTheme.typography.bodySmall,
                        color = KalyptusGreen,
                        fontWeight = FontWeight.SemiBold,
                    )
                } else if (instance != null) {
                    Text(
                        instance.date.format(DateTimeFormatter.ofPattern("EEEE d MMMM yyyy", Locale.FRENCH)).replaceFirstChar { it.uppercase() },
                        style = MaterialTheme.typography.bodySmall,
                        color = KalyptusGreen,
                    )
                }
                Spacer(Modifier.height(10.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    listOf(
                        Triple("⏱", durationLabel, "Durée"),
                        Triple("💪", tonnageLabel, "Tonnage"),
                        Triple("✅", "$seriesCompleted / $seriesTotal", "Séries"),
                    ).forEach { (emoji, value, label) ->
                        Column(
                            modifier = Modifier
                                .weight(1f)
                                .background(Color.White, RoundedCornerShape(10.dp))
                                .padding(8.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                        ) {
                            Text(emoji, style = MaterialTheme.typography.titleMedium)
                            Text(value, style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.ExtraBold)
                            Text(label, style = MaterialTheme.typography.labelSmall, color = PandaSubtext)
                        }
                    }
                }
            }
        }
        Spacer(Modifier.height(14.dp))

        // En-tête tableau
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(Color(0xFFF0F0F0), RoundedCornerShape(8.dp))
                .padding(horizontal = 8.dp, vertical = 6.dp),
            horizontalArrangement = Arrangement.spacedBy(4.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text("#", style = MaterialTheme.typography.labelSmall, color = PandaSubtext, modifier = Modifier.width(20.dp))
            Text("EXERCICE", style = MaterialTheme.typography.labelSmall, color = PandaSubtext, modifier = Modifier.weight(1f))
            Text("REPS", style = MaterialTheme.typography.labelSmall, color = PandaSubtext, modifier = Modifier.width(36.dp))
            Text("KG", style = MaterialTheme.typography.labelSmall, color = PandaSubtext, modifier = Modifier.width(40.dp))
            Text("REPOS", style = MaterialTheme.typography.labelSmall, color = PandaSubtext, modifier = Modifier.width(44.dp))
        }
        Spacer(Modifier.height(6.dp))

        // Groupes d'exercices
        groups.forEach { group ->
            val isSuperset = group.bloc?.type == BlocType.SUPERSET || group.bloc?.type == BlocType.CIRCUIT
            val isEchauffement = group.bloc?.type == BlocType.ECHAUFFEMENT
            val groupAccentColor = when {
                isEchauffement -> Color(0xFFFF8F00)
                isSuperset -> PandaOrange
                else -> Color.Transparent
            }
            val groupBgColor = when {
                isEchauffement -> Color(0xFFFFF3E0)
                isSuperset -> PandaOrangeLight
                else -> Color.Transparent
            }

            if ((isSuperset || isEchauffement) && group.bloc != null) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(groupBgColor, RoundedCornerShape(8.dp))
                        .padding(horizontal = 10.dp, vertical = 6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    Box(Modifier.width(3.dp).height(14.dp).background(groupAccentColor, RoundedCornerShape(2.dp)))
                    Text(
                        buildString {
                            append(group.bloc.nom.uppercase())
                            if (isSuperset) {
                                append(" · Inter: ${formatRestReport(group.bloc.tempsReposInterSec)}")
                                append(" · Fin round: ${formatRestReport(group.bloc.tempsReposFinRoundSec)}")
                            }
                        },
                        style = MaterialTheme.typography.labelSmall,
                        fontWeight = FontWeight.ExtraBold,
                        color = groupAccentColor,
                    )
                }
                Spacer(Modifier.height(4.dp))
            }

            group.exercices.forEach { ex ->
                val exerciceId = ex.exerciceSeance.id
                val series = seriesMap[exerciceId] ?: emptyList()
                val isGrouped = isSuperset || isEchauffement
                val borderColor = if (isGrouped) groupAccentColor.copy(alpha = 0.3f) else Color(0xFFDDDDDD)
                val bgColor = if (isGrouped) groupBgColor.copy(alpha = 0.4f) else Color.White

                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(bgColor, RoundedCornerShape(10.dp)),
                ) {
                    Text(
                        ex.exercise.name,
                        style = MaterialTheme.typography.labelLarge,
                        fontWeight = FontWeight.SemiBold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 6.dp),
                    )
                    HorizontalDivider(color = borderColor)
                    series.forEachIndexed { idx, serie ->
                        ReportSerieRow(serie = serie, isEvenRow = idx % 2 == 0)
                    }
                }
                Spacer(Modifier.height(6.dp))
            }

            if (isSuperset || isEchauffement) {
                Spacer(Modifier.height(6.dp))
            }
        }

        // Note de séance
        if (!instance?.notes.isNullOrBlank()) {
            Spacer(Modifier.height(8.dp))
            Text("NOTE DE SÉANCE", style = MaterialTheme.typography.labelSmall, color = PandaSubtext, fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(4.dp))
            Text(instance!!.notes, style = MaterialTheme.typography.bodySmall)
        }

        Spacer(Modifier.height(16.dp))
    }
}
