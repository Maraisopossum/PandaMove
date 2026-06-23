package com.pandafit.core.database.catalog

import org.junit.Assert.assertEquals
import org.junit.Test

class EquipmentInventoryTest {

    @Test
    fun `disques - combinatoire simple sur une seule denomination`() {
        // Barre 20kg + 4 disques de 2.5kg (2 paires) -> 20, 25, 30
        val config = DisquesConfig(barreKg = 20f, disques = mapOf(2.5f to 4))
        assertEquals(listOf(20f, 25f, 30f), config.chargesAtteignables())
    }

    @Test
    fun `disques - combinatoire sur plusieurs denominations`() {
        // Barre 20kg + 2x1.25 (1 paire) + 4x2.5 (2 paires)
        // paires 1.25 : 0 ou 1 -> +0 ou +2.5
        // paires 2.5 : 0,1,2 -> +0, +5, +10
        val config = DisquesConfig(barreKg = 20f, disques = mapOf(1.25f to 2, 2.5f to 4))
        val attendu = listOf(20f, 22.5f, 25f, 27.5f, 30f, 32.5f)
        assertEquals(attendu, config.chargesAtteignables())
    }

    @Test
    fun `disques - une quantite impaire ignore le disque depareille`() {
        // 3 disques de 5kg -> seulement 1 paire utilisable (le 3e dispo n'a pas de jumeau)
        val config = DisquesConfig(barreKg = 20f, disques = mapOf(5f to 3))
        assertEquals(listOf(20f, 30f), config.chargesAtteignables())
    }

    @Test
    fun `disques - aucun disque renvoie juste le poids de la barre`() {
        val config = DisquesConfig(barreKg = 20f, disques = emptyMap())
        assertEquals(listOf(20f), config.chargesAtteignables())
    }

    @Test
    fun `plage - sequence arithmetique inclut toujours le max`() {
        val config = PlageConfig(minKg = 8f, maxKg = 20f, pasKg = 4f)
        assertEquals(listOf(8f, 12f, 16f, 20f), config.chargesAtteignables())
    }

    @Test
    fun `plage - max non multiple du pas est tout de meme inclus`() {
        val config = PlageConfig(minKg = 5f, maxKg = 22f, pasKg = 5f)
        assertEquals(listOf(5f, 10f, 15f, 20f, 22f), config.chargesAtteignables())
    }

    @Test
    fun `halteres - union des poids fixes et des combinaisons chargeables sans doublon`() {
        val config = HalteresConfig(
            poidsFixes = listOf(4f, 6f, 8f),
            chargeable = DisquesConfig(barreKg = 1f, disques = mapOf(2.5f to 4)), // 1, 6, 11
        )
        // poidsFixes [4,6,8] U chargeable [1,6,11] = [1,4,6,8,11] (6 dédupliqué)
        assertEquals(listOf(1f, 4f, 6f, 8f, 11f), config.chargesAtteignables())
    }

    @Test
    fun `inventaire - dispatch par categorie et null pour les categories sans inventaire`() {
        val inventaire = EquipmentInventaire(
            halteres = HalteresConfig(poidsFixes = listOf(4f, 8f)),
            barre = DisquesConfig(barreKg = 20f, disques = mapOf(5f to 4)),
            kettlebell = PlageConfig(8f, 16f, 4f),
            cable = null,
        )
        assertEquals(listOf(4f, 8f), inventaire.chargesAtteignablesPour(EquipmentCategory.HALTERES))
        assertEquals(listOf(20f, 30f, 40f), inventaire.chargesAtteignablesPour(EquipmentCategory.BARRE))
        assertEquals(listOf(8f, 12f, 16f), inventaire.chargesAtteignablesPour(EquipmentCategory.KETTLEBELL))
        assertEquals(null, inventaire.chargesAtteignablesPour(EquipmentCategory.CABLE))
        assertEquals(null, inventaire.chargesAtteignablesPour(EquipmentCategory.MACHINE))
    }
}
