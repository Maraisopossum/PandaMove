package com.pandafit.core.database.catalog

enum class MuscleGroup(val label: String, val colorArgb: Long) {
    PECTORAUX("Pectoraux",    0xFFE57373L),
    DOS("Dos",                0xFF4DB6ACL),
    TRAPEZES("Trapèzes",      0xFF5C6BC0L),
    LOMBAIRES("Lombaires",    0xFF8D6E63L),
    EPAULES("Épaules",        0xFF64B5F6L),
    BICEPS("Biceps",          0xFF9575CDL),
    TRICEPS("Triceps",        0xFFFFB74DL),
    QUADRICEPS("Quadriceps",  0xFFFFD54FL),
    ISCHIO("Ischio-jambiers", 0xFFFF8A65L),
    FESSIERS("Fessiers",      0xFFF06292L),
    ADDUCTEURS("Adducteurs",  0xFFEC407AL),
    MOLLETS("Mollets",        0xFF81C784L),
    ABDOMINAUX("Abdominaux",  0xFFAED581L),
    OBLIQUES("Obliques",      0xFF26A69AL),
    AVANT_BRAS("Avant-bras",  0xFFA1887FL),
    AUTRE("Autre",            0xFF90A4AEL),
}

/**
 * Mappe un nom de muscle (issu du fichier Excel) vers un groupe musculaire simplifié.
 * Les 36 valeurs uniques du fichier ont toutes été vérifiées contre cette fonction.
 */
fun muscleToGroup(muscle: String): MuscleGroup {
    val m = muscle.trim()
    if (m.isBlank()) return MuscleGroup.AUTRE
    return when {
        // Pectoraux — "Pectoraux", "Pectoraux (chef claviculaire)", "(chef sternal)", "(grand)"
        m.startsWith("Pectoral", ignoreCase = true) ||
            m.startsWith("Pecto", ignoreCase = true) -> MuscleGroup.PECTORAUX

        // Triceps — avant Biceps pour éviter que "Triceps" matche une branche Biceps
        m.startsWith("Triceps", ignoreCase = true) -> MuscleGroup.TRICEPS

        // Trapèzes — Trapèze (toutes variantes), Rhomboïdes — avant DOS
        m.contains("Trapèze", ignoreCase = true) ||
            m.contains("Trapeze", ignoreCase = true) ||
            m.contains("Rhomboï", ignoreCase = true) ||
            m.contains("Rhomboi", ignoreCase = true) -> MuscleGroup.TRAPEZES

        // Lombaires — Érecteurs du rachis — avant DOS
        m.contains("rachis", ignoreCase = true) ||
            m.contains("Lombaire", ignoreCase = true) -> MuscleGroup.LOMBAIRES

        // Dos — Grand dorsal, Infra-épineux, Deltoïde postérieur
        m.contains("Grand dorsal", ignoreCase = true) ||
            m.contains("Infra-", ignoreCase = true) ||
            m.contains("postérieur", ignoreCase = true) ||
            m.contains("posterieur", ignoreCase = true) -> MuscleGroup.DOS

        // Épaules — Deltoïde ant/médial, Épaules
        m.startsWith("Deltoi", ignoreCase = true) ||
            m.startsWith("Deltoï", ignoreCase = true) ||
            m.equals("Épaules", ignoreCase = true) ||
            m.equals("Epaules", ignoreCase = true) ||
            m.equals("Deltoïdes", ignoreCase = true) -> MuscleGroup.EPAULES

        // Biceps — Biceps brachial (toutes variantes), Brachial
        m.startsWith("Biceps", ignoreCase = true) ||
            m.equals("Brachial", ignoreCase = true) -> MuscleGroup.BICEPS

        // Quadriceps
        m.equals("Quadriceps", ignoreCase = true) -> MuscleGroup.QUADRICEPS

        // Ischio-jambiers
        m.contains("Ischio", ignoreCase = true) -> MuscleGroup.ISCHIO

        // Adducteurs — avant Fessiers
        m.equals("Adducteurs", ignoreCase = true) -> MuscleGroup.ADDUCTEURS

        // Fessiers
        m.startsWith("Fessier", ignoreCase = true) -> MuscleGroup.FESSIERS

        // Mollets — Gastrocnémien, Soléaire, Tibial antérieur
        m.contains("Gastro", ignoreCase = true) ||
            m.contains("ol", ignoreCase = true) && m.contains("aire", ignoreCase = true) ||
            m.contains("Tibial", ignoreCase = true) -> MuscleGroup.MOLLETS

        // Obliques — avant Abdominaux
        m.equals("Obliques", ignoreCase = true) -> MuscleGroup.OBLIQUES

        // Abdominaux — Droit abdominal, Transverse, Iliopsoas
        m.contains("abdomin", ignoreCase = true) ||
            m.equals("Transverse", ignoreCase = true) ||
            m.equals("Iliopsoas", ignoreCase = true) -> MuscleGroup.ABDOMINAUX

        // Avant-bras — Extenseurs/Fléchisseurs du carpe, Avant-bras (grip), Brachioradial
        m.contains("Extenseur", ignoreCase = true) ||
            m.contains("chisseur", ignoreCase = true) ||
            m.contains("Avant-bras", ignoreCase = true) ||
            m.contains("grip", ignoreCase = true) ||
            m.startsWith("Brachio", ignoreCase = true) -> MuscleGroup.AVANT_BRAS

        else -> MuscleGroup.AUTRE
    }
}
