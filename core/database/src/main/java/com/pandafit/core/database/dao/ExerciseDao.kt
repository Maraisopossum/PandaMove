package com.pandafit.core.database.dao

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Transaction
import androidx.room.Update
import com.pandafit.core.database.entities.ExerciseCategory
import com.pandafit.core.database.entities.ExerciseEntity
import com.pandafit.core.database.entities.ExerciseSetEntity
import com.pandafit.core.database.entities.WorkoutExerciseEntity
import com.pandafit.core.database.relations.WorkoutExerciseWithSets
import kotlinx.coroutines.flow.Flow

@Dao
interface ExerciseDao {

    // --- Bibliothèque d'exercices ---

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertExercise(exercise: ExerciseEntity): Long

    @Update
    suspend fun updateExercise(exercise: ExerciseEntity)

    @Delete
    suspend fun deleteExercise(exercise: ExerciseEntity)

    @Query("SELECT * FROM exercises WHERE id IN (:ids)")
    suspend fun getByIds(ids: List<Long>): List<ExerciseEntity>

    @Query("SELECT * FROM exercises WHERE name = :name LIMIT 1")
    suspend fun getByName(name: String): ExerciseEntity?

    @Query("SELECT * FROM exercises ORDER BY name ASC")
    fun observeAll(): Flow<List<ExerciseEntity>>

    @Query("SELECT * FROM exercises WHERE is_favorite = 1 ORDER BY name ASC")
    fun observeFavorites(): Flow<List<ExerciseEntity>>

    @Query("SELECT * FROM exercises WHERE category = :category ORDER BY name ASC")
    fun observeByCategory(category: ExerciseCategory): Flow<List<ExerciseEntity>>

    @Query("SELECT * FROM exercises WHERE name LIKE '%' || :query || '%' ORDER BY name ASC")
    fun search(query: String): Flow<List<ExerciseEntity>>

    @Query("UPDATE exercises SET is_favorite = :isFavorite WHERE id = :id")
    suspend fun updateFavorite(id: Long, isFavorite: Boolean)

    @Query("SELECT COUNT(*) FROM exercises WHERE is_custom = 0")
    suspend fun countCatalogExercises(): Int

    @Query("SELECT * FROM exercises WHERE is_custom = 0")
    suspend fun getAllCatalogExercises(): List<ExerciseEntity>

    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun insertAll(exercises: List<ExerciseEntity>)

    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun insertIgnore(exercise: ExerciseEntity): Long

    // --- Exercices dans une séance ---

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertWorkoutExercise(workoutExercise: WorkoutExerciseEntity): Long

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertWorkoutExercises(exercises: List<WorkoutExerciseEntity>)

    @Update
    suspend fun updateWorkoutExercise(workoutExercise: WorkoutExerciseEntity)

    @Delete
    suspend fun deleteWorkoutExercise(workoutExercise: WorkoutExerciseEntity)

    @Query("DELETE FROM workout_exercises WHERE workout_id = :workoutId")
    suspend fun deleteAllForWorkout(workoutId: Long)

    @Transaction
    @Query("SELECT * FROM workout_exercises WHERE workout_id = :workoutId ORDER BY position ASC")
    fun observeWithSets(workoutId: Long): Flow<List<WorkoutExerciseWithSets>>

    @Transaction
    @Query("SELECT * FROM workout_exercises WHERE workout_id = :workoutId ORDER BY position ASC")
    suspend fun getWithSets(workoutId: Long): List<WorkoutExerciseWithSets>

    // --- Séries ---

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertSet(set: ExerciseSetEntity): Long

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertSets(sets: List<ExerciseSetEntity>)

    @Update
    suspend fun updateSet(set: ExerciseSetEntity)

    @Delete
    suspend fun deleteSet(set: ExerciseSetEntity)

    @Query("DELETE FROM exercise_sets WHERE workout_exercise_id = :workoutExerciseId")
    suspend fun deleteSetsForExercise(workoutExerciseId: Long)

    @Query("SELECT * FROM exercise_sets WHERE workout_exercise_id = :workoutExerciseId ORDER BY set_number ASC")
    fun observeSets(workoutExerciseId: Long): Flow<List<ExerciseSetEntity>>
}
