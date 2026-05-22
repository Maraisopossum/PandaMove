package com.pandafit.core.database.dao

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update
import com.pandafit.core.database.entities.WorkoutBlockEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface WorkoutBlockDao {

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(block: WorkoutBlockEntity): Long

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(blocks: List<WorkoutBlockEntity>)

    @Update
    suspend fun update(block: WorkoutBlockEntity)

    @Delete
    suspend fun delete(block: WorkoutBlockEntity)

    @Query("DELETE FROM workout_blocks WHERE workout_id = :workoutId")
    suspend fun deleteAllForWorkout(workoutId: Long)

    @Query("SELECT * FROM workout_blocks WHERE workout_id = :workoutId ORDER BY position ASC")
    fun observeByWorkout(workoutId: Long): Flow<List<WorkoutBlockEntity>>

    @Query("SELECT * FROM workout_blocks WHERE workout_id = :workoutId ORDER BY position ASC")
    suspend fun getByWorkout(workoutId: Long): List<WorkoutBlockEntity>

    @Query("UPDATE workout_blocks SET position = :position WHERE id = :id")
    suspend fun updatePosition(id: Long, position: Int)
}
