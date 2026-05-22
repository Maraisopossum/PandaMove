package com.pandafit.designsystem.theme

import androidx.compose.ui.graphics.Color

// ══════════════════════════════════════════════════════════════════════════════
// PALETTE PRINCIPALE — PandaMove / PandaFit
// Source de vérité unique. Toutes les couleurs de l'app partent d'ici.
// ══════════════════════════════════════════════════════════════════════════════

// ── Violet — renforcement, navigation active, couleur primaire ────────────────
val PandaPurple          = Color(0xFF7C5CBF)
val PandaPurpleMid       = Color(0xFF9B7DD4)
val PandaPurpleLight     = Color(0xFFEDE8F7)
val PandaPurpleDark      = Color(0xFF5A3D9A)
val PandaPurpleContainer = Color(0xFFEDE8F7)

// Alias backward-compat (ancienne palette)
@Deprecated("Use PandaPurpleMid", ReplaceWith("PandaPurpleMid"))
val PandaPurpleLight_old = Color(0xFFAD87F9)
@Deprecated("Use PandaPurpleContainer", ReplaceWith("PandaPurpleContainer"))
val PandaPurpleContainer_old = Color(0xFFEDE4FE)

// ── Vert — running, complétion ────────────────────────────────────────────────
val PandaGreen           = Color(0xFF2E9E6B)
val PandaGreenMid        = Color(0xFF4CAF88)
val PandaGreenLight      = Color(0xFFE6F7F1)
val PandaGreenDark       = Color(0xFF1B6B46)
val PandaGreenContainer  = Color(0xFFE6F7F1)

// ── Rouge — actions critiques, bouton FINIR, erreurs ──────────────────────────
val PandaRed             = Color(0xFFE53935)
val PandaRedLight        = Color(0xFFFFEBEE)
val PandaRedDark         = Color(0xFFB71C1C)

// ── Orange — supersets, intervalles, calendrier ───────────────────────────────
val PandaOrange          = Color(0xFFE65100)
val PandaOrangeLight     = Color(0xFFFFF3E0)
val PandaOrangeBorder    = Color(0xFFFFCC80)
val PandaOrangeDark      = Color(0xFFBF360C)
val PandaOrangeContainer = Color(0xFFFFF3E0)

// Alias ancienne palette timer
@Deprecated("Use PandaOrange", ReplaceWith("PandaOrange"))
val PandaOrange_old = Color(0xFFF59E0B)

// ── Bleu — vélo, info ─────────────────────────────────────────────────────────
val PandaBlue            = Color(0xFF1565C0)
val PandaBlueLight       = Color(0xFFE3F2FD)
val PandaBlueDark        = Color(0xFF0D47A1)
val PandaBlueContainer   = Color(0xFFE3F2FD)

// ── Fond & surfaces ───────────────────────────────────────────────────────────
val PandaBackground      = Color(0xFFF4F4F7)   // Fond global clair
val PandaSurface         = Color(0xFFFFFFFF)   // Cartes, surfaces
val PandaSurfaceVariant  = Color(0xFFF0EFF6)   // Chips, hover, variante
val PandaOutline         = Color(0xFFE0E0E0)   // Bordures légères
val PandaOutlineVariant  = Color(0xFFCBCBCB)   // Bordures séparateurs

// ── Texte ─────────────────────────────────────────────────────────────────────
val PandaOnBackground    = Color(0xFF1A1A2E)   // Texte principal
val PandaOnSurface       = Color(0xFF1A1A2E)
val PandaSubtext         = Color(0xFF888888)   // Texte secondaire
val PandaSubtextLight    = Color(0xFFAAAAAA)   // Texte tertiaire

// ── Sidebar / Drawer navigation ───────────────────────────────────────────────
val PandaSidebar         = Color(0xFF1E2218)   // Fond drawer kalyptus sombre
val PandaSidebarHover    = Color(0xFF2A2F1E)   // Item hover drawer kalyptus

// ── Kalyptus — couleur chrome navigation (#969b7f) ────────────────────────────
val KalyptusGreen        = Color(0xFF969B7F)   // Primaire navigation
val KalyptusGreenDark    = Color(0xFF767B64)   // Header gradient haut
val KalyptusGreenDeep    = Color(0xFF5A5E4C)   // Accent profond
val KalyptusGreenMid     = Color(0xFFADB19C)   // Mi-ton
val KalyptusGreenLight   = Color(0xFFE8EBE0)   // Fond léger / tint
val KalyptusGreenContainer = Color(0xFFF0F2EB) // Fond très léger
val KalyptusSidebarActive  = Color(0xFF3A3F2C) // Item actif drawer

// ── Dark theme ────────────────────────────────────────────────────────────────
val PandaBackgroundDark      = Color(0xFF0F0F1A)
val PandaSurfaceDark         = Color(0xFF1A1A2E)
val PandaSurfaceVariantDark  = Color(0xFF252538)
val PandaOnBackgroundDark    = Color(0xFFF1F0FA)
val PandaOnSurfaceDark       = Color(0xFFF1F0FA)

// ── États système ─────────────────────────────────────────────────────────────
val PandaSuccess         = PandaGreen
val PandaError           = PandaRed
val PandaWarning         = PandaOrange
val PandaInfo            = PandaBlue

// ── Utilitaires ───────────────────────────────────────────────────────────────
val PandaWhite           = Color(0xFFFFFFFF)
val PandaBlack           = Color(0xFF1A1A2E)
