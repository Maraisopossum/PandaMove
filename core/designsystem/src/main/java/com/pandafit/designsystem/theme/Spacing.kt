package com.pandafit.designsystem.theme

import androidx.compose.runtime.compositionLocalOf
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

data class PandaFitSpacing(
    val xs: Dp = 4.dp,
    val sm: Dp = 8.dp,
    val md: Dp = 16.dp,
    val lg: Dp = 24.dp,
    val xl: Dp = 32.dp,
    val xxl: Dp = 48.dp,
    val screenPadding: Dp = 16.dp,
    val cardPadding: Dp = 16.dp,
    val sectionGap: Dp = 24.dp,
    val itemGap: Dp = 12.dp,
)

val LocalPandaFitSpacing = compositionLocalOf { PandaFitSpacing() }
