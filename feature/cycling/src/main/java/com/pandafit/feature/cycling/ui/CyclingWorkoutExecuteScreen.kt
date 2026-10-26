package com.pandafit.feature.cycling.ui

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.graphics.DashPathEffect
import android.graphics.drawable.BitmapDrawable
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.pandafit.core.common.GpsSessionDefaults
import com.pandafit.core.database.catalog.LiveTrackState
import com.pandafit.designsystem.components.CircleActionButton
import com.pandafit.designsystem.components.CountdownCircle
import com.pandafit.designsystem.components.HoldToConfirmCircleButton
import com.pandafit.designsystem.components.PandaLoadingIndicator
import com.pandafit.designsystem.theme.PandaBlue
import com.pandafit.designsystem.theme.PandaSubtext
import com.pandafit.feature.cycling.R
import com.pandafit.feature.cycling.viewmodel.CyclingExecuteViewModel
import org.osmdroid.config.Configuration
import org.osmdroid.tileprovider.tilesource.TileSourceFactory
import org.osmdroid.util.GeoPoint
import org.osmdroid.views.MapView
import org.osmdroid.views.overlay.Marker
import org.osmdroid.views.overlay.Polyline
import java.time.format.DateTimeFormatter
import java.util.Locale

private val GrayBg    = Color(0xFFF4F4F7)
private val DarkColor = Color(0xFF1A1A2E)
private val RedColor  = Color(0xFFE53935)

private const val GPS_READY_ACCURACY_M = 20f

private enum class GpsPhase { IDLE, CALIBRATING, RIDING, PAUSED }

private fun LiveTrackState.gpsPhase(): GpsPhase = when {
    isTracking && isPaused -> GpsPhase.PAUSED
    isTracking             -> GpsPhase.RIDING
    calibrationAccuracyM != null -> GpsPhase.CALIBRATING
    else                    -> GpsPhase.IDLE
}

/** Découpe le tracé en segments contigus pleins / pointillés (signal GPS faible). */
private fun trackSegments(
    points: List<Pair<Double, Double>>,
    weakSignalAt: List<Boolean>,
): List<Pair<Boolean, List<Pair<Double, Double>>>> {
    if (points.size < 2) return emptyList()
    val segments = mutableListOf<Pair<Boolean, List<Pair<Double, Double>>>>()
    var currentWeak = false
    var currentSeg = mutableListOf(points[0])
    for (i in 1 until points.size) {
        val weak = weakSignalAt.getOrElse(i) { false }
        if (weak != currentWeak) {
            segments.add(currentWeak to currentSeg)
            currentSeg = mutableListOf(points[i - 1])
        }
        currentSeg.add(points[i])
        currentWeak = weak
    }
    segments.add(currentWeak to currentSeg)
    return segments
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CyclingWorkoutExecuteScreen(
    workoutId: Long,
    onNavigateBack: () -> Unit,
    onNavigateToReport: (Long) -> Unit = { onNavigateBack() },
    viewModel: CyclingExecuteViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val liveTrackState by viewModel.liveTrackState.collectAsStateWithLifecycle()
    var showExitDialog by remember { mutableStateOf(false) }
    val ctx = LocalContext.current
    var locationPermissionGranted by remember {
        mutableStateOf(
            ContextCompat.checkSelfPermission(ctx, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
        )
    }
    val permissionLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        locationPermissionGranted = granted
    }

    LaunchedEffect(uiState.isCompleted) {
        if (uiState.isCompleted) onNavigateToReport(uiState.workoutId ?: workoutId)
    }

    LaunchedEffect(locationPermissionGranted) {
        if (locationPermissionGranted) viewModel.startCalibration()
    }

    BackHandler(enabled = !uiState.isCompleted) { showExitDialog = true }

    if (showExitDialog) {
        AlertDialog(
            onDismissRequest = { showExitDialog = false },
            title = { Text("Sortie en cours", fontWeight = FontWeight.Bold) },
            text = { Text("Le suivi GPS continue en arrière-plan si vous quittez sans l'annuler.") },
            confirmButton = {
                TextButton(onClick = { viewModel.cancelWorkout(); showExitDialog = false; onNavigateBack() }) {
                    Text("Annuler la séance", color = RedColor, fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { showExitDialog = false; onNavigateBack() }) {
                    Text("Continuer en arrière-plan")
                }
            },
        )
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(
                            uiState.workout?.name ?: stringResource(R.string.cycling_execute_title_fallback),
                            style = MaterialTheme.typography.titleSmall,
                            fontWeight = FontWeight.ExtraBold,
                        )
                        val dateStr = uiState.workout?.scheduledDate
                            ?.format(DateTimeFormatter.ofPattern("EEEE d MMMM", Locale.FRENCH))
                            ?.replaceFirstChar { it.uppercase() } ?: ""
                        if (dateStr.isNotBlank()) {
                            Text(dateStr, style = MaterialTheme.typography.labelSmall, color = PandaSubtext)
                        }
                    }
                },
                navigationIcon = {
                    IconButton(onClick = { if (uiState.isCompleted) onNavigateBack() else showExitDialog = true }) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, stringResource(R.string.cycling_execute_back_cd))
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.surface),
            )
        },
        containerColor = MaterialTheme.colorScheme.background,
    ) { innerPadding ->
        if (uiState.isLoading) { PandaLoadingIndicator(); return@Scaffold }

        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(innerPadding),
            contentPadding = PaddingValues(start = 16.dp, end = 16.dp, bottom = 32.dp),
        ) {
            // ── Carte GPS live ────────────────────────────────────────────────
            item {
                Spacer(Modifier.height(12.dp))
                GpsTrackBlock(
                    state = liveTrackState,
                    permissionGranted = locationPermissionGranted,
                    onRequestPermission = { permissionLauncher.launch(Manifest.permission.ACCESS_FINE_LOCATION) },
                )
                Spacer(Modifier.height(16.dp))
                if (locationPermissionGranted) {
                    GpsControlsRow(
                        state = liveTrackState,
                        startCountdownSeconds = uiState.startCountdownSeconds,
                        onStartRequested = viewModel::requestStartCountdown,
                        onCancelCountdown = viewModel::cancelStartCountdown,
                        onPause = viewModel::pauseGpsTracking,
                        onResume = viewModel::resumeGpsTracking,
                        onFinishConfirmed = viewModel::finishWorkout,
                    )
                    Spacer(Modifier.height(16.dp))
                }
            }

            // ── Résultats globaux ─────────────────────────────────────────────
            item {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(GrayBg, RoundedCornerShape(14.dp))
                        .padding(14.dp),
                ) {
                    Text(
                        stringResource(R.string.cycling_execute_section_results),
                        style = MaterialTheme.typography.labelSmall,
                        color = PandaSubtext,
                        fontWeight = FontWeight.Bold,
                    )
                    Spacer(Modifier.height(10.dp))

                    // Ligne 1 : Distance · Durée · Vitesse moy. (auto)
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        ResultInputCell(stringResource(R.string.cycling_execute_cell_distance), uiState.resultDistanceKm, KeyboardType.Decimal, Modifier.weight(1f)) {
                            viewModel.updateField("distanceKm", it)
                        }
                        ResultInputCell(stringResource(R.string.cycling_execute_cell_duration), uiState.resultDurationStr, KeyboardType.Text, Modifier.weight(1f)) {
                            viewModel.updateField("duration", it)
                        }
                        ReadOnlyCell(stringResource(R.string.cycling_execute_cell_speed_avg), uiState.resultSpeedAvgKmh, Modifier.weight(1f))
                    }
                    Spacer(Modifier.height(8.dp))

                    // Ligne 2 : Vitesse max · FC moy · FC max
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        ResultInputCell(stringResource(R.string.cycling_execute_cell_speed_max), uiState.resultSpeedMaxKmh, KeyboardType.Decimal, Modifier.weight(1f)) {
                            viewModel.updateField("speedMax", it)
                        }
                        ResultInputCell(stringResource(R.string.cycling_execute_cell_hr_avg), uiState.resultHrAvg, KeyboardType.Number, Modifier.weight(1f)) {
                            viewModel.updateField("hr", it)
                        }
                        ResultInputCell(stringResource(R.string.cycling_execute_cell_hr_max), uiState.resultHrMax, KeyboardType.Number, Modifier.weight(1f)) {
                            viewModel.updateField("hrMax", it)
                        }
                    }
                    Spacer(Modifier.height(8.dp))

                    // Ligne 3 : Cadence · RPE · Dénivelé+
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        ResultInputCell(stringResource(R.string.cycling_execute_cell_cadence), uiState.resultCadenceAvgRpm, KeyboardType.Number, Modifier.weight(1f)) {
                            viewModel.updateField("cadence", it)
                        }
                        ResultInputCell(stringResource(R.string.cycling_execute_cell_rpe), uiState.resultRpe, KeyboardType.Number, Modifier.weight(1f)) { v ->
                            if (v.isEmpty() || (v.toIntOrNull() ?: 0) <= 10) viewModel.updateField("rpe", v)
                        }
                        ResultInputCell(stringResource(R.string.cycling_execute_cell_elevation), uiState.resultElevationM, KeyboardType.Number, Modifier.weight(1f)) {
                            viewModel.updateField("elevation", it)
                        }
                    }
                    Spacer(Modifier.height(8.dp))

                    // Ligne 4 : Calories
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        ResultInputCell(stringResource(R.string.cycling_execute_cell_calories), uiState.resultCalories, KeyboardType.Number, Modifier.weight(1f)) {
                            viewModel.updateField("calories", it)
                        }
                        Spacer(Modifier.weight(2f))
                    }
                }
                Spacer(Modifier.height(16.dp))
            }

            // ── Note de séance ────────────────────────────────────────────────
            item {
                Text(
                    stringResource(R.string.cycling_execute_section_notes),
                    style = MaterialTheme.typography.labelSmall,
                    color = PandaSubtext,
                    fontWeight = FontWeight.Bold,
                )
                Spacer(Modifier.height(6.dp))
                OutlinedTextField(
                    value = uiState.resultNotes,
                    onValueChange = { viewModel.updateField("notes", it) },
                    modifier = Modifier.fillMaxWidth(),
                    minLines = 3,
                    placeholder = { Text(stringResource(R.string.cycling_execute_notes_placeholder)) },
                    shape = RoundedCornerShape(12.dp),
                )
                Spacer(Modifier.height(16.dp))
            }
        }
    }
}

// ── Bloc GPS live (carte + stats + bouton) ────────────────────────────────────

@Composable
private fun GpsTrackBlock(
    state: LiveTrackState,
    permissionGranted: Boolean,
    onRequestPermission: () -> Unit,
) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(250.dp)
            .clip(RoundedCornerShape(14.dp)),
    ) {
        if (!permissionGranted) {
            Box(
                modifier = Modifier.fillMaxSize().background(GrayBg),
                contentAlignment = Alignment.Center,
            ) {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center,
                ) {
                    Text("GPS non activé", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold, color = DarkColor)
                    Spacer(Modifier.height(8.dp))
                    Text(
                        "Autorisez la localisation pour le suivi du tracé",
                        style = MaterialTheme.typography.bodySmall,
                        color = PandaSubtext,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.padding(horizontal = 24.dp),
                    )
                    Spacer(Modifier.height(12.dp))
                    Button(onClick = onRequestPermission, colors = ButtonDefaults.buttonColors(containerColor = PandaBlue)) {
                        Text("Autoriser la localisation", color = Color.White)
                    }
                }
            }
        } else {
            val ctx = LocalContext.current
            val pandaBitmap = remember(ctx) { createPandaBitmap() }
            val mapView = remember(ctx) {
                MapView(ctx).apply {
                    Configuration.getInstance().load(ctx, ctx.getSharedPreferences("osmdroid", Context.MODE_PRIVATE))
                    setTileSource(TileSourceFactory.MAPNIK)
                    setMultiTouchControls(true)
                    controller.setZoom(16.0)
                }
            }

            DisposableEffect(mapView) {
                mapView.onResume()
                onDispose { mapView.onPause() }
            }

            AndroidView(
                factory = { mapView },
                update = { mv ->
                    mv.overlays.clear()
                    if (state.points.size >= 2) {
                        trackSegments(state.points, state.weakSignalAt).forEach { (isWeakSignal, segPoints) ->
                            val line = Polyline().apply {
                                setPoints(segPoints.map { (lat, lng) -> GeoPoint(lat, lng) })
                                outlinePaint.color = android.graphics.Color.parseColor("#0277BD")
                                outlinePaint.strokeWidth = 10f
                                if (isWeakSignal) {
                                    outlinePaint.pathEffect = DashPathEffect(floatArrayOf(20f, 16f), 0f)
                                }
                            }
                            mv.overlays.add(line)
                        }
                    }
                    val markerPos = state.currentPosition ?: state.points.lastOrNull()
                    if (markerPos != null) {
                        val marker = Marker(mv).apply {
                            position = GeoPoint(markerPos.first, markerPos.second)
                            icon = BitmapDrawable(ctx.resources, pandaBitmap)
                            setAnchor(Marker.ANCHOR_CENTER, Marker.ANCHOR_CENTER)
                            infoWindow = null
                        }
                        mv.overlays.add(marker)
                        mv.controller.animateTo(GeoPoint(markerPos.first, markerPos.second))
                    }
                    mv.invalidate()
                },
                modifier = Modifier.fillMaxSize(),
            )

            val phase = state.gpsPhase()

            if (phase == GpsPhase.PAUSED) {
                Box(
                    modifier = Modifier
                        .align(Alignment.Center)
                        .background(Color(0xAA000000), RoundedCornerShape(8.dp))
                        .padding(horizontal = 20.dp, vertical = 10.dp),
                ) {
                    Text("⏸ PAUSE", style = MaterialTheme.typography.titleMedium, color = Color.White, fontWeight = FontWeight.Bold)
                }
            }

            // Stats bar (bas de la carte)
            Column(
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .fillMaxWidth()
                    .background(Color(0xCC000000))
                    .padding(horizontal = 16.dp, vertical = 8.dp),
            ) {
                when (phase) {
                    GpsPhase.IDLE, GpsPhase.CALIBRATING -> {
                        val acc = state.calibrationAccuracyM
                        val accuracyText = when {
                            acc == null || acc >= Float.MAX_VALUE / 2 -> "Acquisition GPS..."
                            acc <= GPS_READY_ACCURACY_M               -> "GPS capté · Précision : %.0fm ✓".format(acc)
                            else                                       -> "Acquisition GPS... Précision : %.0fm".format(acc)
                        }
                        Text(
                            accuracyText,
                            style = MaterialTheme.typography.labelMedium,
                            color = Color.White,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.fillMaxWidth(),
                            textAlign = TextAlign.Center,
                        )
                    }
                    GpsPhase.RIDING, GpsPhase.PAUSED -> {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .alpha(if (phase == GpsPhase.PAUSED) 0.5f else 1f),
                            horizontalArrangement = Arrangement.SpaceEvenly,
                        ) {
                            GpsStat("Distance", "%.2f km".format(state.distanceM / 1000.0))
                            GpsStat("Durée", fmtGpsDuration(state.durationSec))
                            GpsStat("Vitesse", fmtGpsSpeed(state.speedMps))
                        }
                    }
                }
            }

        }
    }
}

/**
 * Gros boutons ronds sous la carte GPS : Démarrer seul (avec décompte au tap), puis Pause/Reprendre
 * + Fin de séance (hold-to-confirm) côte à côte une fois le suivi lancé.
 */
@Composable
private fun GpsControlsRow(
    state: LiveTrackState,
    startCountdownSeconds: Int?,
    onStartRequested: () -> Unit,
    onCancelCountdown: () -> Unit,
    onPause: () -> Unit,
    onResume: () -> Unit,
    onFinishConfirmed: () -> Unit,
) {
    Box(modifier = Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
        if (startCountdownSeconds != null) {
            CountdownCircle(
                secondsLeft = startCountdownSeconds,
                totalSeconds = GpsSessionDefaults.START_COUNTDOWN_SECONDS,
                onClick = onCancelCountdown,
                color = PandaBlue,
            )
        } else when (state.gpsPhase()) {
            GpsPhase.IDLE, GpsPhase.CALIBRATING -> {
                val ready = state.calibrationAccuracyM?.let { it <= GPS_READY_ACCURACY_M } ?: false
                CircleActionButton(
                    label = "▶ Démarrer",
                    color = PandaBlue,
                    enabled = ready,
                    onClick = onStartRequested,
                )
            }
            GpsPhase.RIDING -> {
                Row(horizontalArrangement = Arrangement.spacedBy(24.dp)) {
                    CircleActionButton(label = "⏸ Pause", color = Color(0xFFFF9800), onClick = onPause)
                    HoldToConfirmCircleButton(
                        label = "Fin",
                        holdDurationMs = GpsSessionDefaults.FINISH_HOLD_DURATION_MS,
                        onConfirmed = onFinishConfirmed,
                    )
                }
            }
            GpsPhase.PAUSED -> {
                Row(horizontalArrangement = Arrangement.spacedBy(24.dp)) {
                    CircleActionButton(label = "▶ Reprendre", color = PandaBlue, onClick = onResume)
                    HoldToConfirmCircleButton(
                        label = "Fin",
                        holdDurationMs = GpsSessionDefaults.FINISH_HOLD_DURATION_MS,
                        onConfirmed = onFinishConfirmed,
                    )
                }
            }
        }
    }
}

private fun createPandaBitmap(): android.graphics.Bitmap {
    val emoji = "🐼"
    val paint = android.graphics.Paint(android.graphics.Paint.ANTI_ALIAS_FLAG).apply { textSize = 56f }
    val bounds = android.graphics.Rect()
    paint.getTextBounds(emoji, 0, emoji.length, bounds)
    val w = (bounds.width() + 8).coerceAtLeast(8)
    val h = (bounds.height() + 8).coerceAtLeast(8)
    val bmp = android.graphics.Bitmap.createBitmap(w, h, android.graphics.Bitmap.Config.ARGB_8888)
    android.graphics.Canvas(bmp).drawText(emoji, 4f, h.toFloat() - 4f, paint)
    return bmp
}

@Composable
private fun GpsStat(label: String, value: String) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(label, style = MaterialTheme.typography.labelSmall, color = Color(0xFFBBBBBB))
        Text(value, style = MaterialTheme.typography.labelMedium, color = Color.White, fontWeight = FontWeight.Bold)
    }
}

private fun fmtGpsSpeed(speedMps: Float): String {
    if (speedMps <= 0f) return "-- km/h"
    return "%.1f km/h".format(speedMps * 3.6f)
}

private fun fmtGpsDuration(totalSec: Int): String {
    val h = totalSec / 3600
    val m = (totalSec % 3600) / 60
    val s = totalSec % 60
    return if (h > 0) "$h:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}"
    else "$m:${s.toString().padStart(2, '0')}"
}

// ── Cellule résultat éditable ─────────────────────────────────────────────────

@Composable
private fun ResultInputCell(
    label: String,
    value: String,
    keyboardType: KeyboardType,
    modifier: Modifier = Modifier,
    onValueChange: (String) -> Unit,
) {
    Column(
        modifier = modifier
            .background(Color.White, RoundedCornerShape(10.dp))
            .padding(horizontal = 10.dp, vertical = 8.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(label, style = MaterialTheme.typography.labelSmall, color = PandaSubtext, textAlign = TextAlign.Center)
        BasicTextField(
            value = value,
            onValueChange = onValueChange,
            textStyle = TextStyle(fontSize = 15.sp, fontWeight = FontWeight.Bold, color = DarkColor, textAlign = TextAlign.Center),
            keyboardOptions = KeyboardOptions(keyboardType = keyboardType),
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
            decorationBox = { inner ->
                Box(modifier = Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                    if (value.isEmpty()) {
                        Text(stringResource(R.string.common_empty_dash), style = TextStyle(fontSize = 15.sp, color = PandaSubtext, textAlign = TextAlign.Center))
                    }
                    inner()
                }
            },
        )
    }
}

// ── Cellule lecture seule (vitesse moy. auto-calculée) ───────────────────────

@Composable
private fun ReadOnlyCell(
    label: String,
    value: String,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier
            .background(Color(0xFFEAEAEA), RoundedCornerShape(10.dp))
            .padding(horizontal = 10.dp, vertical = 8.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(label, style = MaterialTheme.typography.labelSmall, color = PandaSubtext, textAlign = TextAlign.Center)
        Text(
            text = if (value.isEmpty()) stringResource(R.string.cycling_execute_cell_auto) else value,
            style = TextStyle(
                fontSize = 15.sp,
                fontWeight = FontWeight.Bold,
                color = if (value.isEmpty()) PandaSubtext else DarkColor,
                textAlign = TextAlign.Center,
            ),
            modifier = Modifier.fillMaxWidth(),
            textAlign = TextAlign.Center,
        )
    }
}
