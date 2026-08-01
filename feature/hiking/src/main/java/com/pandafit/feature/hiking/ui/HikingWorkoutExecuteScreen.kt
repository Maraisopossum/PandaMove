package com.pandafit.feature.hiking.ui

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
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.pandafit.core.common.GpsSessionDefaults
import com.pandafit.designsystem.components.CircleActionButton
import com.pandafit.designsystem.components.CountdownCircle
import com.pandafit.designsystem.components.HoldToConfirmCircleButton
import com.pandafit.designsystem.components.PandaLoadingIndicator
import com.pandafit.designsystem.theme.PandaAmber
import com.pandafit.designsystem.theme.PandaSubtext
import com.pandafit.feature.hiking.R
import com.pandafit.feature.hiking.viewmodel.HikingExecuteViewModel
import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.graphics.DashPathEffect
import android.graphics.drawable.BitmapDrawable
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import com.pandafit.core.database.catalog.LiveTrackState
import java.time.format.DateTimeFormatter
import java.util.Locale
import org.osmdroid.config.Configuration
import org.osmdroid.tileprovider.tilesource.TileSourceFactory
import org.osmdroid.util.GeoPoint
import org.osmdroid.views.MapView
import org.osmdroid.views.overlay.Marker
import org.osmdroid.views.overlay.Polyline

/** Découpe le tracé en segments contigus pleins / pointillés (signal GPS faible) pour l'affichage carte. */
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

private val GrayBg    = Color(0xFFF4F4F7)
private val DarkColor = Color(0xFF1A1A2E)

private const val GPS_READY_ACCURACY_M = 20f

private enum class GpsPhase { IDLE, CALIBRATING, RUNNING, PAUSED }

private fun LiveTrackState.gpsPhase(): GpsPhase = when {
    isTracking && isPaused -> GpsPhase.PAUSED
    isTracking             -> GpsPhase.RUNNING
    calibrationAccuracyM != null -> GpsPhase.CALIBRATING
    else                    -> GpsPhase.IDLE
}

/**
 * Exécution GPS live d'une randonnée directe — même base que RunningWorkoutExecuteScreen,
 * sans étapes/répétitions structurées (pas de plan pour une rando libre).
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HikingWorkoutExecuteScreen(
    workoutId: Long,
    onNavigateBack: () -> Unit,
    onNavigateToReport: (Long) -> Unit = { onNavigateBack() },
    viewModel: HikingExecuteViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val liveTrackState by viewModel.liveTrackState.collectAsStateWithLifecycle()
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

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(
                            uiState.workout?.name ?: stringResource(R.string.hiking_execute_title_fallback),
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
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, stringResource(R.string.hiking_execute_navigate_back_cd))
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = PandaAmber, titleContentColor = Color.White, navigationIconContentColor = Color.White),
            )
        },
        containerColor = MaterialTheme.colorScheme.background,
    ) { innerPadding ->
        if (uiState.isLoading) { PandaLoadingIndicator(); return@Scaffold }

        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(innerPadding),
            contentPadding = PaddingValues(start = 16.dp, end = 16.dp, bottom = 32.dp),
        ) {
            // ── Carte GPS live ──
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

            // ── Résultats globaux ──
            item {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(GrayBg, RoundedCornerShape(14.dp))
                        .padding(14.dp),
                ) {
                    Text(
                        stringResource(R.string.hiking_execute_global_results_label),
                        style = MaterialTheme.typography.labelSmall,
                        color = PandaSubtext,
                        fontWeight = FontWeight.Bold,
                    )
                    Spacer(Modifier.height(10.dp))
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        ResultInputCell(stringResource(R.string.hiking_execute_cell_distance), uiState.resultDistanceKm, { viewModel.updateOverallResult("distanceKm", it) }, KeyboardType.Decimal, Modifier.weight(1f))
                        ResultInputCell(stringResource(R.string.hiking_execute_cell_time), uiState.resultDurationStr, { viewModel.updateOverallResult("duration", it) }, KeyboardType.Text, Modifier.weight(1f))
                        ReadOnlyCell(stringResource(R.string.hiking_execute_cell_speed), uiState.resultSpeedKmh, Modifier.weight(1f))
                    }
                    Spacer(Modifier.height(8.dp))
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        ResultInputCell(stringResource(R.string.hiking_execute_cell_elevation), uiState.resultElevationM, { viewModel.updateOverallResult("elevation", it) }, KeyboardType.Number, Modifier.weight(1f))
                        ResultInputCell(stringResource(R.string.hiking_execute_cell_hr_avg), uiState.resultHrAvg, { viewModel.updateOverallResult("hr", it) }, KeyboardType.Number, Modifier.weight(1f))
                        ResultInputCell(stringResource(R.string.hiking_execute_cell_hr_max), uiState.resultHrMax, { viewModel.updateOverallResult("hrMax", it) }, KeyboardType.Number, Modifier.weight(1f))
                    }
                    Spacer(Modifier.height(8.dp))
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        ResultInputCell(stringResource(R.string.hiking_execute_cell_rpe), uiState.resultRpe, { viewModel.updateOverallResult("rpe", it) }, KeyboardType.Number, Modifier.weight(1f))
                        ResultInputCell(stringResource(R.string.hiking_execute_cell_calories), uiState.resultCalories, { viewModel.updateOverallResult("calories", it) }, KeyboardType.Number, Modifier.weight(1f))
                    }
                }
                Spacer(Modifier.height(16.dp))
            }

            // ── Note de séance ──
            item {
                Text(
                    stringResource(R.string.hiking_execute_session_note_label),
                    style = MaterialTheme.typography.labelSmall,
                    color = PandaSubtext,
                    fontWeight = FontWeight.Bold,
                )
                Spacer(Modifier.height(6.dp))
                OutlinedTextField(
                    value = uiState.resultNotes,
                    onValueChange = { viewModel.updateOverallResult("notes", it) },
                    modifier = Modifier.fillMaxWidth(),
                    minLines = 3,
                    placeholder = { Text(stringResource(R.string.hiking_execute_session_note_placeholder)) },
                    shape = RoundedCornerShape(12.dp),
                )
                Spacer(Modifier.height(16.dp))
            }
        }
    }
}

@Composable
private fun ResultInputCell(label: String, value: String, onValueChange: (String) -> Unit, keyboardType: KeyboardType, modifier: Modifier = Modifier) {
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
                    if (value.isEmpty()) Text("—", style = TextStyle(fontSize = 15.sp, color = PandaSubtext, textAlign = TextAlign.Center))
                    inner()
                }
            },
        )
    }
}

@Composable
private fun ReadOnlyCell(label: String, value: String, modifier: Modifier = Modifier) {
    Column(
        modifier = modifier
            .background(Color(0xFFEAEAEA), RoundedCornerShape(10.dp))
            .padding(horizontal = 10.dp, vertical = 8.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(label, style = MaterialTheme.typography.labelSmall, color = PandaSubtext, textAlign = TextAlign.Center)
        Text(
            text = if (value.isEmpty()) "auto" else "$value km/h",
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

// ── GPS live tracking block ───────────────────────────────────────────────────

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
                    Button(onClick = onRequestPermission, colors = ButtonDefaults.buttonColors(containerColor = PandaAmber)) {
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
                                outlinePaint.color = android.graphics.Color.parseColor("#F59E0B")
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

            Column(
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .fillMaxWidth()
                    .background(Color(0xCC000000))
                    .padding(horizontal = 16.dp, vertical = 8.dp),
            ) {
                when (phase) {
                    GpsPhase.IDLE, GpsPhase.CALIBRATING -> {
                        val calibrationAccuracyM = state.calibrationAccuracyM
                        val accuracyText = when {
                            calibrationAccuracyM == null || calibrationAccuracyM >= Float.MAX_VALUE / 2 ->
                                "Acquisition GPS..."
                            calibrationAccuracyM <= GPS_READY_ACCURACY_M ->
                                "GPS capté · Précision : %.0fm ✓".format(calibrationAccuracyM)
                            else ->
                                "Acquisition GPS... Précision : %.0fm".format(calibrationAccuracyM)
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
                    GpsPhase.RUNNING, GpsPhase.PAUSED -> {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .alpha(if (phase == GpsPhase.PAUSED) 0.5f else 1f),
                            horizontalArrangement = Arrangement.SpaceEvenly,
                        ) {
                            GpsStat("Distance", "%.2f km".format(state.distanceM / 1000.0))
                            GpsStat("Durée", fmtGpsDuration(state.durationSec))
                            GpsStat("Dénivelé", "↑ ${state.elevationGainM}m")
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
                color = PandaAmber,
            )
        } else when (state.gpsPhase()) {
            GpsPhase.IDLE, GpsPhase.CALIBRATING -> {
                val calibrationAccuracyM = state.calibrationAccuracyM
                val ready = calibrationAccuracyM != null && calibrationAccuracyM <= GPS_READY_ACCURACY_M
                CircleActionButton(
                    label = "▶ Démarrer",
                    color = PandaAmber,
                    enabled = ready,
                    onClick = onStartRequested,
                )
            }
            GpsPhase.RUNNING -> {
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
                    CircleActionButton(label = "▶ Reprendre", color = PandaAmber, onClick = onResume)
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

private fun fmtGpsDuration(totalSec: Int): String {
    val h = totalSec / 3600
    val m = (totalSec % 3600) / 60
    val s = totalSec % 60
    return if (h > 0) "$h:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}"
    else "$m:${s.toString().padStart(2, '0')}"
}
