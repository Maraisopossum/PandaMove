package com.pandafit.core.database.export

/**
 * Granularité simple exposée à l'utilisateur pour les cases à cocher export/import —
 * un module regroupe plusieurs sous-champs d'[ExportOptions]/[ImportOptions] cochés/décochés ensemble.
 */
enum class DataCategory {
    STRENGTH, RUNNING, CYCLING, HIKING, BREATHING,
    CUSTOM_EXERCISES, PROGRESSION_OBJECTIVES, EQUIPMENT,
}

/** Construit un [ExportOptions] où seuls les modules de [selected] sont activés. */
fun ExportOptions.Companion.forCategories(selected: Set<DataCategory>): ExportOptions = ExportOptions(
    strengthTemplates    = DataCategory.STRENGTH in selected,
    strengthCompleted    = DataCategory.STRENGTH in selected,
    strengthPlanned      = DataCategory.STRENGTH in selected,
    runningTemplates     = DataCategory.RUNNING in selected,
    runningCompleted     = DataCategory.RUNNING in selected,
    runningPlanned       = DataCategory.RUNNING in selected,
    cyclingTemplates     = DataCategory.CYCLING in selected,
    cyclingCompleted     = DataCategory.CYCLING in selected,
    cyclingPlanned       = DataCategory.CYCLING in selected,
    hikingTemplates      = DataCategory.HIKING in selected,
    hikingCompleted      = DataCategory.HIKING in selected,
    hikingPlanned        = DataCategory.HIKING in selected,
    breathingSessions    = DataCategory.BREATHING in selected,
    customExercises      = DataCategory.CUSTOM_EXERCISES in selected,
    objectifsProgression = DataCategory.PROGRESSION_OBJECTIVES in selected,
    equipmentConfig      = DataCategory.EQUIPMENT in selected,
)

/** Construit un [ImportOptions] où seuls les modules de [selected] sont activés. */
fun ImportOptions.Companion.forCategories(selected: Set<DataCategory>): ImportOptions = ImportOptions(
    strengthTemplates    = DataCategory.STRENGTH in selected,
    strengthSessions     = DataCategory.STRENGTH in selected,
    runningTemplates     = DataCategory.RUNNING in selected,
    runningSessions      = DataCategory.RUNNING in selected,
    cyclingTemplates     = DataCategory.CYCLING in selected,
    cyclingSessions      = DataCategory.CYCLING in selected,
    hikingTemplates      = DataCategory.HIKING in selected,
    hikingSessions       = DataCategory.HIKING in selected,
    breathingSessions    = DataCategory.BREATHING in selected,
    customExercises      = DataCategory.CUSTOM_EXERCISES in selected,
    objectifsProgression = DataCategory.PROGRESSION_OBJECTIVES in selected,
    equipmentConfig      = DataCategory.EQUIPMENT in selected,
)
