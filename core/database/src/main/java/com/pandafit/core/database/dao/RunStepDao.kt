package com.pandafit.core.database.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.pandafit.core.database.entities.RunStepEntity

@Dao
interface RunStepDao {

    @Insert
    suspend fun insert(step: RunStepEntity): Long

    @Insert
    suspend fun insertAll(steps: List<RunStepEntity>)

    @Query("SELECT * FROM run_steps WHERE workout_id = :workoutId ORDER BY position")
    suspend fun getByWorkout(workoutId: Long): List<RunStepEntity>

    // Supprime uniquement les étapes racine (pas dans une répétition)
    // Les étapes enfants sont supprimées en CASCADE quand on supprime les run_repeats
    @Query("DELETE FROM run_steps WHERE workout_id = :workoutId AND repeat_id IS NULL")
    suspend fun deleteTopLevelForWorkout(workoutId: Long)

    @Query("UPDATE run_steps SET results_json = :resultsJson WHERE id = :id")
    suspend fun updateResults(id: Long, resultsJson: String)

    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun insertIgnore(step: RunStepEntity): Long
}
