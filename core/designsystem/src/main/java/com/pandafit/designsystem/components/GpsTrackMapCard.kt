package com.pandafit.designsystem.components

import android.graphics.Paint
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import org.osmdroid.tileprovider.tilesource.TileSourceFactory
import org.osmdroid.util.BoundingBox
import org.osmdroid.util.GeoPoint
import org.osmdroid.views.MapView
import org.osmdroid.views.overlay.Polyline

/**
 * Carte GPS en lecture seule affichant un tracé.
 *
 * [points] : liste de paires (latitude, longitude), déjà simplifiées par Douglas-Peucker.
 * La carte est non-interactive pour ne pas capturer les événements tactiles dans un scroll.
 *
 * Utilise OpenStreetMap (aucune clé API requise).
 * Nécessite la permission INTERNET et l'initialisation de
 * `org.osmdroid.config.Configuration.getInstance().userAgentValue` dans l'Application.
 */
@Composable
fun GpsTrackMapCard(
    points: List<Pair<Double, Double>>,
    modifier: Modifier = Modifier
        .fillMaxWidth()
        .height(220.dp)
        .clip(RoundedCornerShape(12.dp)),
) {
    if (points.size < 2) return

    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current

    val mapView = remember {
        MapView(context).apply {
            setTileSource(TileSourceFactory.MAPNIK)
            // Non-interactif — la liste scrollable conserve le contrôle du toucher
            setMultiTouchControls(false)
            isClickable = false
            isFocusable = false
            setOnTouchListener { _, _ -> false }
        }
    }

    // Gestion du cycle de vie OSMDroid
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

            val geoPoints = points.map { (lat, lon) -> GeoPoint(lat, lon) }

            // Tracé principal
            val polyline = Polyline(mv).apply {
                setPoints(geoPoints)
                outlinePaint.apply {
                    color = android.graphics.Color.parseColor("#4CAF50") // KalyptusGreen
                    strokeWidth = 9f
                    strokeCap = Paint.Cap.ROUND
                    strokeJoin = Paint.Join.ROUND
                    isAntiAlias = true
                }
            }
            mv.overlays.add(polyline)

            // Ajustement automatique sur le tracé. `zoomToBoundingBox` peut bloquer indéfiniment
            // (ANR réel confirmé par instrumentation : plus de 10s sans retour) si la vue n'a pas
            // encore de dimensions (mv.width/height == 0), ce qui est le cas courant à la première
            // mise en page de la carte (l'AndroidView n'a pas fini son layout quand `update` est
            // appelé). On attend donc une mesure valide via un listener de layout ponctuel plutôt
            // que d'appeler le zoom immédiatement.
            val bounds = BoundingBox.fromGeoPoints(geoPoints)
            fun applyZoom() {
                mv.zoomToBoundingBox(bounds, false, 56)
                mv.invalidate()
            }
            if (mv.width > 0 && mv.height > 0) {
                mv.post { applyZoom() }
            } else {
                // ViewTreeObserver.addOnGlobalLayoutListener n'est pas fiable ici : avant que la
                // vue soit attachée à une fenêtre, getViewTreeObserver() peut renvoyer une instance
                // transitoire remplacée à l'attachement, ce qui perd silencieusement le listener.
                // addOnLayoutChangeListener est porté par la View elle-même, pas par un
                // ViewTreeObserver ponctuel — il survit à l'attachement.
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
