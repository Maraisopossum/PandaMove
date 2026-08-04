package com.pandafit.core.database.activityimport

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class ActivityFileDetectorTest {

    @Test
    fun `detecte un fichier TCX via son tag racine`() {
        val xml = """<?xml version="1.0" encoding="UTF-8"?>
            <TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2">
            </TrainingCenterDatabase>""".trimIndent()
        assertEquals(ActivityFileFormat.TCX, detectActivityFormat(xml.toByteArray(Charsets.UTF_8)))
    }

    @Test
    fun `detecte un fichier GPX via son tag racine`() {
        val xml = """<?xml version="1.0" encoding="UTF-8"?>
            <gpx version="1.1" creator="Strava">
            </gpx>""".trimIndent()
        assertEquals(ActivityFileFormat.GPX, detectActivityFormat(xml.toByteArray(Charsets.UTF_8)))
    }

    @Test
    fun `detecte un fichier FIT via la signature dans le header`() {
        // Header FIT minimal : 12 octets, signature ".FIT" a l'offset 8.
        val header = byteArrayOf(
            14, 0x10.toByte(), 0, 0, 0, 0, 0, 0, // taille header + version protocole + version profil + taille data (factices)
            '.'.code.toByte(), 'F'.code.toByte(), 'I'.code.toByte(), 'T'.code.toByte(),
        )
        assertEquals(ActivityFileFormat.FIT, detectActivityFormat(header))
    }

    @Test
    fun `retourne null pour un contenu non reconnu`() {
        assertNull(detectActivityFormat("n'importe quoi".toByteArray(Charsets.UTF_8)))
    }

    @Test
    fun `retourne null pour un fichier trop court`() {
        assertNull(detectActivityFormat(byteArrayOf(1, 2, 3)))
    }
}
