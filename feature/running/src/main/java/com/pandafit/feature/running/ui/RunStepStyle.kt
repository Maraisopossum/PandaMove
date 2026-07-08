package com.pandafit.feature.running.ui

import androidx.compose.ui.graphics.Color
import com.pandafit.core.database.entities.RunStepType
import com.pandafit.designsystem.theme.PandaBlue
import com.pandafit.designsystem.theme.PandaGreen
import com.pandafit.designsystem.theme.PandaPurple
import com.pandafit.designsystem.theme.PandaRed
import com.pandafit.designsystem.theme.PandaSubtext
import com.pandafit.designsystem.theme.PandaSubtextLight

/**
 * Couleur d'un type d'étape running — partagée entre la programmation (création) et l'exécution
 * pour que la même étape s'affiche toujours dans la même teinte.
 */
fun runStepColor(type: RunStepType): Color = when (type) {
    RunStepType.WARMUP   -> PandaRed
    RunStepType.RUNNING  -> PandaBlue
    RunStepType.WALKING  -> PandaSubtext
    RunStepType.RECOVERY -> PandaGreen
    RunStepType.REST     -> PandaSubtextLight
    RunStepType.OTHER    -> PandaPurple
}
