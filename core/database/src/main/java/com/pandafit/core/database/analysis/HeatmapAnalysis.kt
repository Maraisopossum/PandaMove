package com.pandafit.core.database.analysis

import com.pandafit.core.database.entities.GpsTrackPointEntity
import kotlin.math.cos
import kotlin.math.floor

private const val METERS_PER_DEGREE_LAT = 111_320.0

/**
 * Grille géographique de fréquentation — associe une zone GPS au nombre de points qui y sont
 * tombés, toutes séances confondues (running/cycling/hiking : la table `gps_track_points` n'est pas
 * spécifique à un sport). Sert à colorer les tracés dessinés par
 * [com.pandafit.designsystem.components.HeatmapMap] (une ligne, pas un semis de points — la grille
 * ne sert qu'à choisir la couleur de chaque segment, pas à dessiner des formes).
 *
 * La taille de cellule en longitude dépend de la latitude (les méridiens se rapprochent vers les
 * pôles) ; on la calcule une seule fois à partir de la latitude moyenne du jeu de points plutôt que
 * par point, pour garantir une grille cohérente sur toute la zone — au prix d'une légère distorsion
 * si les points couvrent une très large plage de latitudes (négligeable à l'échelle d'une ville).
 */
class HeatmapGrid private constructor(
    private val latCellSizeDeg: Double,
    private val lonCellSizeDeg: Double,
    private val counts: Map<Pair<Long, Long>, Int>,
) {
    val minCount: Int = counts.values.min()

    // Évite une division par zéro quand toutes les cellules ont le même nombre de passages.
    val maxCount: Int = counts.values.max().coerceAtLeast(minCount + 1)

    /** Nombre de passages GPS dans la cellule contenant (lat, lon) — 0 si aucun point n'y est jamais tombé. */
    fun countAt(lat: Double, lon: Double): Int {
        val key = floor(lat / latCellSizeDeg).toLong() to floor(lon / lonCellSizeDeg).toLong()
        return counts[key] ?: 0
    }

    companion object {
        fun from(points: List<GpsTrackPointEntity>, cellSizeMeters: Double = 12.0): HeatmapGrid? {
            if (points.isEmpty()) return null

            val refLat = points.sumOf { it.latitude } / points.size
            val latCellSizeDeg = cellSizeMeters / METERS_PER_DEGREE_LAT
            val lonCellSizeDeg = cellSizeMeters / (METERS_PER_DEGREE_LAT * cos(Math.toRadians(refLat)).coerceAtLeast(0.01))

            val counts = HashMap<Pair<Long, Long>, Int>()
            for (p in points) {
                val key = floor(p.latitude / latCellSizeDeg).toLong() to floor(p.longitude / lonCellSizeDeg).toLong()
                counts[key] = (counts[key] ?: 0) + 1
            }
            return HeatmapGrid(latCellSizeDeg, lonCellSizeDeg, counts)
        }
    }
}

/**
 * Données complètes de la heatmap : la grille de fréquentation (pour la couleur) et les tracés
 * individuels dans leur ordre de parcours (pour dessiner des lignes continues, pas un semis de
 * points — cf. [com.pandafit.designsystem.components.HeatmapMap]).
 */
data class HeatmapData(
    val grid: HeatmapGrid,
    /** Un tracé par séance, points dans l'ordre de parcours (lat, lon). */
    val tracks: List<List<Pair<Double, Double>>>,
)

/** [points] : tous les points GPS toutes séances confondues (cf. [com.pandafit.core.database.dao.GpsTrackPointDao.getAll]). */
fun computeHeatmapData(points: List<GpsTrackPointEntity>, cellSizeMeters: Double = 12.0): HeatmapData? {
    val grid = HeatmapGrid.from(points, cellSizeMeters) ?: return null
    val tracks = points
        .groupBy { it.workoutId } // getAll() trie déjà par workout_id, point_index : l'ordre de parcours est préservé dans chaque groupe.
        .values
        .map { workoutPoints -> workoutPoints.map { it.latitude to it.longitude } }
        .filter { it.size >= 2 }
    return HeatmapData(grid, tracks)
}
