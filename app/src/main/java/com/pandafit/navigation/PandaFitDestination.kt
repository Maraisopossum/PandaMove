package com.pandafit.navigation

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.DirectionsBike
import androidx.compose.material.icons.filled.DirectionsRun
import androidx.compose.material.icons.filled.FitnessCenter
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.BarChart
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.SelfImprovement
import androidx.compose.material.icons.filled.Timer
import androidx.compose.material.icons.outlined.CalendarMonth
import androidx.compose.material.icons.outlined.DirectionsBike
import androidx.compose.material.icons.outlined.DirectionsRun
import androidx.compose.material.icons.outlined.FitnessCenter
import androidx.compose.material.icons.outlined.Home
import androidx.compose.material.icons.outlined.BarChart
import androidx.compose.material.icons.outlined.Person
import androidx.compose.material.icons.outlined.Timer
import androidx.compose.ui.graphics.vector.ImageVector
import com.pandafit.core.database.entities.SeanceCategory

sealed class PandaFitDestination(
    val route: String,
    val label: String,
    val selectedIcon: ImageVector,
    val unselectedIcon: ImageVector,
) {
    data object Home : PandaFitDestination(
        route = "home",
        label = "Accueil",
        selectedIcon = Icons.Filled.Home,
        unselectedIcon = Icons.Outlined.Home,
    )

    data object Running : PandaFitDestination(
        route = "running",
        label = "Running",
        selectedIcon = Icons.Filled.DirectionsRun,
        unselectedIcon = Icons.Outlined.DirectionsRun,
    )

    data object Cycling : PandaFitDestination(
        route = "cycling",
        label = "Vélo",
        selectedIcon = Icons.Filled.DirectionsBike,
        unselectedIcon = Icons.Outlined.DirectionsBike,
    )

    data object Strength : PandaFitDestination(
        route = "strength",
        label = "Renfort",
        selectedIcon = Icons.Filled.FitnessCenter,
        unselectedIcon = Icons.Outlined.FitnessCenter,
    )

    data object Calendar : PandaFitDestination(
        route = "calendar",
        label = "Calendrier",
        selectedIcon = Icons.Filled.CalendarMonth,
        unselectedIcon = Icons.Outlined.CalendarMonth,
    )

    data object Timer : PandaFitDestination(
        route = "timer",
        label = "Minuteur",
        selectedIcon = Icons.Filled.Timer,
        unselectedIcon = Icons.Outlined.Timer,
    )

    data object Stats : PandaFitDestination(
        route = "stats",
        label = "Stats",
        selectedIcon = Icons.Filled.BarChart,
        unselectedIcon = Icons.Outlined.BarChart,
    )

    data object Profile : PandaFitDestination(
        route = "profile",
        label = "Profil",
        selectedIcon = Icons.Filled.Person,
        unselectedIcon = Icons.Outlined.Person,
    )

    data object Warmup : PandaFitDestination(
        route = "warmup",
        label = "Échauffement",
        selectedIcon = Icons.Filled.SelfImprovement,
        unselectedIcon = Icons.Filled.SelfImprovement,
    )
}

val TOP_LEVEL_DESTINATIONS = listOf(
    PandaFitDestination.Home,
    PandaFitDestination.Running,
    PandaFitDestination.Cycling,
    PandaFitDestination.Strength,
    PandaFitDestination.Timer,
    PandaFitDestination.Calendar,
    PandaFitDestination.Stats,
    PandaFitDestination.Profile,
)

// Routes imbriquées (detail screens)
object RunningRoutes {
    const val LIST   = "running"
    const val CREATE = "running/create"
    /** Crée directement une séance planifiée (isTemplate=false, isPlanned=true dans le VM). */
    const val CREATE_PLANNED = "running/create/planned"
    const val DETAIL = "running/{workoutId}"          // rapport lecture seule
    const val EDIT   = "running/{workoutId}/edit"     // formulaire modification
    const val EXECUTE = "running/{workoutId}/execute"

    fun detail(id: Long)  = "running/$id"
    fun edit(id: Long)    = "running/$id/edit"
    fun execute(id: Long) = "running/$id/execute"
}

object StrengthRoutes {
    const val LIST = "strength"
    const val CREATE = "strength/create"
    const val DETAIL = "strength/{workoutId}"
    const val EXECUTE = "strength/{workoutId}/execute"

    fun detail(id: Long) = "strength/$id"
    fun execute(id: Long) = "strength/$id/execute"

    // Séances génériques (templates)
    const val SEANCE_LIST = "strength"
    const val SEANCE_CREATE = "strength/seances/create"
    const val SEANCE_DETAIL = "strength/seances/{seanceId}"
    const val SEANCE_EDIT = "strength/seances/{seanceId}/edit"
    const val INSTANCE_EXECUTE = "strength/instances/{instanceId}"
    const val INSTANCE_REPORT  = "strength/instances/{instanceId}/report"

    fun seanceDetail(id: Long) = "strength/seances/$id"
    fun seanceEdit(id: Long) = "strength/seances/$id/edit"
    fun instanceExecute(id: Long) = "strength/instances/$id"
    fun instanceReport(id: Long)  = "strength/instances/$id/report"

    // Édition des exercices d'une instance spécifique (ne touche pas le template)
    const val SEANCE_INSTANCE_EDIT = "strength/seances/{seanceId}/instance-edit/{instanceId}"
    fun seanceInstanceEdit(seanceId: Long, instanceId: Long) = "strength/seances/$seanceId/instance-edit/$instanceId"
}

object WarmupRoutes {
    const val LIST = "warmup"
    const val CREATE = "warmup/create/{category}"
    const val DETAIL = "warmup/{seanceId}"
    const val EDIT = "warmup/{seanceId}/edit"
    fun create(category: String = SeanceCategory.WARMUP_GENERAL.name) = "warmup/create/$category"
    fun detail(id: Long) = "warmup/$id"
    fun edit(id: Long) = "warmup/$id/edit"
}

object CyclingRoutes {
    const val LIST = "cycling"
    const val CREATE = "cycling/create"
    /** Crée directement une séance planifiée (isTemplate=false, isPlanned=true dans le VM). */
    const val CREATE_PLANNED = "cycling/create/planned"
    const val DETAIL = "cycling/{workoutId}"

    fun detail(id: Long) = "cycling/$id"
}

object ProfileRoutes {
    const val STATS_CONFIG = "profile/stats-config"
}
