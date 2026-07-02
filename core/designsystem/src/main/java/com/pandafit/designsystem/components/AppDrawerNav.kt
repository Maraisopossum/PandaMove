package com.pandafit.designsystem.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Air
import androidx.compose.material.icons.filled.BarChart
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.DirectionsBike
import androidx.compose.material.icons.filled.DirectionsRun
import androidx.compose.material.icons.filled.FitnessCenter
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Landscape
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.SelfImprovement
import androidx.compose.material.icons.filled.Timer
import androidx.compose.material3.DrawerState
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalDrawerSheet
import androidx.compose.material3.ModalNavigationDrawer
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import com.pandafit.designsystem.theme.KalyptusGreen
import com.pandafit.designsystem.theme.KalyptusGreenLight
import com.pandafit.designsystem.theme.KalyptusGreenMid
import com.pandafit.designsystem.theme.PandaSidebar
import com.pandafit.designsystem.theme.PandaSidebarHover
import com.pandafit.designsystem.theme.PandaSubtext
import com.pandafit.designsystem.theme.PandaWhite
import kotlinx.coroutines.launch

/** Côté d'ouverture du menu hamburger — à une main pour droitiers (RIGHT) ou gauchers (LEFT). */
enum class DrawerSide { LEFT, RIGHT }

/** Côté courant du drawer, lu par [com.pandafit.designsystem.components.PandaTopBar] pour placer le bouton hamburger du même côté. */
val LocalDrawerSide = compositionLocalOf { DrawerSide.LEFT }

/** Fond du menu déployé — bleu marine foncé, texte blanc ExtraBold. */
private val DrawerNavyBackground = Color(0xFF03224C)

// ══════════════════════════════════════════════════════════════════════════════
// DONNÉES DU DRAWER
// ══════════════════════════════════════════════════════════════════════════════

data class DrawerNavItem(
    val id: String,
    val label: String,
    val icon: ImageVector,
)

val defaultDrawerItems = listOf(
    DrawerNavItem("home",      "Accueil",       Icons.Default.Home),
    DrawerNavItem("running",   "Running",       Icons.Default.DirectionsRun),
    DrawerNavItem("cycling",   "Vélo",          Icons.Default.DirectionsBike),
    DrawerNavItem("strength",  "Renforcement",  Icons.Default.FitnessCenter),
    DrawerNavItem("breathing", "Respiration",   Icons.Default.Air),
    DrawerNavItem("hiking",   "Randonnée",     Icons.Default.Landscape),
    // DrawerNavItem("warmup",    "Échauffement",  Icons.Default.SelfImprovement),  // TODO: masqué temporairement
    DrawerNavItem("timer",     "Minuteur",      Icons.Default.Timer),
    DrawerNavItem("calendar",  "Calendrier",    Icons.Default.CalendarMonth),
    DrawerNavItem("stats",     "Statistiques",  Icons.Default.BarChart),
    DrawerNavItem("profile",   "Profil",        Icons.Default.Person),
)

// ══════════════════════════════════════════════════════════════════════════════
// COMPOSANT PRINCIPAL
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Drawer navigation latéral (hamburger) sur fond sombre.
 *
 * Usage dans le NavHost :
 * ```kotlin
 * val drawerState = rememberDrawerState(DrawerValue.Closed)
 * AppDrawerNav(
 *     drawerState = drawerState,
 *     currentRoute = currentDestination?.route ?: "home",
 *     onNavigate = { route -> navController.navigate(route) },
 * ) {
 *     // contenu principal de l'écran
 *     NavHost(...)
 * }
 * ```
 */
@Composable
fun AppDrawerNav(
    drawerState: DrawerState,
    currentRoute: String,
    onNavigate: (String) -> Unit,
    userName: String = "Sportif PandaMove",
    userSubtitle: String = "",
    items: List<DrawerNavItem> = defaultDrawerItems,
    activeSessionBanner: (@Composable () -> Unit)? = null,
    activeSessionDrawerBanner: (@Composable () -> Unit)? = null,
    drawerSide: DrawerSide = DrawerSide.LEFT,
    content: @Composable () -> Unit,
) {
    val scope = rememberCoroutineScope()
    val baseLayoutDirection = LocalLayoutDirection.current

    // ModalNavigationDrawer s'ouvre toujours du bord "start" : on inverse la direction de mise en
    // page pour ouvrir à droite, puis on la restaure dans chaque slot pour ne pas retourner le contenu.
    val outerLayoutDirection = if (drawerSide == DrawerSide.RIGHT) {
        if (baseLayoutDirection == LayoutDirection.Ltr) LayoutDirection.Rtl else LayoutDirection.Ltr
    } else baseLayoutDirection

    CompositionLocalProvider(LocalLayoutDirection provides outerLayoutDirection) {
        ModalNavigationDrawer(
            drawerState = drawerState,
            drawerContent = {
                CompositionLocalProvider(LocalLayoutDirection provides baseLayoutDirection) {
                    ModalDrawerSheet(
                        drawerContainerColor = DrawerNavyBackground,
                        modifier = Modifier.width(260.dp),
                    ) {
                        DrawerContent(
                            currentRoute = currentRoute,
                            userName = userName,
                            userSubtitle = userSubtitle,
                            items = items,
                            activeSessionBanner = activeSessionDrawerBanner,
                            onNavigate = { route ->
                                onNavigate(route)
                                scope.launch { drawerState.close() }
                            },
                        )
                    }
                }
            },
        ) {
            CompositionLocalProvider(
                LocalLayoutDirection provides baseLayoutDirection,
                LocalDrawerSide provides drawerSide,
            ) {
                Box(modifier = Modifier.fillMaxSize()) {
                    content()
                    activeSessionBanner?.let { banner ->
                        Box(
                            modifier = Modifier
                                .align(Alignment.BottomCenter)
                                .fillMaxWidth()
                                .navigationBarsPadding(),
                        ) {
                            banner()
                        }
                    }
                }
            }
        }
    }
}

// ── Contenu interne du drawer ──────────────────────────────────────────────────

@Composable
private fun DrawerContent(
    currentRoute: String,
    userName: String,
    userSubtitle: String,
    items: List<DrawerNavItem>,
    activeSessionBanner: (@Composable () -> Unit)? = null,
    onNavigate: (String) -> Unit,
) {
    Column(modifier = Modifier.fillMaxHeight()) {
        // ── Logo PandaMove ──
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp, vertical = 24.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Box(
                modifier = Modifier
                    .size(36.dp)
                    .clip(RoundedCornerShape(10.dp))
                    .background(KalyptusGreen),
                contentAlignment = Alignment.Center,
            ) {
                Text("🐼", style = MaterialTheme.typography.titleMedium)
            }
            Column {
                Text(
                    "PandaMove",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.ExtraBold,
                    color = PandaWhite,
                )
                Text(
                    "Fitness Tracker",
                    style = MaterialTheme.typography.labelSmall,
                    color = PandaWhite.copy(alpha = 0.35f),
                )
            }
        }

        HorizontalDivider(color = PandaWhite.copy(alpha = 0.06f), thickness = 1.dp)

        // ── Bandeau séance active ──
        if (activeSessionBanner != null) {
            activeSessionBanner()
            HorizontalDivider(color = PandaWhite.copy(alpha = 0.06f), thickness = 1.dp)
        }

        Spacer(Modifier.height(12.dp))

        // ── Navigation items ──
        Column(
            modifier = Modifier
                .weight(1f)
                .padding(horizontal = 10.dp),
            verticalArrangement = Arrangement.spacedBy(2.dp),
        ) {
            items.forEach { item ->
                DrawerNavItem(
                    item = item,
                    isActive = currentRoute.startsWith(item.id),
                    onClick = { onNavigate(item.id) },
                )
            }
        }

        // ── Profil utilisateur (bas du drawer) ──
        HorizontalDivider(color = PandaWhite.copy(alpha = 0.06f), thickness = 1.dp)
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp)
                .clip(RoundedCornerShape(10.dp))
                .background(PandaWhite.copy(alpha = 0.05f))
                .padding(horizontal = 10.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            // Avatar initiale
            Box(
                modifier = Modifier
                    .size(32.dp)
                    .clip(RoundedCornerShape(16.dp))
                    .background(KalyptusGreen),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = userName.firstOrNull()?.uppercase() ?: "A",
                    style = MaterialTheme.typography.labelMedium,
                    fontWeight = FontWeight.Bold,
                    color = PandaWhite,
                )
            }
            Column(modifier = Modifier.weight(1f)) {
                Text(userName, style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.ExtraBold, color = PandaWhite)
                if (userSubtitle.isNotBlank()) {
                    Text(userSubtitle, style = MaterialTheme.typography.labelSmall, color = PandaWhite.copy(alpha = 0.4f))
                }
            }
        }
    }
}

// ── Item de navigation ─────────────────────────────────────────────────────────

@Composable
private fun DrawerNavItem(
    item: DrawerNavItem,
    isActive: Boolean,
    onClick: () -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(10.dp))
            .background(if (isActive) KalyptusGreen.copy(alpha = 0.25f) else Color.Transparent)
            .clickable(onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 9.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        // Bordure active verticale
        Box(
            modifier = Modifier
                .width(3.dp)
                .height(18.dp)
                .background(
                    if (isActive) KalyptusGreen else Color.Transparent,
                    RoundedCornerShape(2.dp),
                ),
        )
        Icon(
            item.icon,
            contentDescription = null,
            tint = if (isActive) KalyptusGreenMid else PandaWhite.copy(alpha = 0.4f),
            modifier = Modifier.size(17.dp),
        )
        Text(
            item.label,
            style = MaterialTheme.typography.bodyMedium,
            fontWeight = FontWeight.ExtraBold,
            color = if (isActive) PandaWhite else PandaWhite.copy(alpha = 0.7f),
        )
    }
}
