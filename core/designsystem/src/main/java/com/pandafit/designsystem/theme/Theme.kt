package com.pandafit.designsystem.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.staticCompositionLocalOf

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
    // Violet — primaire (inchangé, suffisamment contrasté sur fond sombre)
    primary                = PandaPurpleMid,
    onPrimary              = PandaBlack,
    primaryContainer       = PandaPurpleDark,
    onPrimaryContainer     = PandaPurpleLight,

    // Vert — running / succès
    secondary              = PandaGreenMid,
    onSecondary            = PandaBlack,
    secondaryContainer     = PandaGreenDark,
    onSecondaryContainer   = PandaGreenLight,

    // Bleu — vélo / info
    tertiary               = PandaBlue,
    onTertiary             = PandaWhite,
    tertiaryContainer      = PandaBlueDark,
    onTertiaryContainer    = PandaBlueLight,

    // Erreur — rouge
    error                  = PandaRed,
    onError                = PandaWhite,
    errorContainer         = PandaRedDark,
    onErrorContainer       = PandaRedLight,

    // Fond & surfaces
    background             = PandaBackgroundDark,
    onBackground           = PandaOnBackgroundDark,
    surface                = PandaSurfaceDark,
    onSurface              = PandaOnSurfaceDark,
    surfaceVariant         = PandaSurfaceVariantDark,
    onSurfaceVariant       = PandaSubtextLight,
    outline                = PandaOutlineVariant,
    outlineVariant         = PandaSurfaceVariantDark,
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
    darkTheme: Boolean = false,
    content: @Composable () -> Unit,
) {
    CompositionLocalProvider(
        LocalPandaFitExtendedColors provides defaultExtendedColors,
    ) {
        MaterialTheme(
            colorScheme = if (darkTheme) DarkColorScheme else LightColorScheme,
            typography  = PandaFitTypography,
            content     = content,
        )
    }
}

/** Accès rapide aux couleurs sport depuis n'importe quel composant Compose */
val MaterialTheme.extendedColors: PandaFitExtendedColors
    @Composable get() = LocalPandaFitExtendedColors.current
