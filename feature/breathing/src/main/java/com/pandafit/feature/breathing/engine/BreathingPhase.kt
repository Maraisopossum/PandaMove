package com.pandafit.feature.breathing.engine

import androidx.compose.ui.graphics.Color

enum class BreathingPhase(
    val label: String,
    val instruction: String,
    val colorArgb: Long,
) {
    INHALE(
        label = "Inspire",
        instruction = "Inspire lentement par le nez",
        colorArgb = 0xFF4FC3F7,
    ),
    HOLD_IN(
        label = "Retiens",
        instruction = "Retiens ta respiration",
        colorArgb = 0xFFCE93D8,
    ),
    EXHALE(
        label = "Expire",
        instruction = "Expire lentement par la bouche",
        colorArgb = 0xFF80CBC4,
    ),
    HOLD_OUT(
        label = "Pause",
        instruction = "Reste poumons vides",
        colorArgb = 0xFF546E7A,
    ),
}

val BreathingPhase.color: Color get() = Color(colorArgb)
