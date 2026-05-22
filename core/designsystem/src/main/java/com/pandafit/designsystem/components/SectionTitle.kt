package com.pandafit.designsystem.components

import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.pandafit.designsystem.theme.PandaPurple

/**
 * Titre de section standard — 15sp, 700, couleur accent.
 *
 * ```
 * SectionTitle("Séances planifiées")
 * SectionTitle("Running", color = PandaGreen, trailing = { Pill("5") })
 * ```
 */
@Composable
fun SectionTitle(
    title: String,
    modifier: Modifier = Modifier,
    color: Color = PandaPurple,
    trailing: (@Composable () -> Unit)? = null,
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = title,
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold,
            color = color,
            modifier = Modifier.weight(1f),
        )
        if (trailing != null) {
            Spacer(Modifier.width(8.dp))
            trailing()
        }
    }
}

/**
 * Variante compacte sans padding horizontal — à utiliser dans des Cards.
 */
@Composable
fun SectionTitleCompact(
    title: String,
    modifier: Modifier = Modifier,
    color: Color = MaterialTheme.colorScheme.onSurface,
) {
    Text(
        text = title,
        style = MaterialTheme.typography.labelMedium,
        fontWeight = FontWeight.Bold,
        color = color,
        letterSpacing = androidx.compose.ui.unit.TextUnit.Unspecified,
        modifier = modifier,
    )
}
