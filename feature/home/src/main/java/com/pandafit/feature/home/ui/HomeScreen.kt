package com.pandafit.feature.home.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.DirectionsBike
import androidx.compose.material.icons.automirrored.filled.DirectionsRun
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.foundation.Image
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.foundation.layout.IntrinsicSize
import com.pandafit.feature.home.R
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.pandafit.core.database.entities.WorkoutType
import com.pandafit.designsystem.components.PandaLoadingIndicator
import com.pandafit.designsystem.theme.*
import com.pandafit.core.designsystem.R as DesignSystemR
import com.pandafit.feature.home.model.HomeUiState
import com.pandafit.feature.home.model.WeeklySummary
import com.pandafit.feature.home.viewmodel.HomeViewModel
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.runtime.LaunchedEffect
import sh.calvin.reorderable.ReorderableItem
import sh.calvin.reorderable.rememberReorderableLazyListState
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
    onNavigateToWorkout: (type: String, id: Long) -> Unit,
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
        onNavigateToCalendar = onNavigateToCalendar,
        onNavigateToTimer = onNavigateToTimer,
        onNavigateToStats = onNavigateToStats,
        onNavigateToProfile = onNavigateToProfile,
        onNavigateToWorkout = onNavigateToWorkout,
        onNavigateToInstance = onNavigateToInstance ?: {},
        onNavigateToInstanceReport = onNavigateToInstanceReport ?: {},
        onOpenDrawer = onOpenDrawer,
        onReorderSection = viewModel::reorderByTag,
        activeInstanceId = activeInstanceId,
        activeSeanceName = activeSeanceName,
        sessionSeconds = sessionSeconds,
        restRemaining = restRemaining,
        scrollToTopKey = scrollToTopKey,
    )
}

@Composable
private fun HomeContent(
    uiState: HomeUiState,
    onNavigateToRunning: () -> Unit,
    onNavigateToCycling: () -> Unit,
    onNavigateToStrength: () -> Unit,
    onNavigateToCalendar: () -> Unit,
    onNavigateToTimer: () -> Unit,
    onNavigateToStats: () -> Unit,
    onNavigateToProfile: () -> Unit,
    onNavigateToWorkout: (String, Long) -> Unit,
    onNavigateToInstance: (Long) -> Unit,
    onNavigateToInstanceReport: (Long) -> Unit,
    onOpenDrawer: () -> Unit,
    onReorderSection: (fromTag: String, toTag: String) -> Unit,
    activeInstanceId: Long? = null,
    activeSeanceName: String? = null,
    sessionSeconds: Int = 0,
    restRemaining: Int = 0,
    scrollToTopKey: Int = 0,
) {
    Scaffold(containerColor = MaterialTheme.colorScheme.background) { innerPadding ->
        if (uiState.isLoading) { PandaLoadingIndicator(); return@Scaffold }

        val allSections = listOf(
            SectionItem("Course à pieds", PandaRed,     Icons.AutoMirrored.Filled.DirectionsRun,  onNavigateToRunning,  "panda_running",  null),
            SectionItem("Vélo",           PandaBlue,    Icons.AutoMirrored.Filled.DirectionsBike, onNavigateToCycling,  "panda_cycling",  R.drawable.img_panda_cycling),
            SectionItem("Renforcement",   PandaPurple,  Icons.Default.FitnessCenter,              onNavigateToStrength, "panda_strength", null),
            SectionItem("Calendrier",     PandaOrange,  Icons.Default.CalendarMonth,              onNavigateToCalendar, "panda_calendar", R.drawable.img_panda_calendar),
            SectionItem("Minuteur",       PandaGreen,   Icons.Default.Timer,                      onNavigateToTimer,    "panda_timer",    null),
            SectionItem("Stats",          PandaBlue,    Icons.Default.BarChart,                   onNavigateToStats,    "panda_stats",    null),
            SectionItem("Profil",         PandaSubtext, Icons.Default.Person,                     onNavigateToProfile,  "panda_profile",  null),
        )

        // Applique l'ordre sauvegardé
        val sortedSections = if (uiState.sectionTags.isEmpty()) {
            allSections
        } else {
            val indexMap = uiState.sectionTags.withIndex().associate { (i, tag) -> tag to i }
            allSections.sortedBy { indexMap[it.tag] ?: Int.MAX_VALUE }
        }

        val lazyListState = rememberLazyListState()
        LaunchedEffect(scrollToTopKey) {
            if (scrollToTopKey > 0) lazyListState.animateScrollToItem(0)
        }
        val reorderState = rememberReorderableLazyListState(
            lazyListState = lazyListState,
            onMove = { from, to ->
                onReorderSection(from.key as String, to.key as String)
            },
        )

        LazyColumn(
            state = lazyListState,
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(bottom = 120.dp),
        ) {
            // ── Header violet ──
            item(key = "header") {
                HomeHeader(
                    uiState = uiState,
                    innerPaddingTop = innerPadding.calculateTopPadding(),
                    onOpenDrawer = onOpenDrawer,
                    onNavigateToProfile = onNavigateToProfile,
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
                        modifier = Modifier.padding(start = 16.dp, top = 20.dp, bottom = 8.dp),
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
                            )
                        },
                    )
                }
            }

            // ── Sections ──
            item(key = "sections_label") {
                Text(
                    "MES ENTRAÎNEMENTS",
                    style = MaterialTheme.typography.labelSmall,
                    color = PandaSubtext,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(start = 16.dp, top = 24.dp, bottom = 8.dp),
                )
            }

            items(sortedSections, key = { it.tag }) { section ->
                ReorderableItem(reorderState, key = section.tag) { isDragging ->
                    SectionBarCard(
                        section = section,
                        isDragging = isDragging,
                        dragHandleModifier = Modifier.longPressDraggableHandle(),
                        modifier = Modifier.padding(horizontal = 16.dp, vertical = 5.dp),
                    )
                }
            }
        }
    }
}

// ── Header ────────────────────────────────────────────────────────────────────

@Composable
private fun HomeHeader(
    uiState: HomeUiState,
    innerPaddingTop: androidx.compose.ui.unit.Dp,
    onOpenDrawer: () -> Unit,
    onNavigateToProfile: () -> Unit,
) {
    val summary = uiState.weeklySummary
    val initial = uiState.userName.firstOrNull()?.uppercaseChar()?.toString() ?: "?"

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .background(Brush.verticalGradient(listOf(KalyptusGreenDark, KalyptusGreen)))
            .padding(top = innerPaddingTop + 12.dp, start = 16.dp, end = 16.dp, bottom = 20.dp),
    ) {
        Column {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                IconButton(onClick = onOpenDrawer, modifier = Modifier.size(40.dp)) {
                    Icon(Icons.Default.Menu, contentDescription = "Menu", tint = Color.White)
                }
                Spacer(Modifier.weight(1f))
                Box(
                    modifier = Modifier
                        .size(36.dp)
                        .clip(CircleShape)
                        .background(Color.White.copy(alpha = 0.2f))
                        .clickable(onClick = onNavigateToProfile),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(initial, style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.Bold, color = Color.White)
                }
            }

            Spacer(Modifier.height(8.dp))

            val greeting = if (uiState.userName.isNotBlank())
                "Bonjour ${uiState.userName.substringBefore(' ')} 👋"
            else "Bonjour 👋"
            Text(
                greeting,
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.ExtraBold,
                color = Color.White,
                modifier = Modifier.fillMaxWidth(),
                textAlign = TextAlign.Center,
            )
            Spacer(Modifier.height(4.dp))
            Text(
                "Prêt pour ta prochaine activité ?",
                style = MaterialTheme.typography.bodySmall,
                color = Color.White.copy(alpha = 0.65f),
                modifier = Modifier.fillMaxWidth(),
                textAlign = TextAlign.Center,
            )
            Spacer(Modifier.height(16.dp))
            WeekRecapCard(summary)
        }
    }
}

@Composable
private fun WeekRecapCard(summary: WeeklySummary) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(Color.White.copy(alpha = 0.12f))
            .padding(horizontal = 16.dp, vertical = 12.dp),
    ) {
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceEvenly) {
            WeekStatColumn("${summary.totalSessions}", "Séances")
            WeekStatDivider()
            WeekStatColumn(
                if (summary.runningDistanceKm > 0) "${"%.1f".format(summary.runningDistanceKm)} km" else "—",
                "Distance",
            )
            WeekStatDivider()
            WeekStatColumn(formatDuration(summary.totalDurationMinutes), "Durée")
        }
    }
}

@Composable
private fun WeekStatColumn(value: String, label: String) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(value, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.ExtraBold, color = Color.White)
        Text(label, style = MaterialTheme.typography.labelSmall, color = Color.White.copy(alpha = 0.6f))
    }
}

@Composable
private fun WeekStatDivider() {
    Box(modifier = Modifier.height(32.dp).width(1.dp).background(Color.White.copy(alpha = 0.2f)))
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
                Text(title, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = contentAlpha))
                Text(dateStr, style = MaterialTheme.typography.bodySmall,
                    color = PandaSubtext.copy(alpha = contentAlpha))
            }
            if (isCompleted) {
                Icon(Icons.Default.CheckCircle, null, tint = PandaSubtext.copy(alpha = 0.6f), modifier = Modifier.size(18.dp))
            } else {
                Icon(Icons.Default.PlayArrow, null, tint = accentColor, modifier = Modifier.size(18.dp))
            }
        }
    }
}

// ── Section bar card ──────────────────────────────────────────────────────────

@Composable
private fun SectionBarCard(
    section: SectionItem,
    isDragging: Boolean,
    dragHandleModifier: Modifier,
    modifier: Modifier = Modifier,
) {
    Card(
        onClick = section.onClick,
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = section.color.copy(alpha = 0.09f)),
        elevation = CardDefaults.cardElevation(defaultElevation = if (isDragging) 6.dp else 0.dp),
        border = BorderStroke(1.dp, section.color.copy(alpha = if (isDragging) 0.45f else 0.20f)),
        modifier = modifier
            .fillMaxWidth()
            .then(if (isDragging) Modifier.shadow(6.dp, RoundedCornerShape(16.dp)) else Modifier),
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .height(80.dp)
                .then(dragHandleModifier),
            verticalAlignment = Alignment.CenterVertically,
        ) {

            // Chevron
            Icon(
                Icons.Default.ChevronRight,
                contentDescription = null,
                tint = section.color.copy(alpha = 0.50f),
                modifier = Modifier
                    .padding(start = 10.dp, end = 6.dp)
                    .size(30.dp)

            )

            // Titre
            Text(
                section.label,
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold,
                color = section.color,
                modifier = Modifier
                    .weight(1f)
                    .padding(start = 4.dp),
            )

            // Illustration sport — droite de la bannière
            if (section.imageRes != null) {
                Image(
                    painter = painterResource(id = section.imageRes),
                    contentDescription = null,
                    contentScale = ContentScale.Inside,
                    // alignment = Alignment.CenterEnd,
                    modifier = Modifier
                        // .fillMaxHeight()
                        .height(80.dp)
                        .width(100.dp)
                )
            } else {
                Spacer(Modifier.width(64.dp))
            }
        }
    }
}

// ── Data classes & helpers ────────────────────────────────────────────────────

private data class SectionItem(
    val label: String,
    val color: Color,
    val icon: ImageVector,
    val onClick: () -> Unit,
    val tag: String,
    val imageRes: Int? = null,
)

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
