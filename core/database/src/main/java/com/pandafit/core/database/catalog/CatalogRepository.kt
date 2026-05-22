package com.pandafit.core.database.catalog

import com.pandafit.core.database.dao.ExerciseDao
import com.pandafit.core.database.entities.ExerciseCategory
import com.pandafit.core.database.entities.ExerciseEntity
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class CatalogRepository @Inject constructor(
    private val exerciseDao: ExerciseDao,
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    private val _seeded = MutableStateFlow(false)
    val seeded = _seeded.asStateFlow()

    init {
        scope.launch { seedIfNeeded() }
    }

    private suspend fun seedIfNeeded() {
        if (exerciseDao.countCatalogExercises() == 0) {
            val entities = MuscuCatalog.exercises.map { it.toEntity() }
            exerciseDao.insertAll(entities)
        } else {
            // Migration : les exercices seedés via ExerciseSeeder n'ont pas de données
            // d'équipement. On les met à jour si le champ est vide.
            val catalogByName = MuscuCatalog.exercises.associateBy { it.nom }
            exerciseDao.getAllCatalogExercises()
                .filter { it.equipment.isEmpty() }
                .forEach { exercise ->
                    val catalog = catalogByName[exercise.name] ?: return@forEach
                    exerciseDao.updateExercise(
                        exercise.copy(
                            equipment = catalog.equipment,
                            exerciseType = catalog.type,
                            muscleGroups = catalog.muscles,
                            musclePrimary = catalog.muscles.firstOrNull() ?: exercise.musclePrimary,
                        )
                    )
                }
        }
        _seeded.value = true
    }

    fun observeAll(): Flow<List<ExerciseEntity>> = exerciseDao.observeAll()
}

private fun CatalogExercise.toEntity(): ExerciseEntity {
    val primary = muscles.firstOrNull() ?: ""
    val category = muscleToGroup(primary).toExerciseCategory()
    return ExerciseEntity(
        name = nom,
        category = category,
        muscleGroups = muscles,
        isCustom = false,
        exerciseType = type,
        equipment = equipment,
        musclePrimary = primary,
    )
}

private fun MuscleGroup.toExerciseCategory(): ExerciseCategory = when (this) {
    MuscleGroup.PECTORAUX -> ExerciseCategory.CHEST
    MuscleGroup.DOS -> ExerciseCategory.BACK
    MuscleGroup.EPAULES -> ExerciseCategory.SHOULDERS
    MuscleGroup.BICEPS -> ExerciseCategory.BICEPS
    MuscleGroup.TRICEPS -> ExerciseCategory.TRICEPS
    MuscleGroup.QUADRICEPS, MuscleGroup.ISCHIO,
    MuscleGroup.FESSIERS, MuscleGroup.MOLLETS -> ExerciseCategory.LEGS
    MuscleGroup.ABDOMINAUX -> ExerciseCategory.CORE
    else -> ExerciseCategory.OTHER
}
