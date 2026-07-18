package com.pandafit.core.database.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.pandafit.core.database.entities.GpsTrackPointEntity
import com.pandafit.core.database.entities.WorkoutType
import kotlinx.coroutines.flow.Flow

@Dao
interface GpsTrackPointDao {

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(points: List<GpsTrackPointEntity>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertOne(point: GpsTrackPointEntity): Long

    @Query("SELECT * FROM gps_track_points WHERE workout_id = :workoutId ORDER BY point_index ASC")
    suspend fun getByWorkout(workoutId: Long): List<GpsTrackPointEntity>

    /** Requête groupée pour les listes (miniature de tracé) — évite une requête par séance affichée. */
    @Query("SELECT * FROM gps_track_points WHERE workout_id IN (:workoutIds) ORDER BY workout_id ASC, point_index ASC")
    suspend fun getByWorkoutIds(workoutIds: List<Long>): List<GpsTrackPointEntity>

    /**
     * Tous les points GPS toutes séances confondues — pour la heatmap globale
     * (cf. core/database/analysis/HeatmapAnalysis.kt). Trié par séance puis par ordre de parcours :
     * le regroupement par workout_id y préserve l'ordre des points sans re-tri côté Kotlin.
     */
    @Query("SELECT * FROM gps_track_points ORDER BY workout_id ASC, point_index ASC")
    suspend fun getAll(): List<GpsTrackPointEntity>

    /** Comme [getAll], filtré à un seul sport — pour le filtre de la heatmap globale. */
    @Query(
        """
        SELECT gps_track_points.* FROM gps_track_points
        INNER JOIN workouts ON gps_track_points.workout_id = workouts.id
        WHERE workouts.workout_type = :type
        ORDER BY gps_track_points.workout_id ASC, gps_track_points.point_index ASC
        """
    )
    suspend fun getAllByWorkoutType(type: WorkoutType): List<GpsTrackPointEntity>

    @Query("SELECT * FROM gps_track_points WHERE workout_id = :workoutId ORDER BY point_index ASC")
    fun observeByWorkout(workoutId: Long): Flow<List<GpsTrackPointEntity>>

    @Query("DELETE FROM gps_track_points WHERE workout_id = :workoutId")
    suspend fun deleteByWorkout(workoutId: Long)
}
