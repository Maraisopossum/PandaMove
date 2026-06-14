package com.pandafit.feature.home.ui

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.DirectionsBike
import androidx.compose.material.icons.automirrored.filled.DirectionsRun
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.pandafit.core.database.entities.WorkoutType
import com.pandafit.designsystem.components.PandaLoadingIndicator
import com.pandafit.designsystem.theme.*
import com.pandafit.feature.home.R
import com.pandafit.feature.home.model.HomeUiState
import com.pandafit.feature.home.model.WeeklySummary
import com.pandafit.feature.home.viewmodel.HomeViewModel
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.time.format.TextStyle
import java.util.Locale

@Composable
fun HomeScreen(
    onNavigateToRunning: () -> Unit,
    onNavigateToCycling: () -> Unit,
    onNavigateToStrength: () -> Unit,
    onNavigateToCalendar: () -> Unit,
    onNavigateToTimer: () -> Unit = {},
    onNavigateToStats: () -> Unit = {},
    onNavigateToProfile: () -> Unit = {},
    onNavigateToBreathing: () -> Unit = {},
    onNavigateToWorkout: (type: String, id: Long, isCompleted: Boolean) -> Unit,
    onNavigateToInstance: ((Long) -> Unit)? = null,
    onNavigateToInstanceReport: ((Long) -> Unit)? = null,
    onOpenDrawer: () -> Unit = {},
    activeInstanceId: Long? = null,
    activeSeanceName: String? = null,
    sessionSeconds: Int = 0,
    restRemaining: Int = 0,
    scrollToTopKey: Int = 0,
    viewModel: HomeViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

    HomeContent(
        uiState = uiState,
        onNavigateToRunning = onNavigateToRunning,
        onNavigateToCycling = onNavigateToCycling,
        onNavigateToStrength = onNavigateToStrength,
        onNavigateToBreathing = onNavigateToBreathing,
        onNavigateToWorkout = onNavigateToWorkout,
        onNavigateToInstance = onNavigateToInstance ?: {},
        onNavigateToInstanceReport = onNavigateToInstanceReport ?: {},
        onOpenDrawer = onOpenDrawer,
        activeInstanceId = activeInstanceId,
        activeSeanceName = activeSeanceName,
        sessionSeconds = sessionSeconds,
        restRemaining = restRemaining,
        scrollToTopKey = scrollToTopKey,
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun HomeContent(
    uiState: HomeUiState,
    onNavigateToRunning: () -> Unit,
    onNavigateToCycling: () -> Unit,
    onNavigateToStrength: () -> Unit,
    onNavigateToBreathing: () -> Unit,
    onNavigateToWorkout: (String, Long, Boolean) -> Unit,
    onNavigateToInstance: (Long) -> Unit,
    onNavigateToInstanceReport: (Long) -> Unit,
    onOpenDrawer: () -> Unit,
    activeInstanceId: Long? = null,
    activeSeanceName: String? = null,
    sessionSeconds: Int = 0,
    restRemaining: Int = 0,
    scrollToTopKey: Int = 0,
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        "PandaMove",
                        style = MaterialTheme.typography.headlineMedium,
                        fontWeight = FontWeight.ExtraBold,
                    )
                },
                actions = {
                    IconButton(onClick = onOpenDrawer) {
                        Icon(Icons.Default.Menu, contentDescription = "Menu")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface,
                ),
            )
        },
        containerColor = MaterialTheme.colorScheme.background,
    ) { innerPadding ->
        if (uiState.isLoading) { PandaLoadingIndicator(); return@Scaffold }

        val summary = uiState.weeklySummary
        val lazyListState = rememberLazyListState()
        LaunchedEffect(scrollToTopKey) {
            if (scrollToTopKey > 0) lazyListState.animateScrollToItem(0)
        }

        LazyColumn(
            state = lazyListState,
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(
                top = innerPadding.calculateTopPadding(),
                bottom = 80.dp,
            ),
        ) {
            // ── Bilan hebdo ──
            item(key = "week_recap") {
                WeekRecapCard(
                    summary = summary,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp),
                )
            }

            // ── Banneau séance active ──
            if (activeInstanceId != null) {
                item(key = "active_session_banner") {
                    ActiveResumeBanner(
                        seanceName = activeSeanceName ?: "Séance en cours",
                        sessionSeconds = sessionSeconds,
                        restRemaining = restRemaining,
                        onClick = { onNavigateToInstance(activeInstanceId) },
                    )
                }
            }

            // ── Séances du jour ──
            val hasUpcoming = uiState.upcomingInstances.isNotEmpty() || uiState.upcomingWorkouts.isNotEmpty()
            if (hasUpcoming) {
                item(key = "today_label") {
                    Text(
                        "SÉANCES DU JOUR",
                        style = MaterialTheme.typography.labelSmall,
                        color = PandaSubtext,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(start = 16.dp, top = 4.dp, bottom = 8.dp),
                    )
                }
                items(uiState.upcomingInstances, key = { "inst_${it.first.id}" }) { (instance, seance) ->
                    TodaySessionCard(
                        title = seance?.nom ?: "Renforcement",
                        dateStr = formatDate(instance.date),
                        accentColor = PandaPurple,
                        isCompleted = instance.isCompleted,
                        onClick = {
                            if (instance.isCompleted) onNavigateToInstanceReport(instance.id)
                            else onNavigateToInstance(instance.id)
                        },
                    )
                }
                items(uiState.upcomingWorkouts, key = { "w_${it.id}" }) { workout ->
                    val accentColor = when (workout.workoutType) {
                        WorkoutType.RUNNING  -> PandaGreen
                        WorkoutType.CYCLING  -> PandaBlue
                        WorkoutType.STRENGTH -> PandaPurple
                    }
                    TodaySessionCard(
                        title = workout.name,
                        dateStr = formatDate(workout.scheduledDate),
                        accentColor = accentColor,
                        isCompleted = workout.isCompleted,
                        onClick = {
                            onNavigateToWorkout(
                                when (workout.workoutType) {
                                    WorkoutType.RUNNING  -> "running"
                                    WorkoutType.CYCLING  -> "cycling"
                                    WorkoutType.STRENGTH -> "strength"
                                },
                                workout.id,
                                workout.isCompleted,
                            )
                        },
                    )
                }
            }

            // ── Activités ──
            item(key = "activities_label") {
                Text(
                    "MES ACTIVITÉS",
                    style = MaterialTheme.typography.labelSmall,
                    color = PandaSubtext,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(start = 16.dp, top = 16.dp, bottom = 8.dp),
                )
            }
            item(key = "activity_running") {
                ActivityCard(
                    label = "Course à pieds",
                    color = PandaGreen,
                    imageRes = null, // img_panda_running manquant
                    icon = Icons.AutoMirrored.Filled.DirectionsRun,
                    stat = if (summary.runningCount == 0) "Aucun run cette semaine"
                           else if (summary.runningDistanceKm > 0) "${"%.1f".format(summary.runningDistanceKm)} km cette semaine"
                           else "${summary.runningCount} séance${if (summary.runningCount > 1) "s" else ""} cette semaine",
                    onClick = onNavigateToRunning,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 5.dp),
                )
            }
            item(key = "activity_cycling") {
                ActivityCard(
                    label = "Vélo",
                    color = PandaBlue,
                    imageRes = R.drawable.img_panda_cycling,
                    icon = Icons.AutoMirrored.Filled.DirectionsBike,
                    stat = if (summary.cyclingCount == 0) "Aucune sortie cette semaine"
                           else "${summary.cyclingCount} sortie${if (summary.cyclingCount > 1) "s" else ""} cette semaine",
                    onClick = onNavigateToCycling,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 5.dp),
                )
            }
            item(key = "activity_strength") {
                ActivityCard(
                    label = "Renforcement",
                    color = PandaPurple,
                    imageRes = null, // img_panda_strength manquant
                    icon = Icons.Default.FitnessCenter,
                    stat = if (summary.strengthCount == 0) "Aucune séance cette semaine"
                           else "${summary.strengthCount} séance${if (summary.strengthCount > 1) "s" else ""} cette semaine",
                    onClick = onNavigateToStrength,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 5.dp),
                )
            }
            item(key = "activity_breathing") {
                ActivityCard(
                    label = "Respiration",
                    color = KalyptusGreen,
                    imageRes = null, // img_panda_breathing manquant
                    icon = Icons.Default.Air,
                    stat = if (summary.breathingCount == 0) "Aucune session cette semaine"
                           else "${summary.breathingDurationMinutes} min cette semaine",
                    onClick = onNavigateToBreathing,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 5.dp),
                )
            }
        }
    }
}

// ── Activity card ─────────────────────────────────────────────────────────────

@Composable
private fun ActivityCard(
    label: String,
    color: Color,
    imageRes: Int?,
    icon: ImageVector,
    stat: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Card(
        onClick = onClick,
        shape = RoundedCornerShape(16.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
        modifier = modifier.fillMaxWidth().height(180.dp),
    ) {
        Box(modifier = Modifier.fillMaxSize()) {
            if (imageRes != null) {
                Image(
                    painter = painterResource(imageRes),
                    contentDescription = null,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxSize(),
                )
            } else {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(
                            Brush.linearGradient(
                                listOf(color.copy(alpha = 0.55f), color.copy(alpha = 0.85f))
                            )
                        ),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(
                        icon,
                        contentDescription = null,
                        tint = Color.White.copy(alpha = 0.20f),
                        modifier = Modifier.size(90.dp),
                    )
                }
            }
            // Gradient pour lisibilité du texte
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(
                        Brush.verticalGradient(
                            listOf(Color.Transparent, Color.Black.copy(alpha = 0.60f)),
                        )
                    )
            )
            // Bande gauche 4dp
            Box(
                modifier = Modifier
                    .width(4.dp)
                    .fillMaxHeight()
                    .background(color)
            )
            // Texte bas-gauche
            Column(
                modifier = Modifier
                    .align(Alignment.BottomStart)
                    .padding(start = 16.dp, bottom = 14.dp, end = 16.dp),
            ) {
                Text(
                    stat,
                    style = MaterialTheme.typography.labelMedium,
                    color = Color.White.copy(alpha = 0.80f),
                )
                Text(
                    label,
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.ExtraBold,
                    color = Color.White,
                )
            }
        }
    }
}

// ── Bilan de la semaine ───────────────────────────────────────────────────────

@Composable
private fun WeekRecapCard(summary: WeeklySummary, modifier: Modifier = Modifier) {
    Card(
        shape = RoundedCornerShape(16.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        modifier = modifier.fillMaxWidth(),
    ) {
        Column(modifier = Modifier.padding(horizontal = 16.dp, vertical = 14.dp)) {
            Text(
                "BILAN DE LA SEMAINE",
                style = MaterialTheme.typography.labelSmall,
                color = PandaSubtext,
                fontWeight = FontWeight.Bold,
            )
            Spacer(Modifier.height(10.dp))
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceEvenly) {
                WeekStatColumn("${summary.totalSessions}", "Séances", PandaPurple)
                WeekStatDivider()
                WeekStatColumn(
                    if (summary.runningDistanceKm > 0) "${"%.1f".format(summary.runningDistanceKm)} km" else "—",
                    "Distance",
                    PandaGreen,
                )
                WeekStatDivider()
                WeekStatColumn(formatDuration(summary.totalDurationMinutes), "Durée", PandaBlue)
            }
        }
    }
}

@Composable
private fun WeekStatColumn(value: String, label: String, color: Color) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(
            value,
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.ExtraBold,
            color = color,
        )
        Text(label, style = MaterialTheme.typography.labelSmall, color = PandaSubtext)
    }
}

@Composable
private fun WeekStatDivider() {
    Box(modifier = Modifier.height(32.dp).width(1.dp).background(PandaSubtext.copy(alpha = 0.20f)))
}

// ── Séance du jour ────────────────────────────────────────────────────────────

@Composable
private fun TodaySessionCard(
    title: String,
    dateStr: String,
    accentColor: Color,
    isCompleted: Boolean = false,
    onClick: () -> Unit,
) {
    val cardColor = if (isCompleted) MaterialTheme.colorScheme.surface.copy(alpha = 0.6f)
                    else MaterialTheme.colorScheme.surface
    val contentAlpha = if (isCompleted) 0.5f else 1f
    val stripeColor = if (isCompleted) PandaSubtext else accentColor

    Card(
        shape = RoundedCornerShape(12.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = if (isCompleted) 0.dp else 1.dp),
        onClick = onClick,
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp),
        colors = CardDefaults.cardColors(containerColor = cardColor),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(modifier = Modifier.width(4.dp).height(40.dp).background(stripeColor, RoundedCornerShape(2.dp)))
            Spacer(Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    title,
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = contentAlpha),
                )
                Text(
                    dateStr,
                    style = MaterialTheme.typography.bodySmall,
                    color = PandaSubtext.copy(alpha = contentAlpha),
                )
            }
            if (isCompleted) {
                Icon(Icons.Default.CheckCircle, null, tint = PandaSubtext.copy(alpha = 0.6f), modifier = Modifier.size(18.dp))
            } else {
                Icon(Icons.Default.PlayArrow, null, tint = accentColor, modifier = Modifier.size(18.dp))
            }
        }
    }
}

// ── Banneau reprise de séance active ─────────────────────────────────────────

@Composable
private fun ActiveResumeBanner(
    seanceName: String,
    sessionSeconds: Int,
    restRemaining: Int,
    onClick: () -> Unit,
) {
    val sessionLabel = "${sessionSeconds / 60}:${(sessionSeconds % 60).toString().padStart(2, '0')}"
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 8.dp)
            .background(KalyptusGreen, RoundedCornerShape(12.dp))
            .clickable(onClick = onClick)
            .padding(horizontal = 14.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Icon(Icons.Default.FitnessCenter, null, tint = Color.White, modifier = Modifier.size(16.dp))
        Text(
            seanceName,
            style = MaterialTheme.typography.labelMedium,
            fontWeight = FontWeight.SemiBold,
            color = Color.White,
            modifier = Modifier.weight(1f),
        )
        if (restRemaining > 0) {
            Icon(Icons.Default.Timer, null, tint = Color.White.copy(alpha = 0.85f), modifier = Modifier.size(14.dp))
            val restLabel = "${restRemaining / 60}:${(restRemaining % 60).toString().padStart(2, '0')}"
            Text(restLabel, style = MaterialTheme.typography.labelSmall, color = Color.White.copy(alpha = 0.85f))
            Spacer(Modifier.width(4.dp))
        }
        Text(sessionLabel, style = MaterialTheme.typography.labelSmall, color = Color.White.copy(alpha = 0.7f))
        Icon(Icons.Default.PlayArrow, "Reprendre", tint = Color.White, modifier = Modifier.size(16.dp))
    }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

private fun formatDate(date: LocalDate): String {
    val day = date.dayOfWeek.getDisplayName(TextStyle.FULL, Locale.FRENCH)
    val fmt = DateTimeFormatter.ofPattern("d MMMM", Locale.FRENCH)
    return "$day ${date.format(fmt)}".replaceFirstChar { it.uppercaseChar() }
}

private fun formatDuration(minutes: Int): String {
    if (minutes == 0) return "—"
    val h = minutes / 60; val m = minutes % 60
    return if (h > 0) "${h}h${m.toString().padStart(2, '0')}" else "${m}min"
}
