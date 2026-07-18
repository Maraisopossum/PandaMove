package com.pandafit.designsystem.components

import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Point
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.compose.ui.viewinterop.AndroidView
import com.pandafit.core.database.analysis.HeatmapData
import org.osmdroid.tileprovider.tilesource.TileSourceFactory
import org.osmdroid.util.BoundingBox
import org.osmdroid.util.GeoPoint
import org.osmdroid.views.MapView
import org.osmdroid.views.overlay.Overlay
import kotlin.math.sqrt

/**
 * Carte GPS interactive (zoom/pan) affichant [data] en lignes continues colorées par fréquence de
 * passage (bleu = peu fréquenté, rouge = très fréquenté, relatif au min/max de l'utilisateur) — pas
 * un semis de points : chaque tracé est dessiné comme une ligne (avec halo, esprit Strava), la
 * grille de fréquentation ([HeatmapData.grid]) ne servant qu'à choisir la couleur de chaque segment.
 *
 * [initialCenter] (lat, lon) : si fourni, la carte s'ouvre centrée là (position actuelle de
 * l'utilisateur) à [initialZoom] plutôt que cadrée sur l'étendue de tous les tracés — plus utile en
 * pratique qu'un cadrage qui peut dézoomer très loin si des sorties existent dans des villes très
 * éloignées. Le cadrage initial (l'un ou l'autre) n'est appliqué qu'une fois : les zooms/pans
 * suivants de l'utilisateur ne sont jamais réécrasés par une recomposition.
 *
 * Nécessite la permission INTERNET et l'initialisation de
 * `org.osmdroid.config.Configuration.getInstance().userAgentValue` dans l'Application (déjà fait
 * pour [GpsTrackMapCard]).
 */
@Composable
fun HeatmapMap(
    data: HeatmapData,
    modifier: Modifier = Modifier.fillMaxSize(),
    initialCenter: Pair<Double, Double>? = null,
    initialZoom: Double = 15.5,
) {
    if (data.tracks.isEmpty()) return

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

    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            when (event) {
                Lifecycle.Event.ON_RESUME -> mapView.onResume()
                Lifecycle.Event.ON_PAUSE  -> mapView.onPause()
                else                      -> Unit
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose {
            lifecycleOwner.lifecycle.removeObserver(observer)
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
            mv.overlays.add(HeatmapOverlay(data))

            if (!hasAppliedInitialCamera) {
                // Même parade anti-ANR que GpsTrackMapCard : zoomToBoundingBox/setCenter peuvent se
                // comporter de façon incohérente si la vue n'a pas encore de dimensions mesurées.
                fun applyInitialCamera() {
                    if (initialCenter != null) {
                        mv.controller.setZoom(initialZoom)
                        mv.controller.setCenter(GeoPoint(initialCenter.first, initialCenter.second))
                    } else {
                        val bounds = BoundingBox.fromGeoPoints(data.tracks.flatten().map { GeoPoint(it.first, it.second) })
                        mv.zoomToBoundingBox(bounds, false, 64)
                    }
                    mv.invalidate()
                    hasAppliedInitialCamera = true
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
            }
        },
    )
}

/**
 * Dessine chaque tracé comme une ligne continue (pas un semis de points par cellule) : pour chaque
 * segment, la couleur est choisie via [HeatmapData.grid] à son point médian — un double passage
 * (halo large peu opaque + trait fin plus opaque, esprit Strava) donne un rendu lissé plutôt qu'une
 * ligne à bord dur.
 */
private class HeatmapOverlay(private val data: HeatmapData) : Overlay() {
    private val glowPaint = Paint().apply {
        style = Paint.Style.STROKE
        isAntiAlias = true
        strokeCap = Paint.Cap.ROUND
        strokeJoin = Paint.Join.ROUND
        strokeWidth = 16f
    }
    private val corePaint = Paint().apply {
        style = Paint.Style.STROKE
        isAntiAlias = true
        strokeCap = Paint.Cap.ROUND
        strokeJoin = Paint.Join.ROUND
        strokeWidth = 6f
    }
    private val p1 = Point()
    private val p2 = Point()

    override fun draw(canvas: Canvas, mapView: MapView, shadow: Boolean) {
        if (shadow) return
        val projection = mapView.projection
        val grid = data.grid

        data.tracks.forEach { track ->
            for (i in 0 until track.size - 1) {
                val (lat1, lon1) = track[i]
                val (lat2, lon2) = track[i + 1]
                val midLat = (lat1 + lat2) / 2.0
                val midLon = (lon1 + lon2) / 2.0

                // Racine carrée : sans elle, une poignée de segments extrêmes écrase le dégradé et
                // presque tout le reste retombe au bleu — l'easing étale la lecture visuelle.
                val t = sqrt(
                    ((grid.countAt(midLat, midLon) - grid.minCount).toFloat() / (grid.maxCount - grid.minCount).toFloat())
                        .coerceIn(0f, 1f),
                )
                val color = heatmapColor(t)

                projection.toPixels(GeoPoint(lat1, lon1), p1)
                projection.toPixels(GeoPoint(lat2, lon2), p2)

                glowPaint.color = color.copy(alpha = 0.20f).toArgb()
                canvas.drawLine(p1.x.toFloat(), p1.y.toFloat(), p2.x.toFloat(), p2.y.toFloat(), glowPaint)
                corePaint.color = color.copy(alpha = 0.90f).toArgb()
                canvas.drawLine(p1.x.toFloat(), p1.y.toFloat(), p2.x.toFloat(), p2.y.toFloat(), corePaint)
            }
        }
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
