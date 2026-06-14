package com.pandafit.core.database.dao

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Transaction
import androidx.room.Update
import com.pandafit.core.database.entities.WorkoutEntity
import com.pandafit.core.database.entities.WorkoutType
import com.pandafit.core.database.relations.WorkoutWithBlocks
import kotlinx.coroutines.flow.Flow
import java.time.LocalDate

@Dao
interface WorkoutDao {

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(workout: WorkoutEntity): Long

    @Update
    suspend fun update(workout: WorkoutEntity)

    @Delete
    suspend fun delete(workout: WorkoutEntity)

    @Query("DELETE FROM workouts WHERE id = :id")
    suspend fun deleteById(id: Long)

    @Query("SELECT * FROM workouts WHERE id = :id")
    suspend fun getById(id: Long): WorkoutEntity?

    @Transaction
    @Query("SELECT * FROM workouts WHERE id = :id")
    suspend fun getWithBlocksById(id: Long): WorkoutWithBlocks?

    @Query("SELECT * FROM workouts WHERE workout_type = :type ORDER BY scheduled_date DESC")
    fun observeByType(type: WorkoutType): Flow<List<WorkoutEntity>>

    @Query("SELECT * FROM workouts WHERE scheduled_date = :date ORDER BY created_at ASC")
    fun observeByDate(date: LocalDate): Flow<List<WorkoutEntity>>

    @Query("""
        SELECT * FROM workouts
        WHERE scheduled_date >= :startDate AND scheduled_date <= :endDate
        ORDER BY scheduled_date ASC
    """)
    fun observeByDateRange(startDate: LocalDate, endDate: LocalDate): Flow<List<WorkoutEntity>>

    @Transaction
    @Query("""
        SELECT * FROM workouts
        WHERE scheduled_date >= :startDate AND scheduled_date <= :endDate
        ORDER BY scheduled_date ASC
    """)
    fun observeWithBlocksByDateRange(
        startDate: LocalDate,
        endDate: LocalDate,
    ): Flow<List<WorkoutWithBlocks>>

    @Query("SELECT * FROM workouts ORDER BY scheduled_date DESC")
    fun observeAll(): Flow<List<WorkoutEntity>>

    @Query("""
        SELECT COUNT(*) FROM workouts
        WHERE scheduled_date >= :startDate AND scheduled_date <= :endDate
        AND workout_type = :type
    """)
    suspend fun countByTypeAndPeriod(
        type: WorkoutType,
        startDate: LocalDate,
        endDate: LocalDate,
    ): Int

    @Query("""
        SELECT SUM(duration_minutes) FROM workouts
        WHERE scheduled_date >= :startDate AND scheduled_date <= :endDate
        AND workout_type = :type AND is_completed = 1
    """)
    suspend fun sumDurationByTypeAndPeriod(
        type: WorkoutType,
        startDate: LocalDate,
        endDate: LocalDate,
    ): Int?

    @Query("UPDATE workouts SET is_completed = :completed, completed_at = :completedAt WHERE id = :id")
    suspend fun updateCompletion(id: Long, completed: Boolean, completedAt: String?)

    @Query("SELECT * FROM workouts WHERE scheduled_date >= :today AND is_completed = 0 AND is_template = 0 ORDER BY scheduled_date ASC LIMIT :limit")
    fun observeUpcoming(today: LocalDate, limit: Int = 5): Flow<List<WorkoutEntity>>

    @Query("SELECT * FROM workouts WHERE workout_type = :type AND is_template = 1 ORDER BY name ASC")
    fun observeTemplatesByType(type: WorkoutType): Flow<List<WorkoutEntity>>

    @Query("SELECT * FROM workouts WHERE workout_type = :type AND is_template = 0 AND is_completed = 0 ORDER BY scheduled_date ASC")
    fun observePlannedByType(type: WorkoutType): Flow<List<WorkoutEntity>>

    @Query("SELECT * FROM workouts WHERE workout_type = :type AND is_completed = 1 ORDER BY scheduled_date DESC")
    fun observeCompletedByType(type: WorkoutType): Flow<List<WorkoutEntity>>

    @Query("""UPDATE workouts SET result_distance_km = :distKm, result_duration_sec = :durSec,
        result_pace_avg_min_per_km = :pace, result_hr_avg = :hr, result_hr_max = :hrMax,
        result_rpe = :rpe, result_notes = :notes, result_elevation_m = :elevationM,
        result_cadence_avg_rpm = :cadence, result_calories = :calories,
        is_completed = 1, completed_at = :completedAt WHERE id = :id""")
    suspend fun saveResults(
        id: Long, distKm: Double?, durSec: Int?, pace: Double?,
        hr: Int?, hrMax: Int?, rpe: Int?, notes: String,
        elevationM: Int?, cadence: Int?, calories: Int?, completedAt: String?,
    )

    @Query("""UPDATE workouts SET result_distance_km = :distKm, result_duration_sec = :durSec,
        result_speed_avg_kmh = :speedAvg, result_speed_max_kmh = :speedMax,
        result_hr_avg = :hr, result_hr_max = :hrMax, result_cadence_avg_rpm = :cadence,
        result_elevation_m = :elevationM, result_calories = :calories,
        result_rpe = :rpe, result_notes = :notes,
        is_completed = 1, completed_at = :completedAt WHERE id = :id""")
    suspend fun saveCyclingResults(
        id: Long, distKm: Double?, durSec: Int?,
        speedAvg: Double?, speedMax: Double?,
        hr: Int?, hrMax: Int?, cadence: Int?,
        elevationM: Int?, calories: Int?,
        rpe: Int?, notes: String, completedAt: String?,
    )

    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun insertIgnore(workout: WorkoutEntity): Long
}
