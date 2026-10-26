package com.pandafit.designsystem.components

import androidx.compose.foundation.background
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.unit.dp

/**
 * Carte de référence pour les modules sport (DESIGN.md — "bande gauche 4dp + fond teinté").
 * Source unique du pattern pour éviter la divergence entre écrans (bordures, badges ronds, etc.).
 */
@Composable
fun PandaSportCard(
    accentColor: Color,
    modifier: Modifier = Modifier,
    isSelected: Boolean = false,
    shape: Shape = MaterialTheme.shapes.large,
    contentPadding: PaddingValues = PaddingValues(start = 12.dp, top = 12.dp, end = 16.dp, bottom = 12.dp),
    onClick: (() -> Unit)? = null,
    onLongClick: (() -> Unit)? = null,
    content: @Composable RowScope.() -> Unit,
) {
    val tintAlpha = if (isSelected) 0.24f else 0.10f
    Surface(
        modifier = modifier
            .clip(shape)
            .then(
                if (onClick != null) {
                    Modifier.combinedClickable(onClick = onClick, onLongClick = onLongClick ?: {})
                } else {
                    Modifier
                },
            ),
        shape = shape,
        color = accentColor.copy(alpha = tintAlpha),
    ) {
        Row(modifier = Modifier.fillMaxWidth().height(IntrinsicSize.Min)) {
            Box(
                modifier = Modifier
                    .width(4.dp)
                    .fillMaxHeight()
                    .background(accentColor),
            )
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(contentPadding),
                content = content,
            )
        }
    }
}

/** Variante avec coins arrondis explicites (18.dp), utile quand le contexte n'a pas de forme dédiée. */
val PandaSportCardShape: Shape = RoundedCornerShape(16.dp)
