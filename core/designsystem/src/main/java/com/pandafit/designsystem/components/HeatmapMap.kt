package com.pandafit.designsystem.components

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Point
import android.graphics.Rect
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.compose.ui.viewinterop.AndroidView
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.FlowPreview
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.debounce
import kotlinx.coroutines.withContext
import org.osmdroid.events.MapListener
import org.osmdroid.events.ScrollEvent
import org.osmdroid.events.ZoomEvent
import org.osmdroid.tileprovider.tilesource.TileSourceFactory
import org.osmdroid.util.BoundingBox
import org.osmdroid.util.GeoPoint
import org.osmdroid.views.MapView
import org.osmdroid.views.overlay.Overlay
import kotlin.math.cos
import kotlin.math.exp
import kotlin.math.min
import kotlin.math.sqrt

/**
 * Carte GPS interactive (zoom/pan) affichant [points] en vraie heatmap de densité (flou gaussien,
 * bleu → rouge du moins au plus fréquenté, relatif au propre historique de l'utilisateur) sur un
 * fond de carte sombre — esprit Strava, pas un semis de points ni une grille de cellules à bord dur.
 *
 * Le calque densité est recalculé pour la zone actuellement visible (pas une fois pour toutes les
 * données) : un seul rendu figé sur toute l'étendue des points serait soit un magma flou informe
 * une fois zoomé sur une petite partie (résolution insuffisante), soit illisible dézoomé sur des
 * sorties très éloignées entre elles. Le recalcul est débattu de ~350ms après la fin d'un geste de
 * zoom/pan (jamais à chaque frame), fait hors thread principal, et ne considère que les points de la
 * zone visible (+ marge) — borné en coût même avec un historique GPS chargé.
 *
 * [initialCenter] (lat, lon) : si fourni, la carte s'ouvre centrée là (position actuelle de
 * l'utilisateur) à [initialZoom] plutôt que cadrée sur l'étendue de tous les points — plus utile en
 * pratique qu'un cadrage qui peut dézoomer très loin si des sorties existent dans des villes très
 * éloignées. Le cadrage initial (l'un ou l'autre) n'est appliqué qu'une fois : les zooms/pans
 * suivants de l'utilisateur ne sont jamais réécrasés par une recomposition.
 *
 * Nécessite la permission INTERNET et l'initialisation de
 * `org.osmdroid.config.Configuration.getInstance().userAgentValue` dans l'Application (déjà fait
 * pour [GpsTrackMapCard]).
 */
@OptIn(FlowPreview::class)
@Composable
fun HeatmapMap(
    points: List<Pair<Double, Double>>,
    modifier: Modifier = Modifier.fillMaxSize(),
    initialCenter: Pair<Double, Double>? = null,
    initialZoom: Double = 15.5,
) {
    if (points.size < 2) return

    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current

    val mapView = remember {
        MapView(context).apply {
            setTileSource(TileSourceFactory.MAPNIK)
            setMultiTouchControls(true)
        }
    }
    // Empêche toute recomposition ultérieure de recadrer la carte et d'annuler un zoom/pan déjà
    // fait par l'utilisateur — le cadrage initial n'a droit qu'à un seul passage.
    var hasAppliedInitialCamera by remember { mutableStateOf(false) }
    var heatmapLayer by remember { mutableStateOf<HeatmapLayer?>(null) }
    // Un simple compteur suffit : seul le "tick" compte, pas sa valeur — déclenche le debounce ci-dessous.
    val recomputeTrigger = remember { MutableStateFlow(0L) }

    LaunchedEffect(mapView, points) {
        recomputeTrigger.debounce(350).collect {
            val bbox = mapView.boundingBox ?: return@collect
            if (mapView.width <= 0 || mapView.height <= 0) return@collect
            val layer = withContext(Dispatchers.Default) {
                buildHeatmapLayer(points, bbox, mapView.width, mapView.height)
            }
            heatmapLayer = layer
        }
    }

    DisposableEffect(mapView, lifecycleOwner) {
        val lifecycleObserver = LifecycleEventObserver { _, event ->
            when (event) {
                Lifecycle.Event.ON_RESUME -> mapView.onResume()
                Lifecycle.Event.ON_PAUSE  -> mapView.onPause()
                else                      -> Unit
            }
        }
        lifecycleOwner.lifecycle.addObserver(lifecycleObserver)

        val mapListener = object : MapListener {
            override fun onScroll(event: ScrollEvent?): Boolean {
                recomputeTrigger.value = System.currentTimeMillis()
                return false
            }
            override fun onZoom(event: ZoomEvent?): Boolean {
                recomputeTrigger.value = System.currentTimeMillis()
                return false
            }
        }
        mapView.addMapListener(mapListener)

        onDispose {
            lifecycleOwner.lifecycle.removeObserver(lifecycleObserver)
            mapView.removeMapListener(mapListener)
            mapView.onDetach()
        }
    }

    AndroidView(
        factory = { mapView },
        // clipToBounds : sans lui, cette AndroidView (rendu Canvas natif, pas du Compose pur) peut
        // continuer à peindre au-delà des limites que lui donne le modifier appelant (ex. sous la
        // barre du haut ou par-dessus le bandeau de séance active en bas) au lieu de s'arrêter à sa
        // zone allouée.
        modifier = modifier.clipToBounds(),
        update = { mv ->
            mv.overlays.clear()
            heatmapLayer?.let { mv.overlays.add(DensityHeatmapOverlay(it)) }

            if (!hasAppliedInitialCamera) {
                // Même parade anti-ANR que GpsTrackMapCard : zoomToBoundingBox/setCenter peuvent se
                // comporter de façon incohérente si la vue n'a pas encore de dimensions mesurées.
                fun applyInitialCamera() {
                    if (initialCenter != null) {
                        mv.controller.setZoom(initialZoom)
                        mv.controller.setCenter(GeoPoint(initialCenter.first, initialCenter.second))
                    } else {
                        val bounds = BoundingBox.fromGeoPoints(points.map { GeoPoint(it.first, it.second) })
                        mv.zoomToBoundingBox(bounds, false, 64)
                    }
                    mv.invalidate()
                    hasAppliedInitialCamera = true
                    // Premier calcul du calque densité, une fois la caméra initiale posée.
                    recomputeTrigger.value = System.currentTimeMillis()
                }
                if (mv.width > 0 && mv.height > 0) {
                    mv.post { applyInitialCamera() }
                } else {
                    mv.addOnLayoutChangeListener(object : android.view.View.OnLayoutChangeListener {
                        override fun onLayoutChange(
                            v: android.view.View?, left: Int, top: Int, right: Int, bottom: Int,
                            oldLeft: Int, oldTop: Int, oldRight: Int, oldBottom: Int,
                        ) {
                            if (right - left > 0 && bottom - top > 0) {
                                mv.removeOnLayoutChangeListener(this)
                                applyInitialCamera()
                            }
                        }
                    })
                }
            } else {
                mv.invalidate()
            }
        },
    )
}

// ── Construction du calque densité (hors thread principal) ───────────────────────────────────────

private const val METERS_PER_DEGREE_LAT = 111_320.0
private const val BITMAP_MAX_DIMENSION = 900

/** Bitmap colorisé + zone géographique qu'il couvre — plaqué sur la carte par [DensityHeatmapOverlay]. */
private class HeatmapLayer(val bitmap: Bitmap, val bounds: BoundingBox)

/**
 * Rasterise la densité des points tombant dans [viewBounds] (+ marge, pour amortir un léger pan
 * avant le prochain recalcul) à une résolution proche de la taille d'écran [viewportW]x[viewportH]
 * — jamais la totalité de l'historique sur une résolution fixe, qui deviendrait soit un magma flou
 * une fois zoomé soit illisible dézoomé (cf. doc de [HeatmapMap]).
 *
 * Empreinte gaussienne par point dans un tampon de flottants (pas de saturation prématurée), puis
 * colorisation via une table de correspondance à 256 entrées (bleu→rouge) — le dégradé n'est calculé
 * qu'une fois par palier, jamais par pixel.
 */
private fun buildHeatmapLayer(
    allPoints: List<Pair<Double, Double>>,
    viewBounds: BoundingBox,
    viewportW: Int,
    viewportH: Int,
): HeatmapLayer? {
    val latPad = (viewBounds.latNorth - viewBounds.latSouth) * 0.25
    val lonPad = (viewBounds.lonEast - viewBounds.lonWest) * 0.25
    val north = viewBounds.latNorth + latPad
    val south = viewBounds.latSouth - latPad
    val east = viewBounds.lonEast + lonPad
    val west = viewBounds.lonWest - lonPad

    val points = allPoints.filter { (lat, lon) -> lat in south..north && lon in west..east }
    if (points.size < 2) return null

    val refLat = (north + south) / 2.0
    val latSpanM = (north - south) * METERS_PER_DEGREE_LAT
    val lonSpanM = (east - west) * METERS_PER_DEGREE_LAT * cos(Math.toRadians(refLat)).coerceAtLeast(0.01)
    val aspect = (lonSpanM / latSpanM.coerceAtLeast(1.0)).coerceIn(0.2, 5.0)

    // Résolution calée sur la taille d'écran réelle (plafonnée) plutôt que sur l'étendue
    // géographique — la netteté ne dépend plus du zoom courant.
    val targetDim = min(BITMAP_MAX_DIMENSION, min(viewportW, viewportH).takeIf { it > 0 } ?: BITMAP_MAX_DIMENSION)
    val w: Int
    val h: Int
    if (aspect >= 1.0) {
        w = targetDim
        h = (w / aspect).toInt().coerceAtLeast(64)
    } else {
        h = targetDim
        w = (h * aspect).toInt().coerceAtLeast(64)
    }

    // Rayon relatif à la taille du calque (~1.6% du plus petit côté) — une empreinte GPS représente
    // toujours à peu près la même fraction de l'écran, quel que soit le niveau de zoom, puisque le
    // calque est justement recalculé pour matcher le zoom courant. Volontairement fin : une bande
    // large masque le tracé réel des rues sous un magma flou.
    val radiusPx = (min(w, h) * 0.016f).coerceIn(3f, 16f)
    val sigma = radiusPx / 2f

    val density = FloatArray(w * h)
    points.forEach { (lat, lon) ->
        val cx = ((lon - west) / (east - west) * w).toFloat()
        val cy = ((north - lat) / (north - south) * h).toFloat()
        val minX = (cx - radiusPx).toInt().coerceIn(0, w - 1)
        val maxX = (cx + radiusPx).toInt().coerceIn(0, w - 1)
        val minY = (cy - radiusPx).toInt().coerceIn(0, h - 1)
        val maxY = (cy + radiusPx).toInt().coerceIn(0, h - 1)
        for (y in minY..maxY) {
            val dy = y - cy
            val rowOffset = y * w
            for (x in minX..maxX) {
                val dx = x - cx
                val distSq = dx * dx + dy * dy
                if (distSq <= radiusPx * radiusPx) {
                    density[rowOffset + x] += exp(-distSq / (2f * sigma * sigma))
                }
            }
        }
    }

    val maxDensity = density.max().coerceAtLeast(0.0001f)
    // LUT 257 entrées (0..256 inclus) : le dégradé n'est calculé qu'une fois par palier, jamais par
    // pixel — indispensable pour rester rapide sur un Bitmap de plusieurs centaines de milliers de pixels.
    val colorLut = IntArray(257) { i ->
        // Racine carrée : sans elle, une poignée de zones extrêmes écrase le dégradé et presque
        // tout le reste retombe au bleu — l'easing étale la lecture visuelle.
        val eased = sqrt(i / 256f)
        if (eased <= 0.04f) {
            0 // transparent : pas de halo visible loin de tout point réel
        } else {
            val c = heatmapColor(eased)
            val alpha = (40 + eased * 150f).toInt().coerceIn(0, 190)
            (alpha shl 24) or ((c.red * 255).toInt() shl 16) or ((c.green * 255).toInt() shl 8) or (c.blue * 255).toInt()
        }
    }

    val pixels = IntArray(w * h)
    for (i in pixels.indices) {
        val t = (density[i] / maxDensity).coerceIn(0f, 1f)
        pixels[i] = colorLut[(t * 256).toInt().coerceIn(0, 256)]
    }

    val bitmap = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
    bitmap.setPixels(pixels, 0, w, 0, 0, w, h)
    return HeatmapLayer(bitmap, BoundingBox(north, east, south, west))
}

/** Plaque le Bitmap densité précalculé sur la carte, repositionné/redimensionné via la projection à chaque frame — jamais recalculé pendant un simple pan/zoom (cf. debounce dans [HeatmapMap]). */
private class DensityHeatmapOverlay(private val layer: HeatmapLayer) : Overlay() {
    private val paint = Paint().apply { isAntiAlias = true; isFilterBitmap = true }
    private val topLeft = Point()
    private val bottomRight = Point()

    override fun draw(canvas: Canvas, mapView: MapView, shadow: Boolean) {
        if (shadow) return
        val projection = mapView.projection
        projection.toPixels(GeoPoint(layer.bounds.latNorth, layer.bounds.lonWest), topLeft)
        projection.toPixels(GeoPoint(layer.bounds.latSouth, layer.bounds.lonEast), bottomRight)
        canvas.drawBitmap(
            layer.bitmap,
            null,
            Rect(topLeft.x, topLeft.y, bottomRight.x, bottomRight.y),
            paint,
        )
    }
}

private val HEATMAP_STOPS = listOf(
    0.00f to Color(0xFF2962FF), // bleu — peu fréquenté
    0.25f to Color(0xFF00BCD4), // cyan
    0.50f to Color(0xFF4CAF50), // vert
    0.75f to Color(0xFFFFEB3B), // jaune
    1.00f to Color(0xFFF44336), // rouge — très fréquenté
)

private fun heatmapColor(t: Float): Color {
    val clamped = t.coerceIn(0f, 1f)
    for (i in 0 until HEATMAP_STOPS.size - 1) {
        val (t0, c0) = HEATMAP_STOPS[i]
        val (t1, c1) = HEATMAP_STOPS[i + 1]
        if (clamped in t0..t1) {
            val localT = if (t1 > t0) (clamped - t0) / (t1 - t0) else 0f
            return lerp(c0, c1, localT)
        }
    }
    return HEATMAP_STOPS.last().second
}
