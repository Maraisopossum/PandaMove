package com.pandafit.designsystem.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.unit.dp

/**
 * Miniature de tracé GPS pour les cartes de liste (aperçu rapide, pas une vraie carte — pas de
 * fond OSMDroid : trop coûteux à instancier une fois par ligne dans une liste qui défile). Juste la
 * forme du parcours, mise à l'échelle dans son cadre, sans respect de la projection géographique
 * réelle (à cette taille, la déformation est invisible).
 */
@Composable
fun GpsRouteThumbnail(
    points: List<Pair<Double, Double>>,
    color: Color,
    modifier: Modifier = Modifier,
) {
    Canvas(
        modifier = modifier
            .background(color.copy(alpha = 0.10f), RoundedCornerShape(10.dp)),
    ) {
        if (points.size < 2) return@Canvas
        val lats = points.map { it.first }
        val lons = points.map { it.second }
        val minLat = lats.min(); val maxLat = lats.max()
        val minLon = lons.min(); val maxLon = lons.max()
        val latSpan = (maxLat - minLat).coerceAtLeast(0.00001)
        val lonSpan = (maxLon - minLon).coerceAtLeast(0.00001)
        val padding = size.minDimension * 0.18f
        val w = size.width - padding * 2
        val h = size.height - padding * 2

        fun toOffset(lat: Double, lon: Double): Offset {
            val xFrac = ((lon - minLon) / lonSpan).toFloat()
            val yFrac = ((lat - minLat) / latSpan).toFloat()
            // Latitude croissante = nord = haut du cadre → axe Y inversé.
            return Offset(padding + xFrac * w, padding + (1f - yFrac) * h)
        }

        val path = Path()
        points.forEachIndexed { index, (lat, lon) ->
            val offset = toOffset(lat, lon)
            if (index == 0) path.moveTo(offset.x, offset.y) else path.lineTo(offset.x, offset.y)
        }
        drawPath(
            path,
            color = color,
            style = Stroke(width = 2.5f, cap = StrokeCap.Round, join = StrokeJoin.Round),
        )
    }
}
