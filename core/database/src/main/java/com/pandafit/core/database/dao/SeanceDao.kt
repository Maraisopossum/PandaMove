package com.pandafit.core.database.dao

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Transaction
import androidx.room.Update
import com.pandafit.core.database.entities.BlocSeanceEntity
import com.pandafit.core.database.entities.ExerciceSeanceEntity
import com.pandafit.core.database.entities.SeanceCategory
import com.pandafit.core.database.entities.SeanceEntity
import com.pandafit.core.database.relations.ExerciceSeanceWithExercise
import com.pandafit.core.database.relations.SeanceFull
import kotlinx.coroutines.flow.Flow

@Dao
interface SeanceDao {

    // --- Séances génériques ---

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertSeance(seance: SeanceEntity): Long

    @Update
    suspend fun updateSeance(seance: SeanceEntity)

    @Delete
    suspend fun deleteSeance(seance: SeanceEntity)

    @Query("SELECT * FROM seances ORDER BY updated_at DESC")
    fun observeAll(): Flow<List<SeanceEntity>>

    @Query("SELECT * FROM seances WHERE seance_category = :category AND is_archived = 0 ORDER BY updated_at DESC")
    fun observeByCategory(category: SeanceCategory): Flow<List<SeanceEntity>>

    @Query("SELECT * FROM seances WHERE seance_category != 'STRENGTH' AND is_archived = 0 ORDER BY updated_at DESC")
    fun observeAllWarmups(): Flow<List<SeanceEntity>>

    @Query("SELECT * FROM seances WHERE id = :id")
    suspend fun getById(id: Long): SeanceEntity?

    @Query("SELECT * FROM seances WHERE id = :id")
    fun observeById(id: Long): kotlinx.coroutines.flow.Flow<SeanceEntity?>

    @Query("SELECT * FROM blocs_seance WHERE seance_id = :seanceId AND instance_seance_id IS NULL ORDER BY position ASC")
    fun observeTemplateBlocsForSeance(seanceId: Long): kotlinx.coroutines.flow.Flow<List<BlocSeanceEntity>>

    @Transaction
    @Query("SELECT * FROM seances WHERE id = :id")
    suspend fun getSeanceFull(id: Long): SeanceFull?

    // --- Blocs ---

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertBloc(bloc: BlocSeanceEntity): Long

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertBlocs(blocs: List<BlocSeanceEntity>): List<Long>

    @Update
    suspend fun updateBloc(bloc: BlocSeanceEntity)

    @Delete
    suspend fun deleteBloc(bloc: BlocSeanceEntity)

    @Query("DELETE FROM blocs_seance WHERE seance_id = :seanceId")
    suspend fun deleteAllBlocsForSeance(seanceId: Long)

    @Query("SELECT * FROM blocs_seance WHERE seance_id = :seanceId ORDER BY position ASC")
    suspend fun getBlocsForSeance(seanceId: Long): List<BlocSeanceEntity>

    // --- Exercices de la séance ---

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertExerciceSeance(exercice: ExerciceSeanceEntity): Long

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertExercicesSeance(exercices: List<ExerciceSeanceEntity>)

    @Update
    suspend fun updateExerciceSeance(exercice: ExerciceSeanceEntity)

    @Delete
    suspend fun deleteExerciceSeance(exercice: ExerciceSeanceEntity)

    @Query("DELETE FROM exercices_seance WHERE seance_id = :seanceId")
    suspend fun deleteAllExercicesForSeance(seanceId: Long)

    @Transaction
    @Query("SELECT * FROM exercices_seance WHERE seance_id = :seanceId ORDER BY position ASC")
    fun observeExercicesForSeance(seanceId: Long): Flow<List<ExerciceSeanceWithExercise>>

    @Transaction
    @Query("SELECT * FROM exercices_seance WHERE seance_id = :seanceId ORDER BY position ASC")
    suspend fun getExercicesForSeance(seanceId: Long): List<ExerciceSeanceWithExercise>

    @Query("SELECT * FROM exercices_seance WHERE id = :id")
    suspend fun getExerciceSeanceById(id: Long): ExerciceSeanceEntity?

    // --- Blocs et exercices propres à une instance ---

    @Query("SELECT * FROM blocs_seance WHERE instance_seance_id = :instanceId ORDER BY position ASC")
    suspend fun getBlocsForInstance(instanceId: Long): List<BlocSeanceEntity>

    @Transaction
    @Query("SELECT * FROM exercices_seance WHERE instance_seance_id = :instanceId ORDER BY position ASC")
    suspend fun getExercicesForInstance(instanceId: Long): List<ExerciceSeanceWithExercise>

    @Query("DELETE FROM blocs_seance WHERE instance_seance_id = :instanceId")
    suspend fun deleteBlocsForInstance(instanceId: Long)

    @Query("DELETE FROM exercices_seance WHERE instance_seance_id = :instanceId")
    suspend fun deleteExercicesForInstance(instanceId: Long)

    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun insertSeanceIgnore(seance: SeanceEntity): Long

    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun insertBlocIgnore(bloc: BlocSeanceEntity): Long

    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun insertExerciceIgnore(exercice: ExerciceSeanceEntity): Long
}
