package com.pandafit.core.database.dao

import androidx.room.ColumnInfo
import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Transaction
import androidx.room.Update
import com.pandafit.core.database.entities.InstanceSeanceEntity
import com.pandafit.core.database.entities.RepsType
import com.pandafit.core.database.entities.SerieRealiseeEntity
import com.pandafit.core.database.relations.InstanceWithSeries
import kotlinx.coroutines.flow.Flow
import java.time.LocalDate
import java.time.LocalDateTime

@Dao
interface InstanceSeanceDao {

    // --- Instances ---

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertInstance(instance: InstanceSeanceEntity): Long

    @Update
    suspend fun updateInstance(instance: InstanceSeanceEntity)

    @Delete
    suspend fun deleteInstance(instance: InstanceSeanceEntity)

    @Query("SELECT * FROM instances_seance WHERE id = :id")
    suspend fun getById(id: Long): InstanceSeanceEntity?

    @Transaction
    @Query("SELECT * FROM instances_seance WHERE id = :id")
    suspend fun getWithSeries(id: Long): InstanceWithSeries?

    @Query("SELECT * FROM instances_seance ORDER BY date ASC")
    fun observeAll(): Flow<List<InstanceSeanceEntity>>

    @Query("SELECT * FROM instances_seance WHERE date BETWEEN :startDate AND :endDate ORDER BY date ASC")
    fun observeByDateRange(startDate: LocalDate, endDate: LocalDate): Flow<List<InstanceSeanceEntity>>

    @Query("SELECT * FROM instances_seance WHERE seance_id = :seanceId ORDER BY date DESC")
    fun observeForSeance(seanceId: Long): Flow<List<InstanceSeanceEntity>>

    @Query("SELECT COUNT(*) FROM instances_seance WHERE seance_id = :seanceId")
    suspend fun countForSeance(seanceId: Long): Int

    @Transaction
    @Query("SELECT * FROM instances_seance WHERE seance_id = :seanceId AND date < :beforeDate ORDER BY date DESC LIMIT 1")
    suspend fun getPreviousInstanceWithSeries(seanceId: Long, beforeDate: LocalDate): InstanceWithSeries?

    @Query("UPDATE instances_seance SET is_completed = :isCompleted, completed_at = :completedAt, duration_seconds = :durationSeconds WHERE id = :id")
    suspend fun updateCompletion(id: Long, isCompleted: Boolean, completedAt: LocalDateTime?, durationSeconds: Int = 0)

    // --- Séries réalisées ---

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertSerie(serie: SerieRealiseeEntity): Long

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertSeries(series: List<SerieRealiseeEntity>)

    @Update
    suspend fun updateSerie(serie: SerieRealiseeEntity)

    @Delete
    suspend fun deleteSerie(serie: SerieRealiseeEntity)

    @Query("DELETE FROM series_realisees WHERE instance_seance_id = :instanceId")
    suspend fun deleteAllSeriesForInstance(instanceId: Long)

    // --- Stats ---

    @Query("SELECT COUNT(*) FROM instances_seance WHERE date BETWEEN :startDate AND :endDate")
    suspend fun countInRange(startDate: LocalDate, endDate: LocalDate): Int

    @Transaction
    @Query("SELECT * FROM instances_seance WHERE is_completed = 1 AND date BETWEEN :startDate AND :endDate ORDER BY date ASC")
    suspend fun getCompletedWithSeriesInRange(startDate: LocalDate, endDate: LocalDate): List<InstanceWithSeries>

    @Query("SELECT id, exercise_id, reps_type FROM exercices_seance WHERE seance_id IN (:seanceIds)")
    suspend fun getExerciceMappingsForSeances(seanceIds: List<Long>): List<ExerciceMapping>

    @Query("""
        SELECT es.exercise_id, e.name AS exercise_name,
               COALESCE(NULLIF(e.muscle_primary, ''), 'Autre') AS muscle_primary,
               COUNT(sr.id) AS series_count, MAX(sr.charge_kg) AS max_charge_kg
        FROM series_realisees sr
        INNER JOIN instances_seance inst ON sr.instance_seance_id = inst.id
        INNER JOIN exercices_seance es ON sr.exercice_seance_id = es.id
        INNER JOIN exercises e ON es.exercise_id = e.id
        WHERE inst.is_completed = 1
          AND inst.date BETWEEN :startDate AND :endDate
          AND sr.is_completed = 1
        GROUP BY es.exercise_id
        ORDER BY series_count DESC
    """)
    suspend fun getExerciseStatsFull(startDate: LocalDate, endDate: LocalDate): List<ExerciseStatFull>

    @Query("SELECT * FROM series_realisees WHERE instance_seance_id = :instanceId ORDER BY exercice_seance_id ASC, numero_serie ASC")
    suspend fun getSeriesForInstance(instanceId: Long): List<SerieRealiseeEntity>

    @Query("SELECT * FROM series_realisees WHERE instance_seance_id = :instanceId AND exercice_seance_id = :exerciceSeanceId ORDER BY numero_serie ASC")
    fun observeSeriesForExercice(instanceId: Long, exerciceSeanceId: Long): Flow<List<SerieRealiseeEntity>>

    @Transaction
    @Query("SELECT * FROM instances_seance WHERE seance_id = :seanceId AND is_completed = 1 ORDER BY date DESC")
    suspend fun getAllCompletedInstancesWithSeries(seanceId: Long): List<InstanceWithSeries>

    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun insertInstanceIgnore(instance: InstanceSeanceEntity): Long

    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun insertSerieIgnore(serie: SerieRealiseeEntity): Long

    /**
     * Historique cross-séance pour un exercice donné (par exercise_id).
     * Exclut l'instance en cours. Résultats triés par date décroissante.
     */
    @Query("""
        SELECT i.date        AS instance_date,
               sr.exercice_seance_id,
               sr.numero_serie,
               sr.reps_realisees,
               sr.charge_kg,
               sr.charge_label,
               sr.rpe,
               sr.is_completed
        FROM series_realisees sr
        JOIN exercices_seance es ON sr.exercice_seance_id = es.id
        JOIN instances_seance i  ON sr.instance_seance_id = i.id
        WHERE es.exercise_id = :exerciseId
          AND i.is_completed = 1
          AND i.id != :currentInstanceId
        ORDER BY i.date DESC
    """)
    suspend fun getHistoriqueForExercise(exerciseId: Long, currentInstanceId: Long): List<SerieHistoriqueRow>
}

data class SerieHistoriqueRow(
    @ColumnInfo(name = "instance_date")    val instanceDate: java.time.LocalDate,
    @ColumnInfo(name = "exercice_seance_id") val exerciceSeanceId: Long,
    @ColumnInfo(name = "numero_serie")     val numeroSerie: Int,
    @ColumnInfo(name = "reps_realisees")   val repsRealisees: Int?,
    @ColumnInfo(name = "charge_kg")        val chargeKg: Float?,
    @ColumnInfo(name = "charge_label")     val chargeLabel: String?,
    val rpe: Float?,
    @ColumnInfo(name = "is_completed")     val isCompleted: Boolean,
)

data class ExerciceMapping(
    val id: Long,
    @ColumnInfo(name = "exercise_id") val exerciseId: Long,
    @ColumnInfo(name = "reps_type") val repsType: RepsType = RepsType.REPS,
)

data class ExerciseStatFull(
    @ColumnInfo(name = "exercise_id") val exerciseId: Long,
    @ColumnInfo(name = "exercise_name") val exerciseName: String,
    @ColumnInfo(name = "muscle_primary") val musclePrimary: String,
    @ColumnInfo(name = "series_count") val seriesCount: Int,
    @ColumnInfo(name = "max_charge_kg") val maxChargeKg: Float?,
)
