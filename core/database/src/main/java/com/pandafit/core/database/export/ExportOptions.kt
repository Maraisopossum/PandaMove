package com.pandafit.core.database.export

/**
 * Paramètres de sélection pour [DataExportManager.export].
 * Chaque flag à `false` exclut la section correspondante du fichier JSON généré.
 */
data class ExportOptions(
    val strengthTemplates: Boolean = true,
    val strengthCompleted: Boolean = true,
    val strengthPlanned: Boolean = true,
    val runningTemplates: Boolean = true,
    val runningCompleted: Boolean = true,
    val runningPlanned: Boolean = true,
    val cyclingTemplates: Boolean = true,
    val cyclingCompleted: Boolean = true,
    val cyclingPlanned: Boolean = true,
    val customExercises: Boolean = true,
) {
    companion object {
        /** Exporte toutes les données (comportement par défaut). */
        val ALL = ExportOptions()

        /** Uniquement les séances-types — aucune session réalisée ni planifiée. */
        val TEMPLATES_ONLY = ExportOptions(
            strengthCompleted = false, strengthPlanned = false,
            runningCompleted = false, runningPlanned = false,
            cyclingCompleted = false, cyclingPlanned = false,
        )

        /** Uniquement les sessions (réalisées + planifiées), sans les templates. */
        val SESSIONS_ONLY = ExportOptions(
            strengthTemplates = false,
            runningTemplates = false,
            cyclingTemplates = false,
        )
    }
}

/**
 * Paramètres de sélection pour [DataImportManager.import].
 * Chaque flag à `false` ignore la section correspondante lors de l'import.
 */
data class ImportOptions(
    val strengthTemplates: Boolean = true,
    val strengthSessions: Boolean = true,
    val runningTemplates: Boolean = true,
    val runningSessions: Boolean = true,
    val cyclingTemplates: Boolean = true,
    val cyclingSessions: Boolean = true,
    val customExercises: Boolean = true,
) {
    companion object {
        /** Importe toutes les données (comportement par défaut). */
        val ALL = ImportOptions()

        /** Importe uniquement les séances-types. */
        val TEMPLATES_ONLY = ImportOptions(
            strengthSessions = false,
            runningSessions = false,
            cyclingSessions = false,
        )
    }
}
