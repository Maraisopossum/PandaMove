package com.pandafit.core.database

import androidx.room.testing.MigrationTestHelper
import androidx.sqlite.db.SupportSQLiteDatabase
import androidx.sqlite.db.framework.FrameworkSQLiteOpenHelperFactory
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * Vérifie que la chaîne de migrations manuelles (v3 → version courante) s'applique sans
 * exception ni divergence de schéma. `runMigrationsAndValidate(..., validateDroppedTables = true)`
 * compare le schéma obtenu à celui exporté dans schemas/ (voir room { schemaDirectory(...) }
 * dans build.gradle.kts) — toute colonne/table manquante ou en trop fait échouer le test.
 *
 * Tourne en JVM via Robolectric (pas d'émulateur requis) : couvert par `./gradlew test` en CI.
 */
@RunWith(RobolectricTestRunner::class)
@Config(manifest = Config.NONE)
class PandaFitDatabaseMigrationTest {

    @get:Rule
    val helper: MigrationTestHelper = MigrationTestHelper(
        InstrumentationRegistry.getInstrumentation(),
        PandaFitDatabase::class.java.canonicalName,
        FrameworkSQLiteOpenHelperFactory(),
    )

    @Test
    fun migrateAll_fromV3ToCurrent_succeedsWithoutDataLoss() {
        helper.createDatabase(TEST_DB, 3).close()

        val db = helper.runMigrationsAndValidate(TEST_DB, CURRENT_VERSION, true, *ALL_MIGRATIONS)
        db.close()
    }

    @Test
    fun migrate19to20_addsGpsTrackPointColumns() {
        helper.createDatabase(TEST_DB, 19).close()

        val db = helper.runMigrationsAndValidate(TEST_DB, 20, true, PandaFitDatabase.MIGRATION_19_20)
        assertTrue(db.hasColumn("gps_track_points", "timestamp_ms"))
        assertTrue(db.hasColumn("gps_track_points", "speed_mps"))
        assertTrue(db.hasColumn("gps_track_points", "accuracy_m"))
        db.close()
    }

    @Test
    fun migrate20to21_addsProgressionModule() {
        helper.createDatabase(TEST_DB, 20).close()

        val db = helper.runMigrationsAndValidate(TEST_DB, 21, true, PandaFitDatabase.MIGRATION_20_21)
        assertTrue(db.hasColumn("exercices_seance", "progression_activee"))
        assertTrue(db.hasColumn("exercices_seance", "seuil_deload"))
        assertTrue(db.hasTable("objectifs_progression"))
        db.close()
    }

    @Test
    fun migrate24to25_addsWorkoutSourceColumn() {
        helper.createDatabase(TEST_DB, 24).close()

        val db = helper.runMigrationsAndValidate(TEST_DB, 25, true, PandaFitDatabase.MIGRATION_24_25)
        assertTrue(db.hasColumn("workouts", "source"))
        db.close()
    }

    @Test
    fun migrate25to26_addsRunRepeatIsAutoLapColumn() {
        helper.createDatabase(TEST_DB, 25).close()

        val db = helper.runMigrationsAndValidate(TEST_DB, 26, true, PandaFitDatabase.MIGRATION_25_26)
        assertTrue(db.hasColumn("run_repeats", "is_auto_lap"))
        db.close()
    }

    companion object {
        private const val TEST_DB = "migration-test"
        private const val CURRENT_VERSION = 26

        private val ALL_MIGRATIONS = arrayOf(
            PandaFitDatabase.MIGRATION_3_4,
            PandaFitDatabase.MIGRATION_4_5,
            PandaFitDatabase.MIGRATION_5_6,
            PandaFitDatabase.MIGRATION_6_7,
            PandaFitDatabase.MIGRATION_7_8,
            PandaFitDatabase.MIGRATION_8_9,
            PandaFitDatabase.MIGRATION_9_10,
            PandaFitDatabase.MIGRATION_10_11,
            PandaFitDatabase.MIGRATION_11_12,
            PandaFitDatabase.MIGRATION_12_13,
            PandaFitDatabase.MIGRATION_13_14,
            PandaFitDatabase.MIGRATION_14_15,
            PandaFitDatabase.MIGRATION_15_16,
            PandaFitDatabase.MIGRATION_16_17,
            PandaFitDatabase.MIGRATION_17_18,
            PandaFitDatabase.MIGRATION_18_19,
            PandaFitDatabase.MIGRATION_19_20,
            PandaFitDatabase.MIGRATION_20_21,
            PandaFitDatabase.MIGRATION_21_22,
            PandaFitDatabase.MIGRATION_22_23,
            PandaFitDatabase.MIGRATION_23_24,
            PandaFitDatabase.MIGRATION_24_25,
            PandaFitDatabase.MIGRATION_25_26,
        )
    }
}

private fun SupportSQLiteDatabase.hasColumn(table: String, column: String): Boolean {
    query("PRAGMA table_info(`$table`)").use { cursor ->
        val nameIdx = cursor.getColumnIndex("name")
        while (cursor.moveToNext()) {
            if (cursor.getString(nameIdx) == column) return true
        }
    }
    return false
}

private fun SupportSQLiteDatabase.hasTable(table: String): Boolean {
    query("SELECT name FROM sqlite_master WHERE type='table' AND name=?", arrayOf(table)).use { cursor ->
        return cursor.count > 0
    }
}
