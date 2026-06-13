package com.pandafit.core.database.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.pandafit.core.database.entities.BreathingSessionEntity
import kotlinx.coroutines.flow.Flow
import java.time.LocalDate

@Dao
interface BreathingSessionDao {

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(session: BreathingSessionEntity): Long

    @Query("SELECT * FROM breathing_session ORDER BY session_date DESC")
    fun observeAll(): Flow<List<BreathingSessionEntity>>

    @Query("""
        SELECT * FROM breathing_session
        WHERE session_date >= :from AND session_date <= :to
        ORDER BY session_date DESC
    """)
    fun observeByDateRange(from: LocalDate, to: LocalDate): Flow<List<BreathingSessionEntity>>

    @Query("SELECT COUNT(*) FROM breathing_session WHERE session_date >= :from AND session_date <= :to")
    fun countByDateRange(from: LocalDate, to: LocalDate): Flow<Int>

    @Query("DELETE FROM breathing_session WHERE id = :id")
    suspend fun deleteById(id: Long)
}
