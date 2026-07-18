package com.pandafit.designsystem.components

import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Point
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.compose.ui.viewinterop.AndroidView
import com.pandafit.core.database.analysis.HeatmapCell
import org.osmdroid.tileprovider.tilesource.TileSourceFactory
import org.osmdroid.util.BoundingBox
import org.osmdroid.util.GeoPoint
import org.osmdroid.views.MapView
import org.osmdroid.views.overlay.Overlay
import kotlin.math.cos
import kotlin.math.sqrt

/**
 * Carte GPS interactive (zoom/pan) affichant [cells] en dégradé de couleur (bleu = peu fréquenté,
 * rouge = très fréquenté, relatif au min/max du jeu de cellules passé) — heatmap globale toutes
 * séances GPS confondues (cf. [com.pandafit.core.database.analysis.computeHeatmapCells]).
 *
 * Les cellules sont dessinées directement via la projection de la carte à chaque frame (pas une image
 * pré-rasterisée) : elles restent à la bonne taille géographique quel que soit le niveau de zoom sans
 * recalcul de la grille.
 *
 * Nécessite la permission INTERNET et l'initialisation de
 * `org.osmdroid.config.Configuration.getInstance().userAgentValue` dans l'Application (déjà fait
 * pour [GpsTrackMapCard]).
 */
@Composable
fun HeatmapMap(
    cells: List<HeatmapCell>,
    modifier: Modifier = Modifier.fillMaxSize(),
) {
    if (cells.isEmpty()) return

    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current

    val mapView = remember {
        MapView(context).apply {
            setTileSource(TileSourceFactory.MAPNIK)
            setMultiTouchControls(true)
        }
    }

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
        modifier = modifier,
        update = { mv ->
            mv.overlays.clear()
            mv.overlays.add(HeatmapOverlay(cells))

            // Cadrage initial sur l'étendue de toutes les cellules — même parade anti-ANR que
            // GpsTrackMapCard : zoomToBoundingBox peut bloquer indéfiniment si la vue n'a pas encore
            // de dimensions mesurées.
            val geoPoints = cells.map { GeoPoint(it.centerLat, it.centerLon) }
            val bounds = BoundingBox.fromGeoPoints(geoPoints)
            fun applyZoom() {
                mv.zoomToBoundingBox(bounds, false, 64)
                mv.invalidate()
            }
            if (mv.width > 0 && mv.height > 0) {
                mv.post { applyZoom() }
            } else {
                mv.addOnLayoutChangeListener(object : android.view.View.OnLayoutChangeListener {
                    override fun onLayoutChange(
                        v: android.view.View?, left: Int, top: Int, right: Int, bottom: Int,
                        oldLeft: Int, oldTop: Int, oldRight: Int, oldBottom: Int,
                    ) {
                        if (right - left > 0 && bottom - top > 0) {
                            mv.removeOnLayoutChangeListener(this)
                            applyZoom()
                        }
                    }
                })
            }
        },
    )
}

private const val METERS_PER_DEGREE_LAT = 111_320.0

private class HeatmapOverlay(private val cells: List<HeatmapCell>) : Overlay() {
    private val paint = Paint().apply { style = Paint.Style.FILL; isAntiAlias = true }
    private val minCount = cells.minOf { it.count }
    // Évite une division par zéro quand toutes les cellules ont le même nombre de passages.
    private val maxCount = cells.maxOf { it.count }.coerceAtLeast(minCount + 1)
    private val topLeft = Point()
    private val bottomRight = Point()

    override fun draw(canvas: Canvas, mapView: MapView, shadow: Boolean) {
        if (shadow) return
        val projection = mapView.projection
        cells.forEach { cell ->
            val halfLat = (cell.cellSizeMeters / 2.0) / METERS_PER_DEGREE_LAT
            val halfLon = (cell.cellSizeMeters / 2.0) / (METERS_PER_DEGREE_LAT * cos(Math.toRadians(cell.centerLat)).coerceAtLeast(0.01))
            projection.toPixels(GeoPoint(cell.centerLat + halfLat, cell.centerLon - halfLon), topLeft)
            projection.toPixels(GeoPoint(cell.centerLat - halfLat, cell.centerLon + halfLon), bottomRight)

            // Racine carrée : sans elle, une poignée de cellules extrêmes écrase le dégradé et
            // presque tout le reste retombe au bleu — l'easing étale la lecture visuelle.
            val t = sqrt(((cell.count - minCount).toFloat() / (maxCount - minCount).toFloat()).coerceIn(0f, 1f))
            paint.color = heatmapColor(t).copy(alpha = 0.55f).toArgb()
            canvas.drawRect(
                topLeft.x.toFloat(), topLeft.y.toFloat(),
                bottomRight.x.toFloat(), bottomRight.y.toFloat(),
                paint,
            )
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
