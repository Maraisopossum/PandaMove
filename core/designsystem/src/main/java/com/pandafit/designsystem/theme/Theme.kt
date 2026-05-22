package com.pandafit.designsystem.theme

import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext

// ══════════════════════════════════════════════════════════════════════════════
// SCHÉMAS DE COULEURS M3
// Primary = Violet (navigation, actions principales)
// Secondary = Vert (running, succès)
// Tertiary = Bleu (vélo, info)
// ══════════════════════════════════════════════════════════════════════════════

private val LightColorScheme = lightColorScheme(
    // Violet — primaire
    primary                = PandaPurple,
    onPrimary              = PandaWhite,
    primaryContainer       = PandaPurpleContainer,
    onPrimaryContainer     = PandaPurpleDark,

    // Vert — running / succès
    secondary              = PandaGreen,
    onSecondary            = PandaWhite,
    secondaryContainer     = PandaGreenContainer,
    onSecondaryContainer   = PandaGreenDark,

    // Bleu — vélo / info
    tertiary               = PandaBlue,
    onTertiary             = PandaWhite,
    tertiaryContainer      = PandaBlueContainer,
    onTertiaryContainer    = PandaBlueDark,

    // Erreur — rouge
    error                  = PandaRed,
    onError                = PandaWhite,
    errorContainer         = PandaRedLight,
    onErrorContainer       = PandaRedDark,

    // Fond & surfaces
    background             = PandaBackground,
    onBackground           = PandaOnBackground,
    surface                = PandaSurface,
    onSurface              = PandaOnSurface,
    surfaceVariant         = PandaSurfaceVariant,
    onSurfaceVariant       = PandaSubtext,
    outline                = PandaOutline,
    outlineVariant         = PandaOutlineVariant,
)

private val DarkColorScheme = darkColorScheme(
    primary                = PandaPurpleMid,
    onPrimary              = PandaPurpleDark,
    primaryContainer       = PandaPurpleDark,
    onPrimaryContainer     = PandaPurpleContainer,

    secondary              = PandaGreenMid,
    onSecondary            = PandaGreenDark,
    secondaryContainer     = PandaGreenDark,
    onSecondaryContainer   = PandaGreenContainer,

    tertiary               = PandaBlue,
    onTertiary             = PandaBlueDark,
    tertiaryContainer      = PandaBlueDark,
    onTertiaryContainer    = PandaBlueContainer,

    error                  = PandaRed,
    onError                = PandaWhite,
    errorContainer         = PandaRedDark,
    onErrorContainer       = PandaRedLight,

    background             = PandaBackgroundDark,
    onBackground           = PandaOnBackgroundDark,
    surface                = PandaSurfaceDark,
    onSurface              = PandaOnSurfaceDark,
    surfaceVariant         = PandaSurfaceVariantDark,
    onSurfaceVariant       = PandaSubtextLight,
    outline                = Color(0xFF3A3A4A),
    outlineVariant         = Color(0xFF2E2E40),
)

// ══════════════════════════════════════════════════════════════════════════════
// COULEURS ÉTENDUES — par sport/section
// Accessibles via MaterialTheme.extendedColors.strength.primary etc.
// ══════════════════════════════════════════════════════════════════════════════

data class SportColors(
    val primary:   androidx.compose.ui.graphics.Color,
    val light:     androidx.compose.ui.graphics.Color,
    val dark:      androidx.compose.ui.graphics.Color,
    val container: androidx.compose.ui.graphics.Color,
)

data class PandaFitExtendedColors(
    val running:   SportColors,
    val cycling:   SportColors,
    val strength:  SportColors,
    val calendar:  SportColors,
    val superset:  SportColors,
)

private val defaultExtendedColors = PandaFitExtendedColors(
    running  = SportColors(PandaGreen,  PandaGreenLight,  PandaGreenDark,  PandaGreenContainer),
    cycling  = SportColors(PandaBlue,   PandaBlueLight,   PandaBlueDark,   PandaBlueContainer),
    strength = SportColors(PandaPurple, PandaPurpleLight, PandaPurpleDark, PandaPurpleContainer),
    calendar = SportColors(PandaOrange, PandaOrangeLight, PandaOrangeDark, PandaOrangeContainer),
    superset = SportColors(PandaOrange, PandaOrangeLight, PandaOrangeDark, PandaOrangeContainer),
)

val LocalPandaFitExtendedColors = staticCompositionLocalOf { defaultExtendedColors }

// ══════════════════════════════════════════════════════════════════════════════
// THEME COMPOSABLE
// ══════════════════════════════════════════════════════════════════════════════

@Composable
fun PandaFitTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    dynamicColor: Boolean = false,
    content: @Composable () -> Unit,
) {
    val colorScheme = when {
        dynamicColor && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S -> {
            val context = LocalContext.current
            if (darkTheme) dynamicDarkColorScheme(context) else dynamicLightColorScheme(context)
        }
        darkTheme -> DarkColorScheme
        else      -> LightColorScheme
    }

    CompositionLocalProvider(
        LocalPandaFitExtendedColors provides defaultExtendedColors,
    ) {
        MaterialTheme(
            colorScheme = colorScheme,
            typography  = PandaFitTypography,
            content     = content,
        )
    }
}

/** Accès rapide aux couleurs sport depuis n'importe quel composant Compose */
val MaterialTheme.extendedColors: PandaFitExtendedColors
    @Composable get() = LocalPandaFitExtendedColors.current
