package com.pandafit.feature.home.ui

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
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
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.pandafit.core.database.entities.WorkoutType
import com.pandafit.designsystem.components.PandaLoadingIndicator
import com.pandafit.designsystem.theme.*
import com.pandafit.feature.home.R
import com.pandafit.feature.home.R.drawable.bg_card_cycling
import com.pandafit.feature.home.data.pandaFactOfTheDay
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
    onNavigateToHiking: () -> Unit = {},
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
        onNavigateToHiking = onNavigateToHiking,
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
    onNavigateToHiking: () -> Unit,
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
                        stringResource(R.string.home_screen_title),
                        style = MaterialTheme.typography.headlineMedium,
                        fontWeight = FontWeight.ExtraBold,
                    )
                },
                actions = {
                    IconButton(onClick = onOpenDrawer) {
                        Icon(Icons.Default.Menu, contentDescription = stringResource(R.string.home_menu_cd))
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
            // ── Salutation ──
            item(key = "greeting") {
                val prenom = uiState.userName.substringBefore(' ').ifBlank { null }
                val fact = remember { pandaFactOfTheDay() }
                Column(modifier = Modifier.padding(start = 16.dp, end = 16.dp, top = 12.dp, bottom = 4.dp)) {
                    Text(
                        if (prenom != null) stringResource(R.string.home_greeting_with_name, prenom) else stringResource(R.string.home_greeting),
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.ExtraBold,
                        color = MaterialTheme.colorScheme.onBackground,
                    )
                    Text(
                        stringResource(R.string.home_subtitle),
                        style = MaterialTheme.typography.bodySmall,
                        color = PandaSubtext,
                    )
                    Spacer(Modifier.height(10.dp))
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(
                                MaterialTheme.colorScheme.surface,
                                RoundedCornerShape(10.dp),
                            )
                            .padding(horizontal = 12.dp, vertical = 10.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        Text("🐼", style = MaterialTheme.typography.bodySmall)
                        Text(
                            fact,
                            style = MaterialTheme.typography.bodySmall,
                            color = PandaSubtext,
                            modifier = Modifier.weight(1f),
                        )
                    }
                }
            }

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
                        seanceName = activeSeanceName ?: stringResource(R.string.home_active_session_fallback),
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
                        stringResource(R.string.home_section_today),
                        style = MaterialTheme.typography.labelSmall,
                        color = PandaSubtext,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(start = 16.dp, top = 4.dp, bottom = 8.dp),
                    )
                }
                items(uiState.upcomingInstances, key = { "inst_${it.first.id}" }) { (instance, seance) ->
                    TodaySessionCard(
                        title = seance?.nom ?: stringResource(R.string.home_instance_title_fallback),
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
                        WorkoutType.HIKING   -> PandaAmber
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
                                    WorkoutType.HIKING   -> "hiking"
                                },
                                workout.id,
                                workout.isCompleted,
                            )
                        },
                    )
                }
            }

            // ── Activités (carousel horizontal) ──
            item(key = "activities_label") {
                Text(
                    stringResource(R.string.home_section_activities),
                    style = MaterialTheme.typography.labelSmall,
                    color = PandaSubtext,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(start = 16.dp, top = 16.dp, bottom = 8.dp),
                )
            }
            item(key = "activities_row") {
                LazyRow(
                    contentPadding = PaddingValues(horizontal = 16.dp),
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    item {
                        ActivityCard(
                            label = stringResource(R.string.home_activity_running),
                            color = PandaGreen,
                            bgImageRes = null,          // → bg_card_running.jpg
                            pandaImageRes = null,       // → img_panda_running.png
                            icon = Icons.AutoMirrored.Filled.DirectionsRun,
                            stat = if (summary.runningCount == 0) stringResource(R.string.home_stat_no_run)
                                   else if (summary.runningDistanceKm > 0) "${"%.1f".format(summary.runningDistanceKm)} km"
                                   else "${summary.runningCount} séance${if (summary.runningCount > 1) "s" else ""}",
                            onClick = onNavigateToRunning,
                        )
                    }
                    item {
                        ActivityCard(
                            label = stringResource(R.string.home_activity_cycling),
                            color = PandaBlue,
                            bgImageRes = bg_card_cycling,
                            pandaImageRes = R.drawable.img_card_cycling,       // → img_panda_cycling_cutout.png
                            icon = Icons.AutoMirrored.Filled.DirectionsBike,
                            stat = if (summary.cyclingCount == 0) stringResource(R.string.home_stat_no_cycling)
                                   else "${summary.cyclingCount} sortie${if (summary.cyclingCount > 1) "s" else ""}",
                            onClick = onNavigateToCycling,
                        )
                    }
                    item {
                        ActivityCard(
                            label = stringResource(R.string.home_activity_strength),
                            color = PandaPurple,
                            bgImageRes = null,          // → bg_card_strength.jpg
                            pandaImageRes = null,       // → img_panda_strength.png
                            icon = Icons.Default.FitnessCenter,
                            stat = if (summary.strengthCount == 0) stringResource(R.string.home_stat_no_strength)
                                   else "${summary.strengthCount} séance${if (summary.strengthCount > 1) "s" else ""}",
                            onClick = onNavigateToStrength,
                        )
                    }
                    item {
                        ActivityCard(
                            label = stringResource(R.string.home_activity_breathing),
                            color = KalyptusGreen,
                            bgImageRes = null,          // → bg_card_breathing.jpg
                            pandaImageRes = null,       // → img_panda_breathing.png
                            icon = Icons.Default.Air,
                            stat = if (summary.breathingCount == 0) stringResource(R.string.home_stat_no_breathing)
                                   else "${summary.breathingDurationMinutes} min",
                            onClick = onNavigateToBreathing,
                        )
                    }
                    item {
                        ActivityCard(
                            label = stringResource(R.string.home_activity_hiking),
                            color = PandaAmber,
                            bgImageRes = null,          // → bg_card_hiking.jpg
                            pandaImageRes = null,       // → img_panda_hiking.png
                            icon = Icons.Default.Landscape,
                            stat = if (summary.hikingCount == 0) stringResource(R.string.home_stat_no_cycling)
                                   else if (summary.hikingDistanceKm > 0) "${"%.1f".format(summary.hikingDistanceKm)} km"
                                   else "${summary.hikingCount} sortie${if (summary.hikingCount > 1) "s" else ""}",
                            onClick = onNavigateToHiking,
                        )
                    }
                }
            }
        }
    }
}

// ── Activity card ─────────────────────────────────────────────────────────────

/**
 * Carte d'activité à deux couches d'image indépendantes.
 *
 * [bgImageRes]    — image de fond plein format (photo sport, décor). Dossier :
 *                   feature/home/src/main/res/drawable/
 *                   Ex: bg_card_running.jpg, bg_card_cycling.jpg …
 *                   Si null → gradient coloré.
 *
 * [pandaImageRes] — PNG avec fond transparent (cutout du panda). Même dossier.
 *                   Ex: img_panda_running.png, img_panda_cycling.png …
 *                   Affiché en bas-droite de la carte avec alpha 0.45f.
 */
@Composable
private fun ActivityCard(
    label: String,
    color: Color,
    bgImageRes: Int? = null,
    pandaImageRes: Int? = null,
    icon: ImageVector,
    stat: String,
    onClick: () -> Unit,
) {
    Card(
        onClick = onClick,
        shape = RoundedCornerShape(16.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
        modifier = Modifier.width(160.dp).height(260.dp),
    ) {
        Box(modifier = Modifier.fillMaxSize()) {

            // 1. Fond : image plein format ou gradient coloré
            if (bgImageRes != null) {
                Image(
                    painter = painterResource(bgImageRes),
                    contentDescription = null,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxSize(),
                )
                // Voile coloré pour harmoniser avec la teinte du module
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(color.copy(alpha = 0.30f))
                )
            } else {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(
                            Brush.verticalGradient(
                                listOf(color.copy(alpha = 0.50f), color.copy(alpha = 0.90f))
                            )
                        )
                )
            }

            // 2. Panda transparent (PNG cutout) positionné en bas-droite
            if (pandaImageRes != null) {
                Image(
                    painter = painterResource(pandaImageRes),
                    contentDescription = null,
                    contentScale = ContentScale.Fit,
                    modifier = Modifier
                        .align(Alignment.BottomEnd)
                        .fillMaxHeight(0.72f)
                        .alpha(0.45f),
                )
            } else if (bgImageRes == null) {
                // Icône fantôme quand ni fond ni panda
                Icon(
                    icon,
                    contentDescription = null,
                    tint = Color.White.copy(alpha = 0.18f),
                    modifier = Modifier.size(80.dp).align(Alignment.Center),
                )
            }

            // 3. Gradient sombre en bas pour la lisibilité du texte
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(
                        Brush.verticalGradient(
                            listOf(Color.Transparent, Color.Black.copy(alpha = 0.65f)),
                        )
                    )
            )

            // 4. Bande gauche colorée
            Box(
                modifier = Modifier
                    .width(4.dp)
                    .fillMaxHeight()
                    .background(color)
            )

            // 5. Texte bas-gauche
            Column(
                modifier = Modifier
                    .align(Alignment.BottomStart)
                    .padding(start = 12.dp, bottom = 12.dp, end = 8.dp),
            ) {
                Text(
                    stat,
                    style = MaterialTheme.typography.labelSmall,
                    color = Color.White.copy(alpha = 0.75f),
                )
                Text(
                    label,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.ExtraBold,
                    color = Color.White,
                )
            }
        }
    }
}

// ── Bilan de la semaine ───────────────────────────────────────────────────────

private data class SportDistance(val label: String, val km: Double, val color: Color)

@Composable
private fun WeekRecapCard(summary: WeeklySummary, modifier: Modifier = Modifier) {
    val distances = remember(summary) {
        listOf(
            SportDistance("Course",    summary.runningDistanceKm,  PandaGreen),
            SportDistance("Vélo",      summary.cyclingDistanceKm,  PandaBlue),
            SportDistance("Randonnée", summary.hikingDistanceKm,   PandaAmber),
        )
    }
    var distIdx by remember { mutableIntStateOf(0) }
    val currentDist = distances[distIdx]

    val activeBadges = remember(summary) {
        buildList {
            if (summary.runningCount  > 0) add(Triple("${summary.runningCount} course${if (summary.runningCount  > 1) "s" else ""}",  Icons.AutoMirrored.Filled.DirectionsRun,  PandaGreen))
            if (summary.cyclingCount  > 0) add(Triple("${summary.cyclingCount} vélo${if (summary.cyclingCount   > 1) "s" else ""}",    Icons.AutoMirrored.Filled.DirectionsBike, PandaBlue))
            if (summary.strengthCount > 0) add(Triple("${summary.strengthCount} renfo",                                                Icons.Default.FitnessCenter,              PandaPurple))
            if (summary.hikingCount   > 0) add(Triple("${summary.hikingCount} rando${if (summary.hikingCount    > 1) "s" else ""}",    Icons.Default.Landscape,                  PandaAmber))
            if (summary.breathingCount > 0) add(Triple("${summary.breathingCount} respiration${if (summary.breathingCount > 1) "s" else ""}",Icons.Default.Air,                  KalyptusGreen))
        }
    }

    Card(
        shape = RoundedCornerShape(16.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        modifier = modifier.fillMaxWidth(),
    ) {
        Column(modifier = Modifier.padding(horizontal = 16.dp, vertical = 14.dp)) {
            Text(
                stringResource(R.string.home_section_week_recap),
                style = MaterialTheme.typography.labelSmall,
                color = PandaSubtext,
                fontWeight = FontWeight.Bold,
            )
            Spacer(Modifier.height(10.dp))
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceEvenly) {
                // Séances
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        "${summary.totalSessions}",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.ExtraBold,
                        color = PandaPurple,
                    )
                    Text(stringResource(R.string.home_week_stat_sessions), style = MaterialTheme.typography.labelSmall, color = PandaSubtext)
                }

                Box(modifier = Modifier.height(32.dp).width(1.dp).background(PandaSubtext.copy(alpha = 0.20f)))

                // Distance cyclable (tap pour changer de sport)
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    modifier = Modifier.clickable { distIdx = (distIdx + 1) % distances.size },
                ) {
                    Text(
                        if (currentDist.km > 0) "${"%.1f".format(currentDist.km)} km" else "—",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.ExtraBold,
                        color = currentDist.color,
                    )
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(2.dp),
                    ) {
                        Text(currentDist.label, style = MaterialTheme.typography.labelSmall, color = PandaSubtext)
                        Icon(
                            Icons.Default.ChevronRight,
                            contentDescription = stringResource(R.string.home_change_sport_cd),
                            tint = PandaSubtext,
                            modifier = Modifier.size(12.dp),
                        )
                    }
                }

                Box(modifier = Modifier.height(32.dp).width(1.dp).background(PandaSubtext.copy(alpha = 0.20f)))

                // Durée
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        formatDuration(summary.totalDurationMinutes),
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.ExtraBold,
                        color = PandaBlue,
                    )
                    Text(stringResource(R.string.home_week_stat_duration), style = MaterialTheme.typography.labelSmall, color = PandaSubtext)
                }
            }

            // Badges sports actifs cette semaine
            if (activeBadges.isNotEmpty()) {
                Spacer(Modifier.height(10.dp))
                Box(modifier = Modifier.fillMaxWidth().height(0.5.dp).background(PandaSubtext.copy(alpha = 0.15f)))
                Spacer(Modifier.height(10.dp))
                Row(
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    modifier = Modifier.horizontalScroll(rememberScrollState()),
                ) {
                    activeBadges.forEach { (label, icon, color) ->
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(3.dp),
                            modifier = Modifier
                                .background(color.copy(alpha = 0.13f), RoundedCornerShape(20.dp))
                                .padding(horizontal = 8.dp, vertical = 4.dp),
                        ) {
                            Icon(icon, contentDescription = null, tint = color, modifier = Modifier.size(12.dp))
                            Text(label, style = MaterialTheme.typography.labelSmall, color = color, fontWeight = FontWeight.SemiBold)
                        }
                    }
                }
            }
        }
    }
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
        Icon(Icons.Default.PlayArrow, stringResource(R.string.home_resume_cd), tint = Color.White, modifier = Modifier.size(16.dp))
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
