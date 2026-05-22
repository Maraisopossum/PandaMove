package com.pandafit.designsystem.components

import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.pandafit.designsystem.theme.PandaOutline
import com.pandafit.designsystem.theme.PandaPurple
import com.pandafit.designsystem.theme.PandaPurpleLight
import com.pandafit.designsystem.theme.PandaRed
import com.pandafit.designsystem.theme.PandaRedLight
import com.pandafit.designsystem.theme.PandaSubtext
import com.pandafit.designsystem.theme.PandaWhite

// ══════════════════════════════════════════════════════════════════════════════
// APP BUTTON — Bouton pill unifié
// Hauteur 52dp, radius 14dp (compact) ou 50% (pill pleine)
// ══════════════════════════════════════════════════════════════════════════════

/** Bouton principal — fond plein, texte blanc */
@Composable
fun AppButton(
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    color: Color = PandaPurple,
    icon: ImageVector? = null,
    fullWidth: Boolean = false,
    pill: Boolean = false,
    enabled: Boolean = true,
) {
    val shape = if (pill) RoundedCornerShape(50) else RoundedCornerShape(14.dp)
    Button(
        onClick = onClick,
        enabled = enabled,
        shape = shape,
        colors = ButtonDefaults.buttonColors(containerColor = color, contentColor = PandaWhite),
        contentPadding = PaddingValues(horizontal = 20.dp, vertical = 0.dp),
        modifier = modifier
            .then(if (fullWidth) Modifier.fillMaxWidth() else Modifier)
            .height(52.dp),
    ) {
        if (icon != null) {
            Icon(icon, contentDescription = null, modifier = Modifier.size(18.dp))
            Spacer(Modifier.width(8.dp))
        }
        Text(label, style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.Bold)
    }
}

/** Bouton secondaire — fond clair, texte coloré */
@Composable
fun AppButtonSecondary(
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    color: Color = PandaPurple,
    icon: ImageVector? = null,
    fullWidth: Boolean = false,
) {
    Button(
        onClick = onClick,
        shape = RoundedCornerShape(14.dp),
        colors = ButtonDefaults.buttonColors(
            containerColor = PandaPurpleLight,
            contentColor   = color,
        ),
        contentPadding = PaddingValues(horizontal = 20.dp, vertical = 0.dp),
        modifier = modifier
            .then(if (fullWidth) Modifier.fillMaxWidth() else Modifier)
            .height(52.dp),
    ) {
        if (icon != null) {
            Icon(icon, contentDescription = null, modifier = Modifier.size(18.dp))
            Spacer(Modifier.width(8.dp))
        }
        Text(label, style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.Bold)
    }
}

/** Bouton fantôme — bordure, fond transparent */
@Composable
fun AppButtonGhost(
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    color: Color = PandaSubtext,
    icon: ImageVector? = null,
    small: Boolean = false,
) {
    OutlinedButton(
        onClick = onClick,
        shape = RoundedCornerShape(10.dp),
        colors = ButtonDefaults.outlinedButtonColors(contentColor = color),
        border = androidx.compose.foundation.BorderStroke(1.dp, PandaOutline),
        contentPadding = PaddingValues(horizontal = if (small) 12.dp else 20.dp, vertical = 0.dp),
        modifier = modifier.height(if (small) 36.dp else 44.dp),
    ) {
        if (icon != null) {
            Icon(icon, contentDescription = null, modifier = Modifier.size(if (small) 14.dp else 18.dp))
            Spacer(Modifier.width(6.dp))
        }
        Text(
            label,
            style = if (small) MaterialTheme.typography.labelSmall else MaterialTheme.typography.labelMedium,
            fontWeight = FontWeight.SemiBold,
        )
    }
}

/** Bouton danger — fond rouge clair, texte rouge */
@Composable
fun AppButtonDanger(
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    fullWidth: Boolean = false,
) {
    Button(
        onClick = onClick,
        shape = RoundedCornerShape(14.dp),
        colors = ButtonDefaults.buttonColors(containerColor = PandaRedLight, contentColor = PandaRed),
        contentPadding = PaddingValues(horizontal = 20.dp, vertical = 0.dp),
        modifier = modifier
            .then(if (fullWidth) Modifier.fillMaxWidth() else Modifier)
            .height(44.dp),
    ) {
        Text(label, style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.Bold)
    }
}

/** Bouton texte simple */
@Composable
fun AppTextButton(
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    color: Color = PandaPurple,
) {
    TextButton(onClick = onClick, modifier = modifier) {
        Text(label, style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.SemiBold, color = color)
    }
}
