package com.pandafit.core.database.analysis

import com.pandafit.core.database.entities.GpsTrackPointEntity
import kotlin.math.cos
import kotlin.math.floor

/** Une cellule de la grille de heatmap — [count] passages GPS dans cette zone, toutes séances confondues. */
data class HeatmapCell(
    val centerLat: Double,
    val centerLon: Double,
    val cellSizeMeters: Double,
    val count: Int,
)

private const val METERS_PER_DEGREE_LAT = 111_320.0

/**
 * Agrège tous les points GPS (running/cycling/hiking confondus — la table `gps_track_points` n'est
 * pas spécifique à un sport) en une grille de cellules géographiques de [cellSizeMeters] de côté,
 * en comptant le nombre de points tombant dans chaque cellule — sert de base au dégradé de couleur
 * de la heatmap (cf. [com.pandafit.designsystem.components.HeatmapMap]).
 *
 * La taille de cellule en longitude dépend de la latitude (les méridiens se rapprochent vers les
 * pôles) ; on la calcule une seule fois à partir de la latitude moyenne du jeu de points plutôt que
 * par point, pour garantir une grille cohérente sur toute la zone — au prix d'une légère distorsion
 * si les points couvrent une très large plage de latitudes (négligeable à l'échelle d'une ville).
 */
fun computeHeatmapCells(points: List<GpsTrackPointEntity>, cellSizeMeters: Double = 25.0): List<HeatmapCell> {
    if (points.isEmpty()) return emptyList()

    val refLat = points.sumOf { it.latitude } / points.size
    val latCellSizeDeg = cellSizeMeters / METERS_PER_DEGREE_LAT
    val lonCellSizeDeg = cellSizeMeters / (METERS_PER_DEGREE_LAT * cos(Math.toRadians(refLat)).coerceAtLeast(0.01))

    val counts = HashMap<Pair<Long, Long>, Int>()
    for (p in points) {
        val latIdx = floor(p.latitude / latCellSizeDeg).toLong()
        val lonIdx = floor(p.longitude / lonCellSizeDeg).toLong()
        val key = latIdx to lonIdx
        counts[key] = (counts[key] ?: 0) + 1
    }

    return counts.map { (idx, count) ->
        val (latIdx, lonIdx) = idx
        HeatmapCell(
            centerLat = (latIdx + 0.5) * latCellSizeDeg,
            centerLon = (lonIdx + 0.5) * lonCellSizeDeg,
            cellSizeMeters = cellSizeMeters,
            count = count,
        )
    }
}
