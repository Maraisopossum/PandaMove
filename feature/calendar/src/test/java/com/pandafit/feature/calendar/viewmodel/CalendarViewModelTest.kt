package com.pandafit.feature.calendar.viewmodel

import com.pandafit.core.database.catalog.UserPreferencesRepository
import com.pandafit.core.database.dao.BreathingSessionDao
import com.pandafit.core.database.dao.InstanceSeanceDao
import com.pandafit.core.database.dao.SeanceDao
import com.pandafit.core.database.dao.WorkoutDao
import com.pandafit.core.database.entities.WorkoutType
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class CalendarViewModelTest {

    private val dispatcher = StandardTestDispatcher()

    @Before
    fun setUp() {
        Dispatchers.setMain(dispatcher)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun buildViewModel(): CalendarViewModel {
        val workoutDao = mockk<WorkoutDao>(relaxed = true) {
            every { observeUpcoming(any(), any()) } returns flowOf(emptyList())
            every { observeByDateRange(any(), any()) } returns flowOf(emptyList())
            every { observeTemplatesByType(any()) } returns flowOf(emptyList())
        }
        val instanceSeanceDao = mockk<InstanceSeanceDao>(relaxed = true) {
            every { observeUpcoming(any(), any()) } returns flowOf(emptyList())
            every { observeByDateRange(any(), any()) } returns flowOf(emptyList())
        }
        val seanceDao = mockk<SeanceDao>(relaxed = true) {
            every { observeByCategory(any()) } returns flowOf(emptyList())
        }
        val breathingSessionDao = mockk<BreathingSessionDao>(relaxed = true) {
            every { observeByDateRange(any(), any()) } returns flowOf(emptyList())
        }
        val userPreferencesRepository = mockk<UserPreferencesRepository>(relaxed = true) {
            every { genderFlow } returns flowOf("female")
        }
        return CalendarViewModel(workoutDao, instanceSeanceDao, seanceDao, breathingSessionDao, userPreferencesRepository)
    }

    @Test
    fun `toggleFilter retire puis rajoute un type actif par defaut`() = runTest(dispatcher) {
        val viewModel = buildViewModel()
        dispatcher.scheduler.advanceUntilIdle()

        // Tous les filtres sont actifs par défaut.
        viewModel.toggleFilter(WorkoutType.RUNNING)
        assertEquals(WorkoutType.entries.toSet() - WorkoutType.RUNNING, viewModel.uiState.value.activeFilters)

        viewModel.toggleFilter(WorkoutType.RUNNING)
        assertEquals(WorkoutType.entries.toSet(), viewModel.uiState.value.activeFilters)
    }

    @Test
    fun `selectAllFilters selectionne tous les types`() = runTest(dispatcher) {
        val viewModel = buildViewModel()
        dispatcher.scheduler.advanceUntilIdle()

        viewModel.selectAllFilters()

        assertEquals(WorkoutType.entries.toSet(), viewModel.uiState.value.activeFilters)
    }
}
