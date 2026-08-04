package com.pandafit.core.database.export

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class DataCategoryTest {

    @Test
    fun `forCategories active uniquement les sous-champs export du module choisi`() {
        val options = ExportOptions.forCategories(setOf(DataCategory.RUNNING))

        assertTrue(options.runningTemplates)
        assertTrue(options.runningCompleted)
        assertTrue(options.runningPlanned)
        assertFalse(options.strengthTemplates)
        assertFalse(options.cyclingTemplates)
        assertFalse(options.breathingSessions)
        assertFalse(options.customExercises)
        assertFalse(options.equipmentConfig)
    }

    @Test
    fun `forCategories active uniquement les sous-champs import du module choisi`() {
        val options = ImportOptions.forCategories(setOf(DataCategory.EQUIPMENT, DataCategory.BREATHING))

        assertTrue(options.equipmentConfig)
        assertTrue(options.breathingSessions)
        assertFalse(options.strengthTemplates)
        assertFalse(options.strengthSessions)
        assertFalse(options.runningTemplates)
        assertFalse(options.customExercises)
    }

    @Test
    fun `aucune categorie selectionnee desactive tout`() {
        val options = ExportOptions.forCategories(emptySet())
        assertEquals(ExportOptions(
            strengthTemplates = false, strengthCompleted = false, strengthPlanned = false,
            runningTemplates = false, runningCompleted = false, runningPlanned = false,
            cyclingTemplates = false, cyclingCompleted = false, cyclingPlanned = false,
            hikingTemplates = false, hikingCompleted = false, hikingPlanned = false,
            breathingSessions = false, customExercises = false,
            objectifsProgression = false, equipmentConfig = false,
        ), options)
    }
}
