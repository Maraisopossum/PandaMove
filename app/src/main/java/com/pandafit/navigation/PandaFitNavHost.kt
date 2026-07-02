package com.pandafit.navigation

import android.media.AudioManager
import android.media.ToneGenerator
import androidx.compose.animation.AnimatedContentTransitionScope
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.FitnessCenter
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Timer
import androidx.compose.material3.DrawerValue
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.rememberDrawerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.pandafit.core.database.entities.WorkoutType
import com.pandafit.designsystem.components.AppDrawerNav
import com.pandafit.designsystem.theme.KalyptusGreen
import com.pandafit.feature.profile.viewmodel.ProfileViewModel
import kotlinx.coroutines.flow.filterNotNull
import kotlinx.coroutines.launch
import com.pandafit.feature.calendar.ui.CalendarScreen
import com.pandafit.feature.cycling.ui.CyclingScreen
import com.pandafit.feature.cycling.ui.CyclingWorkoutDetailScreen
import com.pandafit.feature.cycling.ui.CyclingWorkoutReportScreen
import com.pandafit.feature.cycling.ui.CyclingWorkoutExecuteScreen
import com.pandafit.feature.home.ui.HomeScreen
import com.pandafit.feature.profile.ui.EquipmentScreen
import com.pandafit.feature.profile.ui.ExerciseCatalogScreen
import com.pandafit.feature.profile.ui.ProfileScreen
import com.pandafit.feature.profile.ui.TcxImportScreen
import com.pandafit.feature.running.ui.RunningScreen
import com.pandafit.feature.running.ui.RunningWorkoutDetailScreen
import com.pandafit.feature.running.ui.RunningWorkoutExecuteScreen
import com.pandafit.feature.running.ui.RunningWorkoutReportScreen
import com.pandafit.feature.stats.ui.StatsConfigScreen
import com.pandafit.feature.stats.ui.StatsScreen
import com.pandafit.feature.strength.ui.InstanceExecuteScreen
import com.pandafit.feature.strength.ui.InstanceReportScreen
import com.pandafit.feature.timer.ui.TimerScreen
import com.pandafit.core.database.entities.SeanceCategory
import com.pandafit.feature.strength.ui.SeanceCreateScreen
import com.pandafit.feature.strength.ui.SeanceDetailScreen
import com.pandafit.feature.strength.ui.SeanceListScreen
import com.pandafit.feature.breathing.ui.BreathingMethodCreateScreen
import com.pandafit.feature.hiking.ui.HikingScreen
import com.pandafit.feature.hiking.ui.HikingWorkoutDetailScreen
import com.pandafit.feature.hiking.ui.HikingWorkoutExecuteScreen
import com.pandafit.feature.hiking.ui.HikingWorkoutReportScreen
import com.pandafit.feature.breathing.ui.BreathingMethodSelectionScreen
import com.pandafit.feature.breathing.ui.BreathingSessionScreen
import com.pandafit.feature.warmup.ui.WarmupListScreen
import com.pandafit.viewmodel.ActiveSessionViewModel

private const val NAV_ANIM_DURATION = 300

@Composable
fun PandaFitNavHost() {
    val navController = rememberNavController()
    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentDestination = navBackStackEntry?.destination
    val activeSessionVM: ActiveSessionViewModel = hiltViewModel()
    val activeInstanceId by activeSessionVM.activeInstanceId.collectAsStateWithLifecycle()
    val activeSeanceName by activeSessionVM.activeSeanceName.collectAsStateWithLifecycle()
    val sessionSeconds by activeSessionVM.sessionSeconds.collectAsStateWithLifecycle()
    val restRemaining by activeSessionVM.restRemaining.collectAsStateWithLifecycle()

    val profileVM: ProfileViewModel = hiltViewModel()
    val profileState by profileVM.uiState.collectAsStateWithLifecycle()

    val drawerState = rememberDrawerState(DrawerValue.Closed)
    val scope = rememberCoroutineScope()

    val isOnExecuteScreen = currentDestination?.route?.startsWith("strength/instances/") == true
    val isOnHomeScreen = currentDestination?.route == PandaFitDestination.Home.route

    var homeScrollToTopKey by remember { androidx.compose.runtime.mutableStateOf(0) }
    LaunchedEffect(isOnHomeScreen) {
        if (isOnHomeScreen) homeScrollToTopKey++
    }

    // Sons depuis le manager singleton → fonctionnent partout dans l'app
    // Instances partagées — recréées uniquement si le stream change (paramètre "Sons en mode discret")
    val audioStream = if (profileState.soundOverrideSilent) AudioManager.STREAM_ALARM else AudioManager.STREAM_MUSIC
    val toneFinRest = remember(audioStream) { ToneGenerator(audioStream, ToneGenerator.MAX_VOLUME) }
    val toneBeep    = remember(audioStream) { ToneGenerator(audioStream, (ToneGenerator.MAX_VOLUME * 0.6).toInt()) }
    DisposableEffect(audioStream) {
        onDispose {
            runCatching { toneFinRest.release() }
            runCatching { toneBeep.release() }
        }
    }

    LaunchedEffect(audioStream) {
        activeSessionVM.restFinishedEvent.collect {
            runCatching { toneFinRest.startTone(ToneGenerator.TONE_CDMA_ALERT_CALL_GUARD, 1500) }
        }
    }
    LaunchedEffect(audioStream) {
        activeSessionVM.restCountdownBeep.collect {
            runCatching { toneBeep.startTone(ToneGenerator.TONE_PROP_BEEP, 120) }
        }
    }

    // Navigation depuis la notification (app en bg ou fermée)
    LaunchedEffect(Unit) {
        NavigationRouter.pendingRoute.filterNotNull().collect { route ->
            navController.navigate(route) { launchSingleTop = true }
            NavigationRouter.consume()
        }
    }

    val showBanner = activeInstanceId != null && !isOnExecuteScreen && !isOnHomeScreen

    val bannerContent: (@Composable () -> Unit)? = if (activeInstanceId != null && !isOnExecuteScreen) {
        {
            ActiveSessionBanner(
                seanceName = activeSeanceName ?: "Séance en cours",
                sessionSeconds = sessionSeconds,
                restRemaining = restRemaining,
                onClick = {
                    activeInstanceId?.let { id ->
                        navController.navigate(StrengthRoutes.instanceExecute(id)) {
                            launchSingleTop = true
                        }
                    }
                },
            )
        }
    } else null

    AppDrawerNav(
        drawerState = drawerState,
        currentRoute = currentDestination?.route ?: "home",
        onNavigate = { route ->
            navController.navigate(route) {
                popUpTo(navController.graph.findStartDestination().id) { saveState = true }
                launchSingleTop = true
                restoreState = false
            }
        },
        userName = profileState.userName,
        activeSessionBanner = if (showBanner) bannerContent else null,
        activeSessionDrawerBanner = bannerContent,
    ) {
        Scaffold(
            contentWindowInsets = WindowInsets(0.dp),
        ) { innerPadding ->
            NavHost(
            navController = navController,
            startDestination = PandaFitDestination.Home.route,
            modifier = Modifier.padding(innerPadding),
            enterTransition = {
                fadeIn(tween(NAV_ANIM_DURATION)) + slideIntoContainer(
                    AnimatedContentTransitionScope.SlideDirection.Start,
                    tween(NAV_ANIM_DURATION),
                    initialOffset = { (it * 0.15f).toInt() },
                )
            },
            exitTransition = {
                fadeOut(tween(NAV_ANIM_DURATION)) + slideOutOfContainer(
                    AnimatedContentTransitionScope.SlideDirection.Start,
                    tween(NAV_ANIM_DURATION),
                    targetOffset = { (it * 0.15f).toInt() },
                )
            },
            popEnterTransition = {
                fadeIn(tween(NAV_ANIM_DURATION)) + slideIntoContainer(
                    AnimatedContentTransitionScope.SlideDirection.End,
                    tween(NAV_ANIM_DURATION),
                    initialOffset = { (it * 0.15f).toInt() },
                )
            },
            popExitTransition = {
                fadeOut(tween(NAV_ANIM_DURATION)) + slideOutOfContainer(
                    AnimatedContentTransitionScope.SlideDirection.End,
                    tween(NAV_ANIM_DURATION),
                    targetOffset = { (it * 0.15f).toInt() },
                )
            },
        ) {
            // Home
            composable(PandaFitDestination.Home.route) {
                HomeScreen(
                    onNavigateToRunning = { navController.navigate(PandaFitDestination.Running.route) },
                    onNavigateToCycling = { navController.navigate(PandaFitDestination.Cycling.route) },
                    onNavigateToStrength = { navController.navigate(PandaFitDestination.Strength.route) },
                    onNavigateToCalendar = { navController.navigate(PandaFitDestination.Calendar.route) },
                    onNavigateToTimer = { navController.navigate(PandaFitDestination.Timer.route) },
                    onNavigateToStats = { navController.navigate(PandaFitDestination.Stats.route) },
                    onNavigateToProfile = { navController.navigate(PandaFitDestination.Profile.route) },
                    onNavigateToBreathing = { navController.navigate(BreathingRoutes.SELECT) },
                    onNavigateToHiking = { navController.navigate(HikingRoutes.LIST) },
                    onNavigateToWorkout = { type, id, isCompleted ->
                        when (type) {
                            "running" -> if (isCompleted) navController.navigate(RunningRoutes.detail(id))
                                         else navController.navigate(RunningRoutes.execute(id))
                            "cycling" -> if (isCompleted) navController.navigate(CyclingRoutes.report(id))
                                         else navController.navigate(CyclingRoutes.execute(id))
                            "strength" -> navController.navigate(StrengthRoutes.seanceDetail(id))
                            "hiking"   -> navController.navigate(HikingRoutes.report(id))
                        }
                    },
                    onNavigateToInstance = { id -> navController.navigate(StrengthRoutes.instanceExecute(id)) },
                    onNavigateToInstanceReport = { id -> navController.navigate(StrengthRoutes.instanceReport(id)) },
                    onOpenDrawer = { scope.launch { drawerState.open() } },
                    activeInstanceId = if (!isOnExecuteScreen) activeInstanceId else null,
                    activeSeanceName = activeSeanceName,
                    sessionSeconds = sessionSeconds,
                    restRemaining = restRemaining,
                    scrollToTopKey = homeScrollToTopKey,
                )
            }

            // Running
            composable(PandaFitDestination.Running.route) {
                RunningScreen(
                    onNavigateToDetail        = { id -> navController.navigate(RunningRoutes.detail(id)) },
                    onNavigateToExecute       = { id -> navController.navigate(RunningRoutes.execute(id)) },
                    onNavigateToCreate        = { navController.navigate(RunningRoutes.CREATE) },
                    onOpenDrawer = { scope.launch { drawerState.open() } },
                )
            }
            composable(RunningRoutes.CREATE) {
                RunningWorkoutDetailScreen(
                    workoutId = null,
                    onNavigateBack = { navController.popBackStack() },
                    onNavigateToExecute = { id -> navController.navigate(RunningRoutes.execute(id)) },
                )
            }
            composable(RunningRoutes.DETAIL) { backStack ->
                val id = backStack.arguments?.getString("workoutId")?.toLongOrNull() ?: return@composable
                RunningWorkoutReportScreen(
                    workoutId         = id,
                    onNavigateBack    = { navController.popBackStack() },
                    onNavigateToEdit  = { wId -> navController.navigate(RunningRoutes.edit(wId)) },
                    onNavigateToExecute = { wId -> navController.navigate(RunningRoutes.execute(wId)) },
                )
            }
            composable(RunningRoutes.EDIT) { backStack ->
                val id = backStack.arguments?.getString("workoutId")?.toLongOrNull()
                RunningWorkoutDetailScreen(
                    workoutId = id,
                    onNavigateBack = { navController.popBackStack() },
                    onNavigateToExecute = { wId -> navController.navigate(RunningRoutes.execute(wId)) },
                )
            }
            composable(RunningRoutes.EXECUTE) { backStack ->
                val id = backStack.arguments?.getString("workoutId")?.toLongOrNull() ?: return@composable
                RunningWorkoutExecuteScreen(
                    workoutId = id,
                    onNavigateBack = { navController.popBackStack() },
                    onNavigateToReport = { wId ->
                        navController.navigate(RunningRoutes.detail(wId)) {
                            popUpTo(RunningRoutes.EXECUTE) { inclusive = true }
                        }
                    },
                )
            }

            // Cycling
            composable(PandaFitDestination.Cycling.route) {
                CyclingScreen(
                    onNavigateToDetail        = { id -> navController.navigate(CyclingRoutes.detail(id)) },
                    onNavigateToReport        = { id -> navController.navigate(CyclingRoutes.report(id)) },
                    onNavigateToExecute       = { id -> navController.navigate(CyclingRoutes.execute(id)) },
                    onNavigateToCreate        = { navController.navigate(CyclingRoutes.CREATE) },
                    onNavigateToCreatePlanned = { navController.navigate(CyclingRoutes.CREATE_PLANNED) },
                    onOpenDrawer = { scope.launch { drawerState.open() } },
                )
            }
            composable(CyclingRoutes.CREATE) {
                CyclingWorkoutDetailScreen(workoutId = null, onNavigateBack = { navController.popBackStack() })
            }
            // Création directe d'une séance vélo planifiée (one-shot : isTemplate=false)
            composable(CyclingRoutes.CREATE_PLANNED) {
                CyclingWorkoutDetailScreen(workoutId = null, isPlanned = true, onNavigateBack = { navController.popBackStack() })
            }
            // Édition d'un workout vélo existant (template ou planned)
            composable(CyclingRoutes.DETAIL) { backStack ->
                val id = backStack.arguments?.getString("workoutId")?.toLongOrNull()
                CyclingWorkoutDetailScreen(workoutId = id, onNavigateBack = { navController.popBackStack() })
            }
            // Rapport lecture seule (planned + completed)
            composable(CyclingRoutes.REPORT) { backStack ->
                val id = backStack.arguments?.getString("workoutId")?.toLongOrNull() ?: return@composable
                CyclingWorkoutReportScreen(
                    workoutId         = id,
                    onNavigateBack    = { navController.popBackStack() },
                    onNavigateToEdit  = { wId -> navController.navigate(CyclingRoutes.detail(wId)) },
                    onNavigateToExecute = { wId -> navController.navigate(CyclingRoutes.execute(wId)) },
                )
            }
            // Saisie des résultats cycling
            composable(CyclingRoutes.EXECUTE) { backStack ->
                val id = backStack.arguments?.getString("workoutId")?.toLongOrNull() ?: return@composable
                CyclingWorkoutExecuteScreen(
                    workoutId = id,
                    onNavigateBack = { navController.popBackStack() },
                    onNavigateToReport = { wId ->
                        navController.navigate(CyclingRoutes.report(wId)) {
                            popUpTo(CyclingRoutes.EXECUTE) { inclusive = true }
                        }
                    },
                )
            }

            // Strength
            composable(PandaFitDestination.Strength.route) {
                SeanceListScreen(
                    onNavigateToDetail = { id -> navController.navigate(StrengthRoutes.seanceDetail(id)) },
                    onNavigateToCreate = { navController.navigate(StrengthRoutes.SEANCE_CREATE) },
                    onNavigateToInstance = { id -> navController.navigate(StrengthRoutes.instanceExecute(id)) },
                    onNavigateToInstanceReport = { id -> navController.navigate(StrengthRoutes.instanceReport(id)) },
                    onOpenDrawer = { scope.launch { drawerState.open() } },
                )
            }
            composable(StrengthRoutes.SEANCE_CREATE) {
                SeanceCreateScreen(
                    seanceId = null,
                    onNavigateBack = { navController.popBackStack() },
                    onSaved = { id ->
                        navController.navigate(StrengthRoutes.seanceDetail(id)) {
                            popUpTo(StrengthRoutes.SEANCE_CREATE) { inclusive = true }
                        }
                    },
                )
            }
            composable(StrengthRoutes.SEANCE_DETAIL) { backStack ->
                val id = backStack.arguments?.getString("seanceId")?.toLongOrNull() ?: return@composable
                SeanceDetailScreen(
                    seanceId = id,
                    onNavigateBack = { navController.popBackStack() },
                    onNavigateToEdit = { sid -> navController.navigate(StrengthRoutes.seanceEdit(sid)) },
                    onNavigateToInstance = { iid -> navController.navigate(StrengthRoutes.instanceExecute(iid)) },
                    onNavigateToInstanceReport = { iid -> navController.navigate(StrengthRoutes.instanceReport(iid)) },
                )
            }
            composable(StrengthRoutes.SEANCE_EDIT) { backStack ->
                val id = backStack.arguments?.getString("seanceId")?.toLongOrNull() ?: return@composable
                SeanceCreateScreen(
                    seanceId = id,
                    onNavigateBack = { navController.popBackStack() },
                    onSaved = { navController.popBackStack() },
                )
            }
            composable(StrengthRoutes.INSTANCE_EXECUTE) { backStack ->
                val id = backStack.arguments?.getString("instanceId")?.toLongOrNull() ?: return@composable
                InstanceExecuteScreen(
                    instanceId = id,
                    onNavigateBack = { navController.popBackStack() },
                    onNavigateToEditInstance = { seanceId, instanceId ->
                        navController.navigate(StrengthRoutes.seanceInstanceEdit(seanceId, instanceId))
                    },
                    onNavigateToReport = { navController.navigate(StrengthRoutes.instanceReport(id)) },
                    soundOverrideSilent = profileState.soundOverrideSilent,
                )
            }
            composable(StrengthRoutes.SEANCE_INSTANCE_EDIT) { backStack ->
                val seanceId = backStack.arguments?.getString("seanceId")?.toLongOrNull() ?: return@composable
                val instanceId = backStack.arguments?.getString("instanceId")?.toLongOrNull() ?: return@composable
                SeanceCreateScreen(
                    seanceId = seanceId,
                    instanceId = instanceId,
                    onNavigateBack = { navController.popBackStack() },
                    onSaved = { navController.popBackStack() },
                )
            }
            composable(StrengthRoutes.INSTANCE_REPORT) { backStack ->
                val id = backStack.arguments?.getString("instanceId")?.toLongOrNull() ?: return@composable
                InstanceReportScreen(
                    onNavigateBack = { navController.popBackStack() },
                    onFinish = {
                        navController.navigate(PandaFitDestination.Strength.route) {
                            popUpTo(PandaFitDestination.Strength.route) { inclusive = true }
                        }
                    },
                    onNavigateToEdit = {
                        navController.navigate(StrengthRoutes.instanceExecute(id))
                    },
                )
            }

            // Warmup
            composable(WarmupRoutes.LIST) {
                WarmupListScreen(
                    onNavigateToDetail = { id -> navController.navigate(WarmupRoutes.detail(id)) },
                    onNavigateToCreate = { cat -> navController.navigate(WarmupRoutes.create(cat)) },
                    onOpenDrawer = { scope.launch { drawerState.open() } },
                )
            }
            composable(WarmupRoutes.CREATE) { backStack ->
                val category = backStack.arguments?.getString("category") ?: SeanceCategory.WARMUP_GENERAL.name
                SeanceCreateScreen(
                    seanceId = null,
                    seanceCategoryOverride = category,
                    onNavigateBack = { navController.popBackStack() },
                    onSaved = { id ->
                        navController.navigate(WarmupRoutes.detail(id)) {
                            popUpTo(WarmupRoutes.CREATE) { inclusive = true }
                        }
                    },
                )
            }
            composable(WarmupRoutes.DETAIL) { backStack ->
                val id = backStack.arguments?.getString("seanceId")?.toLongOrNull() ?: return@composable
                SeanceDetailScreen(
                    seanceId = id,
                    onNavigateBack = { navController.popBackStack() },
                    onNavigateToEdit = { sid -> navController.navigate(WarmupRoutes.edit(sid)) },
                    onNavigateToInstance = { iid -> navController.navigate(StrengthRoutes.instanceExecute(iid)) },
                    onNavigateToInstanceReport = { iid -> navController.navigate(StrengthRoutes.instanceReport(iid)) },
                )
            }
            composable(WarmupRoutes.EDIT) { backStack ->
                val id = backStack.arguments?.getString("seanceId")?.toLongOrNull() ?: return@composable
                SeanceCreateScreen(
                    seanceId = id,
                    onNavigateBack = { navController.popBackStack() },
                    onSaved = { navController.popBackStack() },
                )
            }

            // Calendar
            composable(PandaFitDestination.Calendar.route) {
                CalendarScreen(
                    onNavigateToWorkout = { type, id, isCompleted ->
                        when (type) {
                            "running" -> if (isCompleted) navController.navigate(RunningRoutes.detail(id))
                                         else navController.navigate(RunningRoutes.execute(id))
                            "cycling" -> if (isCompleted) navController.navigate(CyclingRoutes.report(id))
                                         else navController.navigate(CyclingRoutes.execute(id))
                            "strength" -> navController.navigate(StrengthRoutes.seanceDetail(id))
                            "hiking"   -> navController.navigate(HikingRoutes.report(id))
                        }
                    },
                    onNavigateToInstance = { id -> navController.navigate(StrengthRoutes.instanceExecute(id)) },
                    onNavigateToInstanceReport = { id -> navController.navigate(StrengthRoutes.instanceReport(id)) },
                    onNavigateToCreateRunning = { navController.navigate(RunningRoutes.CREATE) },
                    onNavigateToCreateCycling = { navController.navigate(CyclingRoutes.CREATE) },
                    onOpenDrawer = { scope.launch { drawerState.open() } },
                )
            }

            composable(PandaFitDestination.Timer.route) {
                TimerScreen(
                    onOpenDrawer = { scope.launch { drawerState.open() } },
                    soundOverrideSilent = profileState.soundOverrideSilent,
                )
            }
            composable(PandaFitDestination.Stats.route) {
                StatsScreen(onOpenDrawer = { scope.launch { drawerState.open() } })
            }
            composable(PandaFitDestination.Profile.route) {
                ProfileScreen(
                    onNavigateToEquipment = { navController.navigate("profile/equipment") },
                    onNavigateToExerciseCatalog = { navController.navigate("profile/exercises") },
                    onNavigateToStatsConfig = { navController.navigate(ProfileRoutes.STATS_CONFIG) },
                    onNavigateToTcxImport = { navController.navigate(ProfileRoutes.TCX_IMPORT) },
                    onOpenDrawer = { scope.launch { drawerState.open() } },
                )
            }
            composable("profile/equipment") {
                EquipmentScreen(onNavigateBack = { navController.popBackStack() })
            }
            composable("profile/exercises") {
                ExerciseCatalogScreen(onNavigateBack = { navController.popBackStack() })
            }
            composable(ProfileRoutes.STATS_CONFIG) {
                StatsConfigScreen(onNavigateBack = { navController.popBackStack() })
            }
            composable(ProfileRoutes.TCX_IMPORT) {
                TcxImportScreen(
                    onNavigateBack = { navController.popBackStack() },
                    onNavigateToWorkout = { id, type ->
                        navController.popBackStack()
                        when (type) {
                            WorkoutType.RUNNING  -> navController.navigate(RunningRoutes.detail(id))
                            WorkoutType.CYCLING  -> navController.navigate(CyclingRoutes.report(id))
                            WorkoutType.HIKING   -> navController.navigate(HikingRoutes.report(id))
                            else                 -> { /* STRENGTH: pas de rapport TCX */ }
                        }
                    },
                )
            }

            // Hiking
            composable(HikingRoutes.LIST) {
                HikingScreen(
                    onNavigateToReport = { id -> navController.navigate(HikingRoutes.report(id)) },
                    onNavigateToEncode = { navController.navigate(HikingRoutes.ENCODE) },
                    onNavigateToExecute = { id -> navController.navigate(HikingRoutes.execute(id)) },
                    onOpenDrawer = { scope.launch { drawerState.open() } },
                )
            }
            composable(HikingRoutes.EXECUTE) { backStack ->
                val id = backStack.arguments?.getString("workoutId")?.toLongOrNull() ?: return@composable
                HikingWorkoutExecuteScreen(
                    workoutId = id,
                    onNavigateBack = { navController.popBackStack() },
                    onNavigateToReport = { wId ->
                        navController.navigate(HikingRoutes.report(wId)) {
                            popUpTo(HikingRoutes.EXECUTE) { inclusive = true }
                        }
                    },
                )
            }
            composable(HikingRoutes.ENCODE) {
                HikingWorkoutDetailScreen(
                    workoutId = null,
                    onNavigateBack = { navController.popBackStack() },
                    onSaved = { id ->
                        navController.navigate(HikingRoutes.report(id)) {
                            popUpTo(HikingRoutes.ENCODE) { inclusive = true }
                        }
                    },
                )
            }
            composable(HikingRoutes.REPORT) { backStack ->
                val id = backStack.arguments?.getString("workoutId")?.toLongOrNull() ?: return@composable
                HikingWorkoutReportScreen(
                    workoutId = id,
                    onNavigateBack = { navController.popBackStack() },
                    onNavigateToEdit = { wId -> navController.navigate(HikingRoutes.edit(wId)) },
                )
            }
            composable(HikingRoutes.EDIT) { backStack ->
                val id = backStack.arguments?.getString("workoutId")?.toLongOrNull() ?: return@composable
                HikingWorkoutDetailScreen(
                    workoutId = id,
                    onNavigateBack = { navController.popBackStack() },
                    onSaved = { navController.popBackStack() },
                )
            }

            // Breathing
            composable(BreathingRoutes.SELECT) {
                BreathingMethodSelectionScreen(
                    onMethodSelected = { methodId, cycles ->
                        navController.navigate(BreathingRoutes.session(methodId, cycles))
                    },
                    onCreateCustomMethod = { navController.navigate(BreathingRoutes.CREATE_CUSTOM) },
                    onEditCustomMethod   = { customId -> navController.navigate(BreathingRoutes.editCustom(customId)) },
                    onOpenDrawer = { scope.launch { drawerState.open() } },
                )
            }
            composable(BreathingRoutes.SESSION) { backStack ->
                val methodId = backStack.arguments?.getString("methodId") ?: return@composable
                val cycles   = backStack.arguments?.getString("cycles")?.toIntOrNull() ?: 1
                BreathingSessionScreen(
                    methodId       = methodId,
                    cycles         = cycles,
                    onNavigateBack = { navController.popBackStack() },
                )
            }
            composable(BreathingRoutes.CREATE_CUSTOM) {
                BreathingMethodCreateScreen(
                    customId       = null,
                    onNavigateBack = { navController.popBackStack() },
                )
            }
            composable(BreathingRoutes.EDIT_CUSTOM) { backStack ->
                val customId = backStack.arguments?.getString("customId")?.toLongOrNull()
                BreathingMethodCreateScreen(
                    customId       = customId,
                    onNavigateBack = { navController.popBackStack() },
                )
            }
        }
        }
    }
}

@Composable
private fun ActiveSessionBanner(
    seanceName: String,
    sessionSeconds: Int,
    restRemaining: Int,
    onClick: () -> Unit,
) {
    val sessionLabel = "${sessionSeconds / 60}:${(sessionSeconds % 60).toString().padStart(2, '0')}"
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(KalyptusGreen)
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 8.dp),
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

