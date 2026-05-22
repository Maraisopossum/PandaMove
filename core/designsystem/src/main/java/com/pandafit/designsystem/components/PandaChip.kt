package com.pandafit.designsystem.components

import androidx.compose.foundation.layout.size
import androidx.compose.material3.AssistChip
import androidx.compose.material3.AssistChipDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp

@Composable
fun PandaFilterChip(
    label: String,
    selected: Boolean,
    onSelectedChange: (Boolean) -> Unit,
    modifier: Modifier = Modifier,
    selectedColor: Color = MaterialTheme.colorScheme.primary,
    leadingIcon: ImageVector? = null,
) {
    FilterChip(
        selected = selected,
        onClick = { onSelectedChange(!selected) },
        label = { Text(text = label, style = MaterialTheme.typography.labelMedium) },
        modifier = modifier,
        leadingIcon = leadingIcon?.let {
            {
                Icon(
                    imageVector = it,
                    contentDescription = null,
                    modifier = Modifier.size(16.dp),
                )
            }
        },
        colors = FilterChipDefaults.filterChipColors(
            selectedContainerColor = selectedColor.copy(alpha = 0.15f),
            selectedLabelColor = selectedColor,
            selectedLeadingIconColor = selectedColor,
        ),
        border = FilterChipDefaults.filterChipBorder(
            enabled = true,
            selected = selected,
            selectedBorderColor = selectedColor,
            selectedBorderWidth = 1.5.dp,
        ),
    )
}

@Composable
fun PandaAssistChip(
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    leadingIcon: ImageVector? = null,
    containerColor: Color = MaterialTheme.colorScheme.surfaceVariant,
) {
    AssistChip(
        onClick = onClick,
        label = { Text(text = label, style = MaterialTheme.typography.labelMedium) },
        modifier = modifier,
        leadingIcon = leadingIcon?.let {
            {
                Icon(
                    imageVector = it,
                    contentDescription = null,
                    modifier = Modifier.size(16.dp),
                )
            }
        },
        colors = AssistChipDefaults.assistChipColors(
            containerColor = containerColor,
        ),
    )
}
