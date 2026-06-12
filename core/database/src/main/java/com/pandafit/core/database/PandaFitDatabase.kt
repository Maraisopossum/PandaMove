package com.pandafit.core.database

import androidx.room.Database
import androidx.room.RoomDatabase
import androidx.room.TypeConverters
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase
import com.pandafit.core.database.converters.DateConverters
import com.pandafit.core.database.converters.ListConverters
import com.pandafit.core.database.dao.ExerciseDao
import com.pandafit.core.database.dao.GpsTrackPointDao
import com.pandafit.core.database.dao.InstanceSeanceDao
import com.pandafit.core.database.dao.RunRepeatDao
import com.pandafit.core.database.dao.RunStepDao
import com.pandafit.core.database.dao.SeanceDao
import com.pandafit.core.database.dao.WorkoutBlockDao
import com.pandafit.core.database.dao.WorkoutDao
import com.pandafit.core.database.entities.BlocSeanceEntity
import com.pandafit.core.database.entities.ExerciceSeanceEntity
import com.pandafit.core.database.entities.ExerciseEntity
import com.pandafit.core.database.entities.ExerciseSetEntity
import com.pandafit.core.database.entities.GpsTrackPointEntity
import com.pandafit.core.database.entities.InstanceSeanceEntity
import com.pandafit.core.database.entities.RunRepeatEntity
import com.pandafit.core.database.entities.RunStepEntity
import com.pandafit.core.database.entities.SeanceEntity
import com.pandafit.core.database.entities.SerieRealiseeEntity
import com.pandafit.core.database.entities.WorkoutBlockEntity
import com.pandafit.core.database.entities.WorkoutEntity
import com.pandafit.core.database.entities.WorkoutExerciseEntity

@Database(
    entities = [
        WorkoutEntity::class,
        WorkoutBlockEntity::class,
        WorkoutExerciseEntity::class,
        ExerciseEntity::class,
        ExerciseSetEntity::class,
        SeanceEntity::class,
        BlocSeanceEntity::class,
        ExerciceSeanceEntity::class,
        InstanceSeanceEntity::class,
        SerieRealiseeEntity::class,
        RunRepeatEntity::class,
        RunStepEntity::class,
        GpsTrackPointEntity::class,
    ],
    version = 14,
    exportSchema = true,
)
@TypeConverters(DateConverters::class, ListConverters::class)
abstract class PandaFitDatabase : RoomDatabase() {

    abstract fun workoutDao(): WorkoutDao
    abstract fun workoutBlockDao(): WorkoutBlockDao
    abstract fun exerciseDao(): ExerciseDao
    abstract fun seanceDao(): SeanceDao
    abstract fun instanceSeanceDao(): InstanceSeanceDao
    abstract fun runStepDao(): RunStepDao
    abstract fun runRepeatDao(): RunRepeatDao
    abstract fun gpsTrackPointDao(): GpsTrackPointDao

    companion object {
        const val DATABASE_NAME = "pandafit.db"

        // v3 → v4 : ajout des colonnes catalogue dans exercises
        val MIGRATION_3_4 = object : Migration(3, 4) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("ALTER TABLE exercises ADD COLUMN exercise_type TEXT NOT NULL DEFAULT ''")
                db.execSQL("ALTER TABLE exercises ADD COLUMN equipment TEXT NOT NULL DEFAULT '[]'")
                db.execSQL("ALTER TABLE exercises ADD COLUMN muscle_primary TEXT NOT NULL DEFAULT ''")
            }
        }

        // v4 → v5 : suppression des exercices catalogue pour forcer le re-seed avec musclePrimary
        val MIGRATION_4_5 = object : Migration(4, 5) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("DELETE FROM exercises WHERE is_custom = 0")
            }
        }

        // v5 → v6 : ajout des champs template/résultats sur workouts et colonnes running sur workout_blocks
        val MIGRATION_5_6 = object : Migration(5, 6) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("ALTER TABLE workouts ADD COLUMN is_template INTEGER NOT NULL DEFAULT 0")
                db.execSQL("ALTER TABLE workouts ADD COLUMN cycle_label TEXT NOT NULL DEFAULT ''")
                db.execSQL("ALTER TABLE workouts ADD COLUMN result_distance_km REAL")
                db.execSQL("ALTER TABLE workouts ADD COLUMN result_duration_sec INTEGER")
                db.execSQL("ALTER TABLE workouts ADD COLUMN result_pace_avg_min_per_km REAL")
                db.execSQL("ALTER TABLE workouts ADD COLUMN result_hr_avg INTEGER")
                db.execSQL("ALTER TABLE workouts ADD COLUMN result_rpe INTEGER")
                db.execSQL("ALTER TABLE workouts ADD COLUMN result_notes TEXT NOT NULL DEFAULT ''")
                db.execSQL("ALTER TABLE workout_blocks ADD COLUMN target_pace_max_min_per_km REAL")
                db.execSQL("ALTER TABLE workout_blocks ADD COLUMN target_hr_min INTEGER")
                db.execSQL("ALTER TABLE workout_blocks ADD COLUMN target_hr_max INTEGER")
                db.execSQL("ALTER TABLE workout_blocks ADD COLUMN target_type TEXT NOT NULL DEFAULT 'none'")
                db.execSQL("ALTER TABLE workout_blocks ADD COLUMN distance_m INTEGER")
                db.execSQL("ALTER TABLE workout_blocks ADD COLUMN distance_unit TEXT NOT NULL DEFAULT 'km'")
                db.execSQL("ALTER TABLE workout_blocks ADD COLUMN duration_unit TEXT NOT NULL DEFAULT 'min'")
                db.execSQL("ALTER TABLE workout_blocks ADD COLUMN recovery_distance_m INTEGER")
                db.execSQL("ALTER TABLE workout_blocks ADD COLUMN recovery_duration_sec INTEGER")
                db.execSQL("ALTER TABLE workout_blocks ADD COLUMN interval_rep_results_json TEXT NOT NULL DEFAULT ''")
            }
        }

        // v7 → v8 : ajout results_json sur run_repeats pour persister les validations par intervalle
        val MIGRATION_7_8 = object : Migration(7, 8) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("ALTER TABLE run_repeats ADD COLUMN results_json TEXT NOT NULL DEFAULT ''")
            }
        }

        // v8 → v9 : ajout reps_type sur exercices_seance et seance_category sur seances
        val MIGRATION_8_9 = object : Migration(8, 9) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("ALTER TABLE exercices_seance ADD COLUMN reps_type TEXT NOT NULL DEFAULT 'REPS'")
                db.execSQL("ALTER TABLE seances ADD COLUMN seance_category TEXT NOT NULL DEFAULT 'STRENGTH'")
            }
        }

        // v9 → v10 : ajout duration_seconds sur instances_seance
        val MIGRATION_9_10 = object : Migration(9, 10) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("ALTER TABLE instances_seance ADD COLUMN duration_seconds INTEGER NOT NULL DEFAULT 0")
            }
        }

        // v10 → v11 : ajout FCmax et dénivelé sur workouts
        val MIGRATION_10_11 = object : Migration(10, 11) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("ALTER TABLE workouts ADD COLUMN result_hr_max INTEGER")
                db.execSQL("ALTER TABLE workouts ADD COLUMN result_elevation_m INTEGER")
            }
        }

        // v6 → v7 : nouvelles tables run_repeats et run_steps pour le modèle Garmin Connect
        val MIGRATION_6_7 = object : Migration(6, 7) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL(
                    """CREATE TABLE IF NOT EXISTS `run_repeats` (
                        `id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                        `workout_id` INTEGER NOT NULL,
                        `position` INTEGER NOT NULL,
                        `repeat_count` INTEGER NOT NULL,
                        FOREIGN KEY(`workout_id`) REFERENCES `workouts`(`id`) ON DELETE CASCADE
                    )"""
                )
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_run_repeats_workout_id` ON `run_repeats` (`workout_id`)")
                db.execSQL(
                    """CREATE TABLE IF NOT EXISTS `run_steps` (
                        `id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                        `workout_id` INTEGER NOT NULL,
                        `repeat_id` INTEGER,
                        `position` INTEGER NOT NULL,
                        `step_type` TEXT NOT NULL,
                        `end_type` TEXT NOT NULL,
                        `end_value` INTEGER NOT NULL,
                        `end_unit` TEXT NOT NULL,
                        `note` TEXT,
                        `target_type` TEXT NOT NULL,
                        `target_min` INTEGER,
                        `target_max` INTEGER,
                        FOREIGN KEY(`workout_id`) REFERENCES `workouts`(`id`) ON DELETE CASCADE,
                        FOREIGN KEY(`repeat_id`) REFERENCES `run_repeats`(`id`) ON DELETE CASCADE
                    )"""
                )
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_run_steps_workout_id` ON `run_steps` (`workout_id`)")
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_run_steps_repeat_id` ON `run_steps` (`repeat_id`)")
            }
        }

        // v11 → v12 : ajout results_json sur run_steps pour valider les étapes libres
        val MIGRATION_11_12 = object : Migration(11, 12) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("ALTER TABLE run_steps ADD COLUMN results_json TEXT NOT NULL DEFAULT ''")
            }
        }

        // v12 → v13 : isolation complète template / instance (copies indépendantes à l'affectation)
        val MIGRATION_12_13 = object : Migration(12, 13) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("ALTER TABLE blocs_seance ADD COLUMN instance_seance_id INTEGER")
                db.execSQL("ALTER TABLE exercices_seance ADD COLUMN instance_seance_id INTEGER")
                db.execSQL("CREATE INDEX IF NOT EXISTS index_blocs_seance_instance ON blocs_seance(instance_seance_id)")
                db.execSQL("CREATE INDEX IF NOT EXISTS index_exercices_seance_instance ON exercices_seance(instance_seance_id)")
            }
        }

        // v13 → v14 : ajout de la table gps_track_points pour les tracés importés depuis TCX
        val MIGRATION_13_14 = object : Migration(13, 14) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL(
                    """CREATE TABLE IF NOT EXISTS `gps_track_points` (
                        `id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                        `workout_id` INTEGER NOT NULL,
                        `point_index` INTEGER NOT NULL,
                        `latitude` REAL NOT NULL,
                        `longitude` REAL NOT NULL,
                        `altitude_m` REAL,
                        FOREIGN KEY(`workout_id`) REFERENCES `workouts`(`id`) ON DELETE CASCADE
                    )"""
                )
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_gps_track_points_workout_id` ON `gps_track_points` (`workout_id`)")
            }
        }
    }
}
