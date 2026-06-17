package com.pandafit.feature.strength.ui

import androidx.compose.foundation.background
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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.rememberModalBottomSheetState
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
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.text.style.TextAlign
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
        if (s <= 0) "—"
        else {
            val h = s / 3600; val m = (s % 3600) / 60; val sec = s % 60
            if (h > 0) "$h:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}"
            else "${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}"
        }
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

    // ── Export PNG : mesure explicite de la hauteur complète ─────────────────
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
                    // Forcer la mesure complète du contenu (hauteur non bornée)
                    composeView.measure(
                        View.MeasureSpec.makeMeasureSpec(width, View.MeasureSpec.EXACTLY),
                        View.MeasureSpec.makeMeasureSpec(0, View.MeasureSpec.UNSPECIFIED),
                    )
                    composeView.layout(0, 0, composeView.measuredWidth, composeView.measuredHeight)
                    composeView.post {
                        try {
                            val h = composeView.measuredHeight.coerceAtLeast(1)
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

    // ── Export HTML : génération pure string, toujours complet ───────────────
    fun shareAsHtml() {
        val activity = context as? Activity ?: return
        val html = generateHtmlReport(
            seance = seance,
            instance = instance,
            groups = groups,
            seriesMap = seriesMap,
            durationLabel = durationLabel,
            tonnageLabel = tonnageLabel,
            seriesCompleted = seriesCompleted,
            seriesTotal = seriesTotal,
        )
        val file = File(activity.cacheDir, "rapport_seance.html")
        file.writeText(html, Charsets.UTF_8)
        val uri = FileProvider.getUriForFile(activity, "${activity.packageName}.fileprovider", file)
        val intent = Intent(Intent.ACTION_SEND).apply {
            type = "text/html"
            putExtra(Intent.EXTRA_STREAM, uri)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        activity.startActivity(Intent.createChooser(intent, "Partager le rapport HTML"))
    }

    var showFinishDialog by remember { mutableStateOf(false) }
    var showExportSheet by remember { mutableStateOf(false) }

    if (showFinishDialog) {
        AlertDialog(
            onDismissRequest = { showFinishDialog = false },
            title = { Text("Terminer la séance ?", fontWeight = FontWeight.Bold) },
            text = { Text("Les résultats seront sauvegardés et la séance marquée comme terminée.") },
            confirmButton = {
                TextButton(onClick = { viewModel.finishInstance(); showFinishDialog = false; onFinish() }) {
                    Text("Terminer", color = PandaGreen, fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { showFinishDialog = false }) { Text("Annuler") }
            },
        )
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
                    IconButton(onClick = { showExportSheet = true }) {
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
                    Text("RPE", style = MaterialTheme.typography.labelSmall, color = PandaSubtext, modifier = Modifier.width(44.dp))
                }
                Spacer(Modifier.height(6.dp))
            }

            // ── Groupes d'exercices ────────────────────────────────────────────
            groups.forEach { group ->
                val isSuperset = group.bloc?.type == BlocType.SUPERSET || group.bloc?.type == BlocType.CIRCUIT
                val isEchauffement = group.bloc?.type == BlocType.ECHAUFFEMENT
                    || group.bloc?.type == BlocType.ACTIVATION
                    || group.bloc?.type == BlocType.RECUPERATION
                val groupAccentColor = when {
                    isEchauffement && group.bloc != null -> blocColor(group.bloc.type)
                    isSuperset -> PandaOrange
                    else -> Color.Transparent
                }
                val groupBgColor = when {
                    isEchauffement && group.bloc != null -> blocColor(group.bloc.type).copy(alpha = 0.08f)
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
                    onClick = { showFinishDialog = true },
                    modifier = Modifier.fillMaxWidth().height(52.dp),
                    shape = RoundedCornerShape(14.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = PandaGreen),
                ) {
                    Text("✓  Terminer la séance", style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.Bold, color = Color.White)
                }
            }
        }
    }

    // ── Bottom sheet options d'export ─────────────────────────────────────────
    if (showExportSheet) {
        ExportSheet(
            onDismiss = { showExportSheet = false },
            onShareImage = {
                showExportSheet = false
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
            },
            onShareHtml = {
                showExportSheet = false
                shareAsHtml()
            },
        )
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
        val serieLabel = if (serie.notes.isNotBlank()) "${(serie.numeroSerie + 1) / 2}${serie.notes}" else "${serie.numeroSerie}"
        val serieLongLabel = if (serie.notes.isNotBlank()) "Série ${(serie.numeroSerie + 1) / 2} ${serie.notes}" else "Série ${serie.numeroSerie}"
        Text(
            serieLabel,
            style = MaterialTheme.typography.bodySmall,
            fontWeight = FontWeight.Bold,
            color = if (strikethrough) PandaSubtext.copy(alpha = 0.4f) else Color(0xFFE53935),
            modifier = Modifier.width(20.dp),
        )
        Text(
            serieLongLabel,
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
            serie.rpe?.let { rpe ->
                val i = rpe.toInt(); val d = ((rpe - i) * 10).toInt()
                if (d == 0) "$i" else "$i.$d"
            } ?: "—",
            style = MaterialTheme.typography.bodySmall,
            color = if (serie.rpe != null) textColor else PandaSubtext.copy(alpha = 0.4f),
            textDecoration = if (strikethrough && serie.rpe != null) TextDecoration.LineThrough else TextDecoration.None,
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
            Text("RPE", style = MaterialTheme.typography.labelSmall, color = PandaSubtext, modifier = Modifier.width(38.dp))
        }
        Spacer(Modifier.height(6.dp))

        // Groupes d'exercices
        groups.forEach { group ->
            val isSuperset = group.bloc?.type == BlocType.SUPERSET || group.bloc?.type == BlocType.CIRCUIT
            val isEchauffement = group.bloc?.type == BlocType.ECHAUFFEMENT
                || group.bloc?.type == BlocType.ACTIVATION
                || group.bloc?.type == BlocType.RECUPERATION
            val groupAccentColor = when {
                isEchauffement && group.bloc != null -> blocColor(group.bloc.type)
                isSuperset -> PandaOrange
                else -> Color.Transparent
            }
            val groupBgColor = when {
                isEchauffement && group.bloc != null -> blocColor(group.bloc.type).copy(alpha = 0.08f)
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

        // Branding
        Spacer(Modifier.height(20.dp))
        HorizontalDivider(color = Color(0xFFE0E0E0))
        Spacer(Modifier.height(8.dp))
        Text(
            "🐼 PandaFit",
            style = MaterialTheme.typography.labelSmall,
            color = Color(0xFF9E9E9E),
            modifier = Modifier.fillMaxWidth(),
            textAlign = TextAlign.End,
        )
        Spacer(Modifier.height(8.dp))
    }
}

// ── Bottom sheet choix d'export ───────────────────────────────────────────────

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ExportSheet(
    onDismiss: () -> Unit,
    onShareImage: () -> Unit,
    onShareHtml: () -> Unit,
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = sheetState) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 24.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Spacer(Modifier.height(4.dp))
            Text("Exporter le rapport", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(4.dp))

            // Option image
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(MaterialTheme.colorScheme.surfaceVariant, RoundedCornerShape(12.dp))
                    .clickable(onClick = onShareImage)
                    .padding(16.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                Text("📷", style = MaterialTheme.typography.headlineSmall)
                Column {
                    Text("Image", style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.SemiBold)
                    Text("PNG partagé via WhatsApp, Instagram…", style = MaterialTheme.typography.bodySmall, color = PandaSubtext)
                }
            }

            // Option HTML
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(MaterialTheme.colorScheme.surfaceVariant, RoundedCornerShape(12.dp))
                    .clickable(onClick = onShareHtml)
                    .padding(16.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                Text("🌐", style = MaterialTheme.typography.headlineSmall)
                Column {
                    Text("Fichier HTML", style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.SemiBold)
                    Text("Archivage, mail, ouverture dans un navigateur", style = MaterialTheme.typography.bodySmall, color = PandaSubtext)
                }
            }

            Spacer(Modifier.height(16.dp))
        }
    }
}

// ── Génération HTML ───────────────────────────────────────────────────────────

private fun generateHtmlReport(
    seance: SeanceEntity?,
    instance: InstanceSeanceEntity?,
    groups: List<ExerciceGroup>,
    seriesMap: Map<Long, List<SerieRealiseeState>>,
    durationLabel: String,
    tonnageLabel: String,
    seriesCompleted: Int,
    seriesTotal: Int,
): String {
    val dateStr = instance?.date?.format(
        java.time.format.DateTimeFormatter.ofPattern("EEEE d MMMM yyyy", java.util.Locale.FRENCH)
    )?.replaceFirstChar { it.uppercase() } ?: ""

    val sb = StringBuilder()
    sb.append("""
<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Rapport PandaFit</title>
<style>
  body { font-family: -apple-system, Arial, sans-serif; margin: 0; padding: 16px; background: #f5f5f5; color: #1a1a1a; }
  .header { background: #e8f5e9; border-radius: 14px; padding: 14px; margin-bottom: 16px; }
  .header h1 { margin: 0 0 4px 0; font-size: 18px; }
  .header .date { color: #43a047; font-size: 13px; font-weight: 600; margin: 0 0 12px 0; }
  .kpis { display: flex; gap: 8px; }
  .kpi { flex: 1; background: white; border-radius: 10px; padding: 8px; text-align: center; }
  .kpi .emoji { font-size: 20px; display: block; }
  .kpi .value { font-size: 15px; font-weight: 800; display: block; }
  .kpi .label { font-size: 11px; color: #888; display: block; }
  .table-header { display: flex; background: #f0f0f0; border-radius: 8px; padding: 6px 8px; font-size: 11px; font-weight: 700; color: #888; margin-bottom: 6px; gap: 4px; }
  .bloc-header { font-size: 11px; font-weight: 800; padding: 6px 10px; border-radius: 8px; margin-bottom: 4px; }
  .exercise { background: white; border-radius: 10px; margin-bottom: 6px; overflow: hidden; }
  .exercise-name { font-size: 13px; font-weight: 600; padding: 6px 8px; border-bottom: 1px solid #eee; }
  .serie { display: flex; gap: 4px; padding: 5px 8px; font-size: 12px; align-items: center; }
  .serie:nth-child(even) { background: #fafafa; }
  .serie.skipped { opacity: 0.45; text-decoration: line-through; }
  .col-num { width: 20px; font-weight: 700; color: #e53935; flex-shrink: 0; }
  .col-label { flex: 1; color: #888; }
  .col-reps { width: 36px; font-weight: 600; flex-shrink: 0; }
  .col-kg { width: 40px; font-weight: 600; flex-shrink: 0; }
  .col-rpe { width: 38px; color: #888; flex-shrink: 0; }
  .notes { margin-top: 8px; }
  .notes-label { font-size: 11px; font-weight: 700; color: #888; margin-bottom: 4px; }
  .notes-text { font-size: 13px; }
  .footer { margin-top: 20px; border-top: 1px solid #e0e0e0; padding-top: 8px; text-align: right; font-size: 11px; color: #9e9e9e; }
</style>
</head>
<body>
""".trimIndent())

    // En-tête
    sb.append("""<div class="header">""")
    sb.append("""<h1>${escHtml(seance?.nom ?: "Séance de renforcement")}</h1>""")
    if (dateStr.isNotBlank()) sb.append("""<p class="date">$dateStr</p>""")
    sb.append("""<div class="kpis">""")
    sb.append("""<div class="kpi"><span class="emoji">⏱</span><span class="value">${escHtml(durationLabel)}</span><span class="label">Durée</span></div>""")
    sb.append("""<div class="kpi"><span class="emoji">💪</span><span class="value">${escHtml(tonnageLabel)}</span><span class="label">Tonnage</span></div>""")
    sb.append("""<div class="kpi"><span class="emoji">✅</span><span class="value">$seriesCompleted / $seriesTotal</span><span class="label">Séries</span></div>""")
    sb.append("""</div></div>""")

    // En-tête tableau
    sb.append("""<div class="table-header"><span class="col-num">#</span><span style="flex:1">EXERCICE</span><span class="col-reps">REPS</span><span class="col-kg">KG</span><span class="col-rpe">RPE</span></div>""")

    // Groupes
    groups.forEach { group ->
        val isSuperset = group.bloc?.type == BlocType.SUPERSET || group.bloc?.type == BlocType.CIRCUIT
        val isEchauffement = group.bloc?.type == BlocType.ECHAUFFEMENT
            || group.bloc?.type == BlocType.ACTIVATION
            || group.bloc?.type == BlocType.RECUPERATION

        if ((isSuperset || isEchauffement) && group.bloc != null) {
            val color = blocColorHex(group.bloc.type)
            val bgColor = blocColorHexLight(group.bloc.type)
            sb.append("""<div class="bloc-header" style="color:$color;background:$bgColor">${escHtml(group.bloc.nom.uppercase())}""")
            if (isSuperset) {
                sb.append(""" · Inter: ${formatRestReport(group.bloc.tempsReposInterSec)} · Fin round: ${formatRestReport(group.bloc.tempsReposFinRoundSec)}""")
            }
            sb.append("""</div>""")
        }

        group.exercices.forEach { ex ->
            val series = seriesMap[ex.exerciceSeance.id] ?: emptyList()
            sb.append("""<div class="exercise">""")
            sb.append("""<div class="exercise-name">${escHtml(ex.exercise.name)}</div>""")
            series.forEach { serie ->
                val cls = if (!serie.isCompleted) " skipped" else ""
                val rpeStr = serie.rpe?.let { r ->
                    val i = r.toInt(); val d = ((r - i) * 10).toInt()
                    if (d == 0) "$i" else "$i.$d"
                } ?: "—"
                val kgStr = escHtml(serie.chargeLabel ?: serie.chargeKg?.let { "$it kg" } ?: "PDC")
                val htmlSerieLabel = if (serie.notes.isNotBlank()) "${(serie.numeroSerie + 1) / 2}${serie.notes}" else "${serie.numeroSerie}"
                val htmlSerieLongLabel = if (serie.notes.isNotBlank()) "Série ${(serie.numeroSerie + 1) / 2} ${serie.notes}" else "Série ${serie.numeroSerie}"
                sb.append("""<div class="serie$cls">""")
                sb.append("""<span class="col-num">$htmlSerieLabel</span>""")
                sb.append("""<span class="col-label">$htmlSerieLongLabel</span>""")
                sb.append("""<span class="col-reps">${serie.repsRealisees ?: "—"}</span>""")
                sb.append("""<span class="col-kg">$kgStr</span>""")
                sb.append("""<span class="col-rpe">$rpeStr</span>""")
                sb.append("""</div>""")
            }
            sb.append("""</div>""")
        }
    }

    // Note de séance
    if (!instance?.notes.isNullOrBlank()) {
        sb.append("""<div class="notes"><div class="notes-label">NOTE DE SÉANCE</div><div class="notes-text">${escHtml(instance!!.notes)}</div></div>""")
    }

    // Footer
    sb.append("""<div class="footer">🐼 PandaFit</div>""")
    sb.append("""</body></html>""")

    return sb.toString()
}

private fun escHtml(s: String): String = s
    .replace("&", "&amp;")
    .replace("<", "&lt;")
    .replace(">", "&gt;")
    .replace("\"", "&quot;")

private fun blocColorHex(type: BlocType): String = when (type) {
    BlocType.ECHAUFFEMENT  -> "#F59E0B"
    BlocType.ACTIVATION    -> "#3B82F6"
    BlocType.SUPERSET      -> "#F59E0B"
    BlocType.CIRCUIT       -> "#F59E0B"
    BlocType.RECUPERATION  -> "#10B981"
    else                   -> "#888888"
}

private fun blocColorHexLight(type: BlocType): String = when (type) {
    BlocType.ECHAUFFEMENT  -> "#FFF8E1"
    BlocType.ACTIVATION    -> "#EFF6FF"
    BlocType.SUPERSET      -> "#FFF3E0"
    BlocType.CIRCUIT       -> "#FFF3E0"
    BlocType.RECUPERATION  -> "#E8F5E9"
    else                   -> "#F5F5F5"
}
