package com.pandafit.core.database.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update
import com.pandafit.core.database.entities.RunRepeatEntity

@Dao
interface RunRepeatDao {

    @Insert
    suspend fun insert(repeat: RunRepeatEntity): Long

    @Update
    suspend fun update(repeat: RunRepeatEntity)

    @Query("SELECT * FROM run_repeats WHERE workout_id = :workoutId ORDER BY position")
    suspend fun getByWorkout(workoutId: Long): List<RunRepeatEntity>

    @Query("DELETE FROM run_repeats WHERE workout_id = :workoutId")
    suspend fun deleteAllForWorkout(workoutId: Long)

    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun insertIgnore(repeat: RunRepeatEntity): Long
}
