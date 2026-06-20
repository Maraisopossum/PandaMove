package com.pandafit.core.database.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.pandafit.core.database.entities.GpsTrackPointEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface GpsTrackPointDao {

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(points: List<GpsTrackPointEntity>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertOne(point: GpsTrackPointEntity): Long

    @Query("SELECT * FROM gps_track_points WHERE workout_id = :workoutId ORDER BY point_index ASC")
    suspend fun getByWorkout(workoutId: Long): List<GpsTrackPointEntity>

    @Query("SELECT * FROM gps_track_points WHERE workout_id = :workoutId ORDER BY point_index ASC")
    fun observeByWorkout(workoutId: Long): Flow<List<GpsTrackPointEntity>>

    @Query("DELETE FROM gps_track_points WHERE workout_id = :workoutId")
    suspend fun deleteByWorkout(workoutId: Long)
}
