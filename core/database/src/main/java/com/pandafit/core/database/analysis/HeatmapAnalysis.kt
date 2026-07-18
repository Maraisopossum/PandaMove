package com.pandafit.core.database.analysis

import com.pandafit.core.database.entities.GpsTrackPointEntity

/**
 * Aplati tous les points GPS (running/cycling/hiking confondus — la table `gps_track_points` n'est
 * pas spécifique à un sport) en paires (lat, lon), pour la heatmap de densité globale
 * (cf. [com.pandafit.designsystem.components.HeatmapMap], qui fait le calcul de densité/flou —
 * cette fonction ne fait que la conversion depuis l'entité Room).
 */
fun computeHeatmapPoints(points: List<GpsTrackPointEntity>): List<Pair<Double, Double>> =
    points.map { it.latitude to it.longitude }
