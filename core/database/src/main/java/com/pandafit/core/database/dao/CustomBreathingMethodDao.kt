package com.pandafit.core.database.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update
import com.pandafit.core.database.entities.CustomBreathingMethodEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface CustomBreathingMethodDao {

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(method: CustomBreathingMethodEntity): Long

    @Update
    suspend fun update(method: CustomBreathingMethodEntity)

    @Query("SELECT * FROM custom_breathing_method ORDER BY id ASC")
    fun observeAll(): Flow<List<CustomBreathingMethodEntity>>

    @Query("SELECT * FROM custom_breathing_method WHERE id = :id")
    suspend fun getById(id: Long): CustomBreathingMethodEntity?

    @Query("DELETE FROM custom_breathing_method WHERE id = :id")
    suspend fun deleteById(id: Long)
}
