package com.pandafit.feature.strength.model

import com.pandafit.core.database.catalog.MuscleGroup
import com.pandafit.core.database.entities.BlocSeanceEntity
import com.pandafit.core.database.entities.BlocType
import com.pandafit.core.database.entities.ExerciseEntity
import com.pandafit.core.database.entities.InstanceSeanceEntity
import com.pandafit.core.database.entities.ObjectifProgressionEntity
import com.pandafit.core.database.entities.RepsType
import com.pandafit.core.database.entities.SeanceCategory
import com.pandafit.core.database.entities.SeanceEntity
import com.pandafit.core.database.entities.SerieRealiseeEntity
import com.pandafit.core.database.entities.SystemeProgression
import com.pandafit.core.database.progression.PropositionProgression
import com.pandafit.core.database.relations.ExerciceSeanceWithExercise
import java.time.LocalDate

// ===== Helpers charge =====

val CHARGE_OPTIONS: List<String> = listOf("PDC", "Élastique") + (1..100).map { "$it kg" }

fun parseChargeKg(label: String?): Float? = when {
    label.isNullOrBlank() || label == "PDC" || label == "Élastique" -> null
    else -> label.replace(" kg", "").toFloatOrNull()
}

fun parseChargeLabel(chargeCible: String): String {
    val cleaned = chargeCible.trim()
    if (cleaned.isEmpty()) return "PDC"
    if (cleaned.equals("PDC", ignoreCase = true) || cleaned.equals("Poids corps", ignoreCase = true)) return "PDC"
    if (cleaned.equals("Élastique", ignoreCase = true) || cleaned.equals("Elastique", ignoreCase = true)) return "Élastique"
    val kg = cleaned.replace(" kg", "").replace(",", ".").toIntOrNull()
    if (kg != null && kg in 1..100) return "$kg kg"
    return cleaned
}

// ===== Liste des séances =====

data class SeanceListUiState(
    val isLoading: Boolean = true,
    val seances: List<SeanceEntity> = emptyList(),
    val instances: List<InstanceSeanceEntity> = emptyList(),
    val seancesById: Map<Long, SeanceEntity> = emptyMap(),
    val error: String? = null,
)

// ===== Liste unifiée exercices + blocs =====

sealed class SeanceItem {
    data class FreeExercise(val exercice: ExerciceDraft) : SeanceItem()
    data class Bloc(val bloc: BlocDraft) : SeanceItem()
}

// ===== Création / Édition =====

data class SeanceCreateUiState(
    val isLoading: Boolean = false,
    val isSaving: Boolean = false,
    val isNew: Boolean = true,
    val nom: String = "",
    val notes: String = "",
    val dureeEstimeeMin: Int = 60,
    val items: List<SeanceItem> = emptyList(), // liste unifiée, ordre global
    val savedSeanceId: Long? = null,
    val error: String? = null,
    val showExercisePicker: Boolean = false,
    val pickerTargetItemIndex: Int = -1, // index dans items ou -1 = libre à la fin
    val availableExercises: List<ExerciseEntity> = emptyList(),
    val exercisePickerQuery: String = "",
    // Multi-sélection
    val multiSelectedIds: Set<Long> = emptySet(),
    val pickerGroupFilter: MuscleGroup? = null,
    val pickerOnlyAvailable: Boolean = false,
    val userEquipment: Set<com.pandafit.core.database.catalog.EquipmentCategory> = emptySet(),
    val seanceCategory: SeanceCategory = SeanceCategory.STRENGTH,
    val availableWarmups: List<SeanceEntity> = emptyList(),
    val showWarmupPicker: Boolean = false,
) {
    // Helpers de compatibilité
    val exercicesLibres: List<ExerciceDraft>
        get() = items.filterIsInstance<SeanceItem.FreeExercise>().map { it.exercice }
    val blocs: List<BlocDraft>
        get() = items.filterIsInstance<SeanceItem.Bloc>().map { it.bloc }
}

data class BlocDraft(
    val id: Long = 0,
    val nom: String = "",
    val type: BlocType = BlocType.ECHAUFFEMENT,
    val dureeMin: Int? = null,
    val description: String = "",
    val tempsReposInterSec: Int = 20,
    val tempsReposFinRoundSec: Int = 120,
    val exercices: List<ExerciceDraft> = emptyList(),
    /**
     * Nombre de séries centralisé pour les blocs CIRCUIT uniquement.
     * Stocké par exercice en DB ; dérivé du premier exercice au chargement,
     * propagé à tous les exercices à la sauvegarde.
     */
    val nombreSeriesPrevues: Int = 3,
)

data class ExerciceDraft(
    val id: Long = 0,
    val exercise: ExerciseEntity,
    val supersetGroupe: String? = null,
    val position: Int = 0,
    val nombreSeriesPrevues: Int = 3,
    val repsCibles: String = "",
    val repsType: RepsType = RepsType.REPS,
    val chargeCible: String = "",
    val tempo: String = "",
    val tempsReposSec: Int = 90,
    val consigneCle: String = "",
    val equipement: String = "",
    val avertissement: String = "",
    // Exercice bilatéral : G et D alternent à chaque round (S1G+S1D, S2G+S2D…)
    val isBilateral: Boolean = false,
    // Surcharge progressive
    val progressionActivee: Boolean = false,
    val systemeProgression: SystemeProgression? = null,
    val repsMin: Int? = null,
    val repsMax: Int? = null,
    val incrementKg: Float? = null,
    val incrementDureeSec: Int = 5,
    val seuilDeload: Int = 3,
)

// ===== Détail (lecture seule) =====

data class SeanceDetailUiState(
    val isLoading: Boolean = true,
    val seance: SeanceEntity? = null,
    val blocs: List<BlocSeanceEntity> = emptyList(),
    val exercices: List<ExerciceSeanceWithExercise> = emptyList(),
    val instances: List<InstanceSeanceEntity> = emptyList(),
    // Surcharge progressive — clé = exercise_id (catalogue)
    val objectifsParExercice: Map<Long, ObjectifProgressionEntity> = emptyMap(),
    val tendanceParExercice: Map<Long, List<Float>> = emptyMap(),
    val error: String? = null,
) {
    fun exercicesForBloc(blocId: Long?): List<ExerciceSeanceWithExercise> =
        exercices.filter { it.exerciceSeance.blocId == blocId }.sortedBy { it.exerciceSeance.position }

    val exercicesSansBloc: List<ExerciceSeanceWithExercise>
        get() = exercices.filter { it.exerciceSeance.blocId == null }.sortedBy { it.exerciceSeance.position }
}

// ===== Exécution d'une instance =====

// ── Mode Circuit automatique ──────────────────────────────────────────────────

sealed class CircuitPhase {
    /** Un exercice est en cours de décompte. */
    data class ExerciceActif(
        val exerciceId: Long,
        val exerciceName: String,
        val numeroSerie: Int,       // numéro de round (1-based), pas de slot
        val totalSeries: Int,       // nombre de rounds prévus
        val positionInBloc: Int,    // position dans le circuit (1-based)
        val totalInBloc: Int,       // nombre d'exercices dans le circuit
        val sideLabel: String = "", // "G", "D" pour bilatéral ; "" sinon
    ) : CircuitPhase()

    /** Repos entre deux exercices ou entre deux rounds. */
    data class Repos(
        val nextExerciceName: String?,  // null = fin de bloc (navigation vers bloc suivant)
        val isFinDeRound: Boolean,
    ) : CircuitPhase()
}

// ── État exécution instance ───────────────────────────────────────────────────

data class InstanceExecuteUiState(
    val isLoading: Boolean = true,
    val instance: InstanceSeanceEntity? = null,
    val seance: SeanceEntity? = null,
    val blocs: List<BlocSeanceEntity> = emptyList(),
    val exercices: List<ExerciceSeanceWithExercise> = emptyList(),
    val seriesParExercice: Map<Long, List<SerieRealiseeState>> = emptyMap(),
    val activeExerciceIndex: Int = 0,
    val historiqueComplet: Map<Long, List<Pair<LocalDate, List<SerieRealiseeEntity>>>> = emptyMap(),
    val isCompleted: Boolean = false,
    val isDirty: Boolean = false,
    val exerciceNotesLocal: Map<Long, String> = emptyMap(),
    val circuitMode: CircuitPhase? = null,   // non-null = mode circuit actif
    val countdownSeconds: Int = 0,           // 3/2/1 avant démarrage, 0 = inactif
    val propositionsProgression: List<PropositionAffichee> = emptyList(), // récap à la clôture, non-vide = dialog visible
    val error: String? = null,
) {
    fun seriesForExercice(exerciceId: Long): List<SerieRealiseeState> =
        seriesParExercice[exerciceId] ?: emptyList()

    fun isExerciceComplete(exerciceId: Long): Boolean {
        val exercice = exercices.find { it.exerciceSeance.id == exerciceId } ?: return false
        val series = seriesParExercice[exerciceId] ?: return false
        val expected = exercice.exerciceSeance.nombreSeriesPrevues * if (exercice.exerciceSeance.isBilateral) 2 else 1
        return series.size >= expected && series.all { it.isCompleted }
    }

    fun summaryForExercice(exerciceId: Long): String {
        val series = seriesParExercice[exerciceId]?.filter { it.isCompleted } ?: return ""
        if (series.isEmpty()) return ""
        val n = series.size
        val repsMoyenne = series.mapNotNull { it.repsRealisees }.let { if (it.isEmpty()) null else it.average().toInt() }
        val chargeDisplay = series.mapNotNull { it.chargeLabel }.firstOrNull()
            ?: series.mapNotNull { it.chargeKg }.let { if (it.isEmpty()) null else "${"%.2f".format(it.average())} kg" }
        val rpeMoyenne = series.mapNotNull { it.rpe }.let { if (it.isEmpty()) null else it.average() }
        return buildString {
            append("${n}×${repsMoyenne ?: "?"}")
            if (chargeDisplay != null) append(" — $chargeDisplay")
            if (rpeMoyenne != null) append(" — RPE ${rpeMoyenne.toInt()}")
        }
    }
}

// ===== Récap progression à la clôture =====

enum class ChoixValidation { OUI, NON, AJUSTER }

data class PropositionAffichee(
    val exerciceSeanceId: Long,
    val exerciceId: Long,
    val exerciceName: String,
    val proposition: PropositionProgression,
)

data class SerieRealiseeState(
    val id: Long = 0,
    val numeroSerie: Int,
    val repsRealisees: Int? = null,
    val chargeKg: Float? = null,
    val chargeLabel: String? = null,
    val rpe: Float? = null,
    val isCompleted: Boolean = false,
    val isPreFilled: Boolean = false,
    // "G" ou "D" pour les exercices bilatéraux, "" sinon
    val notes: String = "",
)

// ===== Helpers d'affichage =====

fun formatRepsDisplay(repsCibles: String, repsType: RepsType): String {
    if (repsType == RepsType.DURATION) {
        val secs = repsCibles.toIntOrNull() ?: return repsCibles.ifBlank { "—" }
        return if (secs >= 60) "${secs / 60}:${(secs % 60).toString().padStart(2, '0')}" else "${secs}s"
    }
    return repsCibles.ifBlank { "—" }
}

// ===== Affectation au calendrier =====

data class AssignSeanceUiState(
    val seanceId: Long = 0,
    val nomSeance: String = "",
    val selectedDates: Set<LocalDate> = emptySet(),
    val existingInstances: List<InstanceSeanceEntity> = emptyList(),
    val isSaving: Boolean = false,
    val isDone: Boolean = false,
)
