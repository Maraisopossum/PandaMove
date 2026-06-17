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
    val hikingTemplates: Boolean = true,
    val hikingCompleted: Boolean = true,
    val hikingPlanned: Boolean = true,
    val breathingSessions: Boolean = true,
    val customExercises: Boolean = true,
) {
    companion object {
        val ALL = ExportOptions()

        val TEMPLATES_ONLY = ExportOptions(
            strengthCompleted = false, strengthPlanned = false,
            runningCompleted = false, runningPlanned = false,
            cyclingCompleted = false, cyclingPlanned = false,
            hikingCompleted = false, hikingPlanned = false,
            breathingSessions = false,
        )

        val SESSIONS_ONLY = ExportOptions(
            strengthTemplates = false,
            runningTemplates = false,
            cyclingTemplates = false,
            hikingTemplates = false,
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
    val hikingTemplates: Boolean = true,
    val hikingSessions: Boolean = true,
    val breathingSessions: Boolean = true,
    val customExercises: Boolean = true,
) {
    companion object {
        val ALL = ImportOptions()

        val TEMPLATES_ONLY = ImportOptions(
            strengthSessions = false,
            runningSessions = false,
            cyclingSessions = false,
            hikingSessions = false,
            breathingSessions = false,
        )
    }
}
