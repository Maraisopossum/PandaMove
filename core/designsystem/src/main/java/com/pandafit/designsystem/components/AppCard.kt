package com.pandafit.designsystem.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.pandafit.designsystem.theme.PandaOutline
import com.pandafit.designsystem.theme.PandaSurface

/**
 * Carte de base PandaMove — fond blanc, bordure légère, radius 14dp, ombre douce.
 *
 * Usage :
 * ```
 * AppCard { Text("Contenu") }
 * AppCard(modifier = Modifier.fillMaxWidth(), onClick = { ... }) { ... }
 * ```
 */
@Composable
fun AppCard(
    modifier: Modifier = Modifier,
    containerColor: Color = PandaSurface,
    borderColor: Color = PandaOutline,
    elevation: Dp = 1.dp,
    innerPadding: Dp = 16.dp,
    onClick: (() -> Unit)? = null,
    content: @Composable ColumnScope.() -> Unit,
) {
    val shape = RoundedCornerShape(14.dp)
    Card(
        onClick = onClick ?: {},
        enabled = onClick != null,
        modifier = modifier,
        shape = shape,
        colors = CardDefaults.cardColors(containerColor = containerColor),
        elevation = CardDefaults.cardElevation(defaultElevation = elevation),
        border = BorderStroke(1.dp, borderColor),
    ) {
        Column(modifier = Modifier.padding(innerPadding)) {
            content()
        }
    }
}

/**
 * Variante sans padding interne — utile quand le contenu gère son propre padding
 * (ex. listes, headers de section).
 */
@Composable
fun AppCardRaw(
    modifier: Modifier = Modifier,
    containerColor: Color = PandaSurface,
    borderColor: Color = PandaOutline,
    elevation: Dp = 1.dp,
    onClick: (() -> Unit)? = null,
    content: @Composable ColumnScope.() -> Unit,
) {
    val shape = RoundedCornerShape(14.dp)
    Card(
        onClick = onClick ?: {},
        enabled = onClick != null,
        modifier = modifier,
        shape = shape,
        colors = CardDefaults.cardColors(containerColor = containerColor),
        elevation = CardDefaults.cardElevation(defaultElevation = elevation),
        border = BorderStroke(1.dp, borderColor),
    ) {
        Column { content() }
    }
}
