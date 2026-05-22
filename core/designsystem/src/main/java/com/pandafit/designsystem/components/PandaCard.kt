package com.pandafit.designsystem.components

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.spring
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedCard
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.pandafit.designsystem.theme.PandaOutline

@Composable
fun PandaCard(
    modifier: Modifier = Modifier,
    onClick: (() -> Unit)? = null,
    containerColor: Color = MaterialTheme.colorScheme.surface,
    elevation: Dp = 2.dp,
    content: @Composable ColumnScope.() -> Unit,
) {
    if (onClick != null) {
        Card(
            onClick = onClick,
            modifier = modifier,
            shape = MaterialTheme.shapes.large,
            colors = CardDefaults.cardColors(containerColor = containerColor),
            elevation = CardDefaults.cardElevation(defaultElevation = elevation),
            content = content,
        )
    } else {
        Card(
            modifier = modifier,
            shape = MaterialTheme.shapes.large,
            colors = CardDefaults.cardColors(containerColor = containerColor),
            elevation = CardDefaults.cardElevation(defaultElevation = elevation),
            content = content,
        )
    }
}

@Composable
fun PandaOutlinedCard(
    modifier: Modifier = Modifier,
    onClick: (() -> Unit)? = null,
    borderColor: Color = PandaOutline,
    containerColor: Color = MaterialTheme.colorScheme.surface,
    content: @Composable ColumnScope.() -> Unit,
) {
    if (onClick != null) {
        OutlinedCard(
            onClick = onClick,
            modifier = modifier,
            shape = MaterialTheme.shapes.large,
            colors = CardDefaults.cardColors(containerColor = containerColor),
            border = BorderStroke(1.dp, borderColor),
            content = content,
        )
    } else {
        OutlinedCard(
            modifier = modifier,
            shape = MaterialTheme.shapes.large,
            colors = CardDefaults.cardColors(containerColor = containerColor),
            border = BorderStroke(1.dp, borderColor),
            content = content,
        )
    }
}

/** Card colorée avec fond teinté — utilisée pour les modules running/vélo/renforcement */
@Composable
fun SportModuleCard(
    modifier: Modifier = Modifier,
    onClick: () -> Unit,
    accentColor: Color,
    isSelected: Boolean = false,
    content: @Composable ColumnScope.() -> Unit,
) {
    val borderColor by animateColorAsState(
        targetValue = if (isSelected) accentColor else Color.Transparent,
        animationSpec = spring(stiffness = Spring.StiffnessMedium),
        label = "border",
    )

    Card(
        onClick = onClick,
        modifier = modifier,
        shape = MaterialTheme.shapes.extraLarge,
        colors = CardDefaults.cardColors(
            containerColor = accentColor.copy(alpha = 0.08f),
        ),
        border = if (isSelected) BorderStroke(2.dp, borderColor) else null,
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
        content = content,
    )
}
