package com.pandafit.core.database.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update
import com.pandafit.core.database.entities.ObjectifProgressionEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface ObjectifProgressionDao {

    @Query("SELECT * FROM objectifs_progression WHERE seance_id = :seanceId AND exercise_id = :exerciceId")
    suspend fun getBySeanceAndExercice(seanceId: Long, exerciceId: Long): ObjectifProgressionEntity?

    @Query("SELECT * FROM objectifs_progression WHERE seance_id = :seanceId")
    suspend fun getAllForSeance(seanceId: Long): List<ObjectifProgressionEntity>

    @Query("SELECT * FROM objectifs_progression WHERE seance_id = :seanceId")
    fun observeAllForSeance(seanceId: Long): Flow<List<ObjectifProgressionEntity>>

    @Insert(onConflict = OnConflictStrategy.ABORT)
    suspend fun insert(objectif: ObjectifProgressionEntity): Long

    @Update
    suspend fun update(objectif: ObjectifProgressionEntity)

    // Pas de clé primaire connue côté appelant (objectif peut ne pas encore exister) :
    // get-then-insert/update pour respecter la contrainte unique (seance_id, exercise_id)
    // sans écraser un id existant comme le ferait un simple REPLACE.
    suspend fun upsert(objectif: ObjectifProgressionEntity) {
        val existing = getBySeanceAndExercice(objectif.seanceId, objectif.exerciceId)
        if (existing == null) {
            insert(objectif)
        } else {
            update(objectif.copy(id = existing.id))
        }
    }
}
