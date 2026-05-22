package com.pandafit.designsystem.theme

import androidx.compose.material3.Typography
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import com.pandafit.core.designsystem.R

// ══════════════════════════════════════════════════════════════════════════════
// TYPOGRAPHIE — DM Sans (principale) + Poppins (titres display) + Inter (corps)
// Spec : 22sp/800 titres écran · 15sp/700 sections · 13–14sp/400–600 corps
//        10–11sp/600–700 labels
// ══════════════════════════════════════════════════════════════════════════════

/** DM Sans — police principale de toute l'interface */
val DmSansFamily = FontFamily(
    Font(R.font.dmsans_regular,   FontWeight.Normal),
    Font(R.font.dmsans_medium,    FontWeight.Medium),
    Font(R.font.dmsans_semibold,  FontWeight.SemiBold),
    Font(R.font.dmsans_bold,      FontWeight.Bold),
    Font(R.font.dmsans_extrabold, FontWeight.ExtraBold),
)

/** Poppins — conservé pour les grands titres display */
val PoppinsFamily = FontFamily(
    Font(R.font.poppins_light,    FontWeight.Light),
    Font(R.font.poppins_regular,  FontWeight.Normal),
    Font(R.font.poppins_medium,   FontWeight.Medium),
    Font(R.font.poppins_semibold, FontWeight.SemiBold),
    Font(R.font.poppins_bold,     FontWeight.Bold),
)

/** Inter — conservé pour certains composants existants */
val InterFamily = FontFamily(
    Font(R.font.inter_regular,   FontWeight.Normal),
    Font(R.font.inter_medium,    FontWeight.Medium),
    Font(R.font.inter_semibold,  FontWeight.SemiBold),
    Font(R.font.inter_bold,      FontWeight.Bold),
)

val PandaFitTypography = Typography(
    // ── Display — Poppins pour les grands nombres/chronos ─────────────────────
    displayLarge = TextStyle(
        fontFamily = PoppinsFamily,
        fontWeight = FontWeight.Bold,
        fontSize = 57.sp,
        lineHeight = 64.sp,
        letterSpacing = (-0.25).sp,
    ),
    displayMedium = TextStyle(
        fontFamily = PoppinsFamily,
        fontWeight = FontWeight.Bold,
        fontSize = 45.sp,
        lineHeight = 52.sp,
    ),
    displaySmall = TextStyle(
        fontFamily = PoppinsFamily,
        fontWeight = FontWeight.SemiBold,
        fontSize = 36.sp,
        lineHeight = 44.sp,
    ),

    // ── Headline — Titres d'écran, DM Sans 800 ────────────────────────────────
    headlineLarge = TextStyle(
        fontFamily = DmSansFamily,
        fontWeight = FontWeight.ExtraBold,
        fontSize = 28.sp,
        lineHeight = 36.sp,
        letterSpacing = (-0.3).sp,
    ),
    headlineMedium = TextStyle(
        fontFamily = DmSansFamily,
        fontWeight = FontWeight.ExtraBold,
        fontSize = 22.sp,     // Titre d'écran principal
        lineHeight = 30.sp,
        letterSpacing = (-0.3).sp,
    ),
    headlineSmall = TextStyle(
        fontFamily = DmSansFamily,
        fontWeight = FontWeight.Bold,
        fontSize = 20.sp,
        lineHeight = 28.sp,
        letterSpacing = (-0.2).sp,
    ),

    // ── Title — Titres de section / cards ─────────────────────────────────────
    titleLarge = TextStyle(
        fontFamily = DmSansFamily,
        fontWeight = FontWeight.Bold,
        fontSize = 18.sp,
        lineHeight = 24.sp,
        letterSpacing = (-0.1).sp,
    ),
    titleMedium = TextStyle(
        fontFamily = DmSansFamily,
        fontWeight = FontWeight.SemiBold,
        fontSize = 15.sp,     // Titre de section (SectionTitle)
        lineHeight = 22.sp,
        letterSpacing = 0.sp,
    ),
    titleSmall = TextStyle(
        fontFamily = DmSansFamily,
        fontWeight = FontWeight.SemiBold,
        fontSize = 13.sp,
        lineHeight = 18.sp,
        letterSpacing = 0.sp,
    ),

    // ── Body — Corps de texte ──────────────────────────────────────────────────
    bodyLarge = TextStyle(
        fontFamily = DmSansFamily,
        fontWeight = FontWeight.Normal,
        fontSize = 15.sp,
        lineHeight = 22.sp,
        letterSpacing = 0.sp,
    ),
    bodyMedium = TextStyle(
        fontFamily = DmSansFamily,
        fontWeight = FontWeight.Normal,
        fontSize = 13.sp,
        lineHeight = 20.sp,
        letterSpacing = 0.sp,
    ),
    bodySmall = TextStyle(
        fontFamily = DmSansFamily,
        fontWeight = FontWeight.Normal,
        fontSize = 12.sp,
        lineHeight = 16.sp,
        letterSpacing = 0.sp,
    ),

    // ── Label — Chips, badges, métadonnées ────────────────────────────────────
    labelLarge = TextStyle(
        fontFamily = DmSansFamily,
        fontWeight = FontWeight.SemiBold,
        fontSize = 12.sp,
        lineHeight = 16.sp,
        letterSpacing = 0.2.sp,
    ),
    labelMedium = TextStyle(
        fontFamily = DmSansFamily,
        fontWeight = FontWeight.SemiBold,
        fontSize = 11.sp,
        lineHeight = 16.sp,
        letterSpacing = 0.3.sp,
    ),
    labelSmall = TextStyle(
        fontFamily = DmSansFamily,
        fontWeight = FontWeight.Medium,
        fontSize = 10.sp,
        lineHeight = 14.sp,
        letterSpacing = 0.4.sp,
    ),
)
