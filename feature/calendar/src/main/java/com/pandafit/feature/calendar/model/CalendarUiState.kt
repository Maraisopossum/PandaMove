package com.pandafit.feature.calendar.model

import com.pandafit.core.database.entities.BreathingSessionEntity
import com.pandafit.core.database.entities.InstanceSeanceEntity
import com.pandafit.core.database.entities.SeanceEntity
import com.pandafit.core.database.entities.WorkoutEntity
import com.pandafit.core.database.entities.WorkoutType
import java.time.LocalDate
import java.time.YearMonth

enum class CalendarViewMode { MONTH, WEEK, DAY }

/** Élément affiché dans la section "Prochaines séances" — unifie workouts et instances strength. */
sealed interface UpcomingItem {
    val date: LocalDate
    val isCompleted: Boolean

    data class Workout(val workout: WorkoutEntity) : UpcomingItem {
        override val date: LocalDate get() = workout.scheduledDate
        override val isCompleted: Boolean get() = workout.isCompleted
    }

    data class Instance(val instance: InstanceSeanceEntity, val seanceName: String) : UpcomingItem {
        override val date: LocalDate get() = instance.date
        override val isCompleted: Boolean get() = instance.isCompleted
    }
}

data class CalendarUiState(
    val isLoading: Boolean = true,
    val currentMonth: YearMonth = YearMonth.now(),
    val selectedDate: LocalDate = LocalDate.now(),
    val viewMode: CalendarViewMode = CalendarViewMode.MONTH,
    val workoutsByDate: Map<LocalDate, List<WorkoutEntity>> = emptyMap(),
    val selectedDayWorkouts: List<WorkoutEntity> = emptyList(),
    val instancesByDate: Map<LocalDate, List<InstanceSeanceEntity>> = emptyMap(),
    val selectedDayInstances: List<InstanceSeanceEntity> = emptyList(),
    val seancesById: Map<Long, SeanceEntity> = emptyMap(),
    val breathingSessionsByDate: Map<LocalDate, List<BreathingSessionEntity>> = emptyMap(),
    val selectedDayBreathingSessions: List<BreathingSessionEntity> = emptyList(),
    val availableSeances: List<SeanceEntity> = emptyList(),
    val availableRunningWorkouts: List<WorkoutEntity> = emptyList(),
    val availableCyclingWorkouts: List<WorkoutEntity> = emptyList(),
    val activeFilters: Set<WorkoutType> = WorkoutType.entries.toSet(),
    val showStrengthInstances: Boolean = true,
    val gender: String = "MALE",
    val upcomingItems: List<UpcomingItem> = emptyList(),
    val error: String? = null,
) {
    val filteredWorkoutsByDate: Map<LocalDate, List<WorkoutEntity>>
        get() = workoutsByDate.mapValues { (_, workouts) ->
            workouts.filter { it.workoutType in activeFilters }
        }.filter { it.value.isNotEmpty() }

    val filteredSelectedDayWorkouts: List<WorkoutEntity>
        get() = selectedDayWorkouts.filter { it.workoutType in activeFilters }

    val hasStrengthInstancesOnDate: (LocalDate) -> Boolean
        get() = { date -> instancesByDate[date]?.isNotEmpty() == true }
}
