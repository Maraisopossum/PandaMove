package com.pandafit.feature.running.viewmodel

import org.junit.Assert.assertEquals
import org.junit.Test

class RunningExecuteViewModelTest {

    @Test
    fun `repPhaseLabel - bloc auto-lap affiche SPLIT`() {
        assertEquals("SPLIT 2/5", repPhaseLabel(repeatCount = 5, repIdx = 1, isAutoLap = true))
    }

    @Test
    fun `repPhaseLabel - bloc fractionné reel affiche INTERVALLE`() {
        assertEquals("INTERVALLE 2/5", repPhaseLabel(repeatCount = 5, repIdx = 1, isAutoLap = false))
    }
}
