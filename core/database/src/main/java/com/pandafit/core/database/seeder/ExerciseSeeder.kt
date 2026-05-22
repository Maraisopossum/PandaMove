package com.pandafit.core.database.seeder

import com.pandafit.core.database.dao.ExerciseDao
import com.pandafit.core.database.entities.ExerciseCategory
import com.pandafit.core.database.entities.ExerciseEntity
import kotlinx.coroutines.flow.first
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Initialise la bibliothèque d'exercices au premier lancement.
 * 166 exercices extraits de exercices_musculation.xlsx.
 * Appeler [seedIfEmpty] dans l'Application ou via un Worker au démarrage.
 */
@Singleton
class ExerciseSeeder @Inject constructor(
    private val exerciseDao: ExerciseDao,
) {
    suspend fun seedIfEmpty() {
        val existing = exerciseDao.observeAll().first()
        if (existing.isNotEmpty()) return
        exerciseDao.insertExercise(*EXERCISES.toTypedArray())
    }

    // Extension pour insertion en masse
    private suspend fun ExerciseDao.insertExercise(vararg exercises: ExerciseEntity) {
        exercises.forEach { insertExercise(it) }
    }
}

private fun ex(
    name: String,
    category: ExerciseCategory,
    muscles: List<String> = emptyList(),
) = ExerciseEntity(
    name = name,
    category = category,
    muscleGroups = muscles,
    isCustom = false,
)

private val EXERCISES: List<ExerciseEntity> = listOf(

    // ═══════════════════════════════════════════════
    // PECTORAUX
    // ═══════════════════════════════════════════════
    ex("Développé couché barre",             ExerciseCategory.CHEST,     listOf("Pectoraux", "Triceps", "Deltoïde antérieur")),
    ex("Développé couché haltères",          ExerciseCategory.CHEST,     listOf("Pectoraux", "Triceps", "Deltoïde antérieur")),
    ex("Développé couché incliné barre",     ExerciseCategory.CHEST,     listOf("Pectoraux (chef claviculaire)", "Triceps", "Deltoïde antérieur")),
    ex("Développé couché incliné haltères",  ExerciseCategory.CHEST,     listOf("Pectoraux (chef claviculaire)", "Triceps", "Deltoïde antérieur")),
    ex("Développé couché décliné barre",     ExerciseCategory.CHEST,     listOf("Pectoraux (chef sternal)", "Triceps", "Deltoïde antérieur")),
    ex("Développé couché décliné haltères",  ExerciseCategory.CHEST,     listOf("Pectoraux (chef sternal)", "Triceps", "Deltoïde antérieur")),
    ex("Écarté couché haltères",             ExerciseCategory.CHEST,     listOf("Pectoraux", "Deltoïde antérieur")),
    ex("Écarté incliné haltères",            ExerciseCategory.CHEST,     listOf("Pectoraux (chef claviculaire)", "Deltoïde antérieur")),
    ex("Écarté décliné haltères",            ExerciseCategory.CHEST,     listOf("Pectoraux (chef sternal)", "Deltoïde antérieur")),
    ex("Crossover câbles (poulie haute)",    ExerciseCategory.CHEST,     listOf("Pectoraux", "Deltoïde antérieur")),
    ex("Crossover câbles (poulie basse)",    ExerciseCategory.CHEST,     listOf("Pectoraux (chef claviculaire)", "Deltoïde antérieur")),
    ex("Pec deck / Butterfly machine",       ExerciseCategory.CHEST,     listOf("Pectoraux", "Deltoïde antérieur")),
    ex("Dips (poitrine)",                    ExerciseCategory.CHEST,     listOf("Pectoraux", "Triceps", "Deltoïde antérieur")),
    ex("Pompes",                             ExerciseCategory.CHEST,     listOf("Pectoraux", "Triceps", "Deltoïde antérieur", "Serratus")),
    ex("Pompes larges",                      ExerciseCategory.CHEST,     listOf("Pectoraux", "Triceps", "Deltoïde antérieur")),
    ex("Pompes diamant",                     ExerciseCategory.TRICEPS,   listOf("Triceps", "Pectoraux", "Deltoïde antérieur")),
    ex("Développé couché Smith machine",     ExerciseCategory.CHEST,     listOf("Pectoraux", "Triceps", "Deltoïde antérieur")),
    ex("Pull-over haltère",                  ExerciseCategory.CHEST,     listOf("Pectoraux (grand)", "Grand dorsal", "Triceps (longue portion)")),
    ex("Pull-over à la poulie",              ExerciseCategory.CHEST,     listOf("Pectoraux (grand)", "Grand dorsal", "Triceps (longue portion)")),

    // ═══════════════════════════════════════════════
    // DOS
    // ═══════════════════════════════════════════════
    ex("Traction pronation (pull-up)",       ExerciseCategory.BACK,      listOf("Grand dorsal", "Biceps", "Trapèze", "Rhomboïdes")),
    ex("Traction supination (chin-up)",      ExerciseCategory.BACK,      listOf("Grand dorsal", "Biceps", "Trapèze", "Rhomboïdes")),
    ex("Traction neutre",                    ExerciseCategory.BACK,      listOf("Grand dorsal", "Biceps", "Trapèze", "Rhomboïdes")),
    ex("Lat pulldown pronation",             ExerciseCategory.BACK,      listOf("Grand dorsal", "Biceps", "Trapèze", "Rhomboïdes")),
    ex("Lat pulldown supination",            ExerciseCategory.BACK,      listOf("Grand dorsal", "Biceps", "Trapèze", "Rhomboïdes")),
    ex("Lat pulldown neutre",                ExerciseCategory.BACK,      listOf("Grand dorsal", "Biceps", "Trapèze")),
    ex("Rowing barre (Bent-over row)",       ExerciseCategory.BACK,      listOf("Grand dorsal", "Trapèze", "Rhomboïdes", "Biceps", "Érecteurs du rachis")),
    ex("Rowing haltère unilatéral",          ExerciseCategory.BACK,      listOf("Grand dorsal", "Trapèze", "Rhomboïdes", "Biceps")),
    ex("Rowing câble assis (prise serrée)",  ExerciseCategory.BACK,      listOf("Grand dorsal", "Trapèze", "Rhomboïdes", "Biceps")),
    ex("Rowing câble assis (prise large)",   ExerciseCategory.BACK,      listOf("Grand dorsal", "Trapèze", "Rhomboïdes", "Biceps")),
    ex("Rowing T-bar",                       ExerciseCategory.BACK,      listOf("Grand dorsal", "Trapèze", "Rhomboïdes", "Biceps", "Érecteurs du rachis")),
    ex("Rowing Pendlay",                     ExerciseCategory.BACK,      listOf("Grand dorsal", "Trapèze", "Rhomboïdes", "Biceps", "Érecteurs du rachis")),
    ex("Rowing Yates (barre EZ)",            ExerciseCategory.BACK,      listOf("Grand dorsal", "Trapèze", "Rhomboïdes", "Biceps")),
    ex("Rowing machine (Hammer Strength)",   ExerciseCategory.BACK,      listOf("Grand dorsal", "Trapèze", "Rhomboïdes", "Biceps")),
    ex("Face pull câble",                    ExerciseCategory.BACK,      listOf("Deltoïde postérieur", "Trapèze", "Rhomboïdes", "Infra-épineux")),
    ex("Tirage nuque câble",                 ExerciseCategory.BACK,      listOf("Grand dorsal", "Trapèze", "Biceps", "Rhomboïdes")),
    ex("Good morning",                       ExerciseCategory.BACK,      listOf("Érecteurs du rachis", "Ischio-jambiers", "Fessiers")),
    ex("Hyperextension (GHD)",               ExerciseCategory.BACK,      listOf("Érecteurs du rachis", "Fessiers", "Ischio-jambiers")),
    ex("Deadlift roumain câble",             ExerciseCategory.BACK,      listOf("Ischio-jambiers", "Fessiers", "Érecteurs du rachis")),
    ex("Shrug barre",                        ExerciseCategory.BACK,      listOf("Trapèze supérieur")),
    ex("Shrug haltères",                     ExerciseCategory.BACK,      listOf("Trapèze supérieur")),
    ex("Shrug machine",                      ExerciseCategory.BACK,      listOf("Trapèze supérieur")),
    ex("Shrug câble",                        ExerciseCategory.BACK,      listOf("Trapèze supérieur")),

    // ═══════════════════════════════════════════════
    // ÉPAULES
    // ═══════════════════════════════════════════════
    ex("Développé militaire barre",          ExerciseCategory.SHOULDERS, listOf("Deltoïde antérieur", "Deltoïde médial", "Triceps", "Trapèze")),
    ex("Développé militaire haltères",       ExerciseCategory.SHOULDERS, listOf("Deltoïde antérieur", "Deltoïde médial", "Triceps", "Trapèze")),
    ex("Développé Arnold",                   ExerciseCategory.SHOULDERS, listOf("Deltoïde antérieur", "Deltoïde médial", "Triceps")),
    ex("Développé épaules machine",          ExerciseCategory.SHOULDERS, listOf("Deltoïde antérieur", "Deltoïde médial", "Triceps")),
    ex("Développé épaules Smith machine",    ExerciseCategory.SHOULDERS, listOf("Deltoïde antérieur", "Deltoïde médial", "Triceps")),
    ex("Élévation latérale haltères",        ExerciseCategory.SHOULDERS, listOf("Deltoïde médial", "Trapèze supérieur")),
    ex("Élévation latérale câble",           ExerciseCategory.SHOULDERS, listOf("Deltoïde médial", "Trapèze supérieur")),
    ex("Élévation latérale machine",         ExerciseCategory.SHOULDERS, listOf("Deltoïde médial", "Trapèze supérieur")),
    ex("Élévation frontale barre",           ExerciseCategory.SHOULDERS, listOf("Deltoïde antérieur", "Deltoïde médial")),
    ex("Élévation frontale haltères",        ExerciseCategory.SHOULDERS, listOf("Deltoïde antérieur", "Deltoïde médial")),
    ex("Élévation frontale câble",           ExerciseCategory.SHOULDERS, listOf("Deltoïde antérieur", "Deltoïde médial")),
    ex("Oiseau haltères (rear delt fly)",    ExerciseCategory.SHOULDERS, listOf("Deltoïde postérieur", "Trapèze", "Rhomboïdes")),
    ex("Oiseau câble (rear delt fly)",       ExerciseCategory.SHOULDERS, listOf("Deltoïde postérieur", "Trapèze", "Rhomboïdes")),
    ex("Reverse pec deck",                   ExerciseCategory.SHOULDERS, listOf("Deltoïde postérieur", "Trapèze", "Rhomboïdes")),
    ex("Upright row barre",                  ExerciseCategory.SHOULDERS, listOf("Deltoïde médial", "Trapèze", "Biceps")),
    ex("Upright row haltères",               ExerciseCategory.SHOULDERS, listOf("Deltoïde médial", "Trapèze", "Biceps")),
    ex("Upright row câble",                  ExerciseCategory.SHOULDERS, listOf("Deltoïde médial", "Trapèze", "Biceps")),
    ex("Cuban press",                        ExerciseCategory.SHOULDERS, listOf("Infra-épineux", "Deltoïde postérieur", "Trapèze")),

    // ═══════════════════════════════════════════════
    // BICEPS
    // ═══════════════════════════════════════════════
    ex("Curl barre droite",                  ExerciseCategory.BICEPS,    listOf("Biceps brachial", "Brachial", "Brachioradial")),
    ex("Curl barre EZ",                      ExerciseCategory.BICEPS,    listOf("Biceps brachial", "Brachial", "Brachioradial")),
    ex("Curl haltères debout",               ExerciseCategory.BICEPS,    listOf("Biceps brachial", "Brachial", "Brachioradial")),
    ex("Curl haltères alterné",              ExerciseCategory.BICEPS,    listOf("Biceps brachial", "Brachial", "Brachioradial")),
    ex("Curl haltères concentré",            ExerciseCategory.BICEPS,    listOf("Biceps brachial", "Brachial")),
    ex("Curl marteau haltères",              ExerciseCategory.BICEPS,    listOf("Brachial", "Brachioradial", "Biceps brachial")),
    ex("Curl marteau câble",                 ExerciseCategory.BICEPS,    listOf("Brachial", "Brachioradial", "Biceps brachial")),
    ex("Curl incliné haltères",              ExerciseCategory.BICEPS,    listOf("Biceps brachial (longue portion)", "Brachial")),
    ex("Curl pupitre (Scott curl)",          ExerciseCategory.BICEPS,    listOf("Biceps brachial (courte portion)", "Brachial")),
    ex("Curl câble poulie basse",            ExerciseCategory.BICEPS,    listOf("Biceps brachial", "Brachial", "Brachioradial")),
    ex("Curl câble poulie haute",            ExerciseCategory.BICEPS,    listOf("Biceps brachial", "Brachial")),
    ex("Curl Zottman",                       ExerciseCategory.BICEPS,    listOf("Biceps brachial", "Brachioradial", "Brachial")),
    ex("Curl spider",                        ExerciseCategory.BICEPS,    listOf("Biceps brachial (courte portion)", "Brachial")),
    ex("Curl machine",                       ExerciseCategory.BICEPS,    listOf("Biceps brachial", "Brachial")),
    ex("Curl à 21",                          ExerciseCategory.BICEPS,    listOf("Biceps brachial", "Brachial", "Brachioradial")),

    // ═══════════════════════════════════════════════
    // TRICEPS
    // ═══════════════════════════════════════════════
    ex("Développé couché prise serrée",             ExerciseCategory.TRICEPS,   listOf("Triceps", "Pectoraux", "Deltoïde antérieur")),
    ex("Barre au front (Skull crusher)",            ExerciseCategory.TRICEPS,   listOf("Triceps")),
    ex("Barre au front EZ",                         ExerciseCategory.TRICEPS,   listOf("Triceps")),
    ex("Extension triceps câble (corde)",           ExerciseCategory.TRICEPS,   listOf("Triceps")),
    ex("Extension triceps câble (barre droite)",    ExerciseCategory.TRICEPS,   listOf("Triceps")),
    ex("Extension triceps câble (prise inversée)",  ExerciseCategory.TRICEPS,   listOf("Triceps (longue portion)")),
    ex("Kick-back haltère",                         ExerciseCategory.TRICEPS,   listOf("Triceps")),
    ex("Kick-back câble",                           ExerciseCategory.TRICEPS,   listOf("Triceps")),
    ex("Extension triceps overhead haltère",        ExerciseCategory.TRICEPS,   listOf("Triceps (longue portion)")),
    ex("Extension triceps overhead câble",          ExerciseCategory.TRICEPS,   listOf("Triceps (longue portion)")),
    ex("Extension triceps overhead barre EZ",       ExerciseCategory.TRICEPS,   listOf("Triceps (longue portion)")),
    ex("Dips banc (triceps)",                       ExerciseCategory.TRICEPS,   listOf("Triceps", "Pectoraux", "Deltoïde antérieur")),
    ex("Triceps machine",                           ExerciseCategory.TRICEPS,   listOf("Triceps")),
    ex("JM press",                                  ExerciseCategory.TRICEPS,   listOf("Triceps", "Pectoraux")),

    // ═══════════════════════════════════════════════
    // JAMBES (Quadriceps)
    // ═══════════════════════════════════════════════
    ex("Squat barre haute",                  ExerciseCategory.LEGS,      listOf("Quadriceps", "Fessiers", "Ischio-jambiers", "Érecteurs du rachis", "Adducteurs")),
    ex("Squat barre basse",                  ExerciseCategory.LEGS,      listOf("Quadriceps", "Fessiers", "Ischio-jambiers", "Érecteurs du rachis", "Adducteurs")),
    ex("Squat avant (Front squat)",          ExerciseCategory.LEGS,      listOf("Quadriceps", "Fessiers", "Ischio-jambiers", "Érecteurs du rachis")),
    ex("Squat gobelet",                      ExerciseCategory.LEGS,      listOf("Quadriceps", "Fessiers", "Ischio-jambiers")),
    ex("Squat Smith machine",                ExerciseCategory.LEGS,      listOf("Quadriceps", "Fessiers", "Ischio-jambiers")),
    ex("Squat hack machine",                 ExerciseCategory.LEGS,      listOf("Quadriceps", "Fessiers", "Ischio-jambiers")),
    ex("Hack squat barre",                   ExerciseCategory.LEGS,      listOf("Quadriceps", "Fessiers", "Ischio-jambiers")),
    ex("Leg press",                          ExerciseCategory.LEGS,      listOf("Quadriceps", "Fessiers", "Ischio-jambiers")),
    ex("Fente barre",                        ExerciseCategory.LEGS,      listOf("Quadriceps", "Fessiers", "Ischio-jambiers", "Adducteurs")),
    ex("Fente haltères",                     ExerciseCategory.LEGS,      listOf("Quadriceps", "Fessiers", "Ischio-jambiers", "Adducteurs")),
    ex("Fente marchée",                      ExerciseCategory.LEGS,      listOf("Quadriceps", "Fessiers", "Ischio-jambiers", "Adducteurs")),
    ex("Fente bulgare (split squat)",        ExerciseCategory.LEGS,      listOf("Quadriceps", "Fessiers", "Ischio-jambiers")),
    ex("Step-up haltères",                   ExerciseCategory.LEGS,      listOf("Quadriceps", "Fessiers", "Ischio-jambiers")),
    ex("Leg extension machine",              ExerciseCategory.LEGS,      listOf("Quadriceps")),
    ex("Sissy squat",                        ExerciseCategory.LEGS,      listOf("Quadriceps")),
    ex("Zercher squat",                      ExerciseCategory.LEGS,      listOf("Quadriceps", "Fessiers", "Ischio-jambiers", "Érecteurs du rachis")),
    ex("Squat sur une jambe (pistol squat)", ExerciseCategory.LEGS,      listOf("Quadriceps", "Fessiers", "Ischio-jambiers")),

    // ═══════════════════════════════════════════════
    // JAMBES (Ischio-jambiers / Fessiers)
    // ═══════════════════════════════════════════════
    ex("Soulevé de terre conventionnel",         ExerciseCategory.LEGS,   listOf("Érecteurs du rachis", "Fessiers", "Ischio-jambiers", "Quadriceps", "Trapèze")),
    ex("Soulevé de terre sumo",                  ExerciseCategory.LEGS,   listOf("Fessiers", "Ischio-jambiers", "Adducteurs", "Érecteurs du rachis", "Quadriceps")),
    ex("Soulevé de terre roumain",               ExerciseCategory.LEGS,   listOf("Ischio-jambiers", "Fessiers", "Érecteurs du rachis")),
    ex("Soulevé de terre jambes tendues",        ExerciseCategory.LEGS,   listOf("Ischio-jambiers", "Fessiers", "Érecteurs du rachis")),
    ex("Soulevé de terre pieds-mains (Trap bar)",ExerciseCategory.LEGS,   listOf("Quadriceps", "Fessiers", "Ischio-jambiers", "Érecteurs du rachis", "Trapèze")),
    ex("Leg curl couché machine",                ExerciseCategory.LEGS,   listOf("Ischio-jambiers")),
    ex("Leg curl assis machine",                 ExerciseCategory.LEGS,   listOf("Ischio-jambiers")),
    ex("Leg curl câble debout",                  ExerciseCategory.LEGS,   listOf("Ischio-jambiers")),
    ex("Nordic curl",                            ExerciseCategory.LEGS,   listOf("Ischio-jambiers")),

    // ═══════════════════════════════════════════════
    // FESSIERS
    // ═══════════════════════════════════════════════
    ex("Hip thrust barre",               ExerciseCategory.GLUTES,    listOf("Fessiers", "Ischio-jambiers")),
    ex("Hip thrust machine",             ExerciseCategory.GLUTES,    listOf("Fessiers", "Ischio-jambiers")),
    ex("Glute bridge",                   ExerciseCategory.GLUTES,    listOf("Fessiers", "Ischio-jambiers")),
    ex("Donkey kick câble",              ExerciseCategory.GLUTES,    listOf("Fessiers")),
    ex("Hip abduction machine",          ExerciseCategory.GLUTES,    listOf("Fessiers (moyen et petit)", "TFL")),
    ex("Hip adduction machine",          ExerciseCategory.LEGS,      listOf("Adducteurs")),
    ex("Cable pull-through",             ExerciseCategory.GLUTES,    listOf("Fessiers", "Ischio-jambiers", "Érecteurs du rachis")),
    ex("Squat sumo haltère",             ExerciseCategory.GLUTES,    listOf("Fessiers", "Adducteurs", "Quadriceps", "Ischio-jambiers")),
    ex("Curtsy lunge",                   ExerciseCategory.GLUTES,    listOf("Fessiers (moyen)", "Quadriceps", "Adducteurs")),

    // ═══════════════════════════════════════════════
    // MOLLETS
    // ═══════════════════════════════════════════════
    ex("Mollets debout machine",             ExerciseCategory.LEGS,      listOf("Gastrocnémien", "Soléaire")),
    ex("Mollets assis machine",              ExerciseCategory.LEGS,      listOf("Soléaire", "Gastrocnémien")),
    ex("Mollets debout barre",               ExerciseCategory.LEGS,      listOf("Gastrocnémien", "Soléaire")),
    ex("Mollets debout haltère unilatéral",  ExerciseCategory.LEGS,      listOf("Gastrocnémien", "Soléaire")),
    ex("Mollets au leg press",               ExerciseCategory.LEGS,      listOf("Gastrocnémien", "Soléaire")),
    ex("Dorsiflexion poids de corps",        ExerciseCategory.LEGS,      listOf("Tibial antérieur")),

    // ═══════════════════════════════════════════════
    // CORE / ABDOMINAUX
    // ═══════════════════════════════════════════════
    ex("Crunch",                         ExerciseCategory.CORE,      listOf("Droit abdominal", "Obliques")),
    ex("Crunch machine",                 ExerciseCategory.CORE,      listOf("Droit abdominal", "Obliques")),
    ex("Crunch câble",                   ExerciseCategory.CORE,      listOf("Droit abdominal", "Obliques")),
    ex("Relevé de jambes suspendu",      ExerciseCategory.CORE,      listOf("Iliopsoas", "Droit abdominal")),
    ex("Relevé de jambes sol",           ExerciseCategory.CORE,      listOf("Iliopsoas", "Droit abdominal")),
    ex("Ab wheel (roue abdominale)",     ExerciseCategory.CORE,      listOf("Droit abdominal", "Obliques", "Grand dorsal", "Triceps")),
    ex("Dragon flag",                    ExerciseCategory.CORE,      listOf("Droit abdominal", "Obliques", "Grand dorsal")),
    ex("Planche (gainage)",              ExerciseCategory.CORE,      listOf("Transverse", "Droit abdominal", "Obliques", "Érecteurs du rachis")),
    ex("Planche latérale",               ExerciseCategory.CORE,      listOf("Obliques", "Transverse")),
    ex("Russian twist",                  ExerciseCategory.CORE,      listOf("Obliques", "Droit abdominal")),
    ex("Mountain climber",               ExerciseCategory.CORE,      listOf("Droit abdominal", "Obliques", "Iliopsoas", "Quadriceps")),
    ex("Wood chop câble",                ExerciseCategory.CORE,      listOf("Obliques", "Droit abdominal", "Grand dorsal", "Épaules")),
    ex("Pallof press câble",             ExerciseCategory.CORE,      listOf("Transverse", "Obliques", "Droit abdominal")),
    ex("Rollout sur genoux",             ExerciseCategory.CORE,      listOf("Droit abdominal", "Grand dorsal", "Triceps")),
    ex("Windshield wiper",               ExerciseCategory.CORE,      listOf("Obliques", "Droit abdominal")),
    ex("Hollow hold",                    ExerciseCategory.CORE,      listOf("Droit abdominal", "Transverse", "Iliopsoas")),
    ex("V-up",                           ExerciseCategory.CORE,      listOf("Droit abdominal", "Iliopsoas")),
    ex("Toes to bar",                    ExerciseCategory.CORE,      listOf("Droit abdominal", "Iliopsoas", "Grand dorsal")),
    ex("Ab slide machine",               ExerciseCategory.CORE,      listOf("Droit abdominal", "Obliques")),

    // ═══════════════════════════════════════════════
    // AVANT-BRAS / GRIP
    // ═══════════════════════════════════════════════
    ex("Curl avant-bras barre (prise pronation)",  ExerciseCategory.OTHER, listOf("Extenseurs du carpe", "Brachioradial")),
    ex("Curl avant-bras barre (prise supination)", ExerciseCategory.OTHER, listOf("Fléchisseurs du carpe", "Brachioradial")),
    ex("Curl avant-bras haltère",                  ExerciseCategory.OTHER, listOf("Fléchisseurs du carpe", "Brachioradial")),
    ex("Farmer's walk",                            ExerciseCategory.FULL_BODY, listOf("Avant-bras (grip)", "Trapèze", "Fessiers", "Quadriceps", "Érecteurs du rachis")),
    ex("Plate pinch",                              ExerciseCategory.OTHER, listOf("Avant-bras (grip)")),
    ex("Wrist roller",                             ExerciseCategory.OTHER, listOf("Fléchisseurs du carpe", "Extenseurs du carpe")),
    ex("Reverse curl barre",                       ExerciseCategory.OTHER, listOf("Brachioradial", "Extenseurs du carpe", "Biceps brachial")),

    // ═══════════════════════════════════════════════
    // HALTÉROPHILIE / FONCTIONNEL
    // ═══════════════════════════════════════════════
    ex("Arraché (Snatch)",               ExerciseCategory.FULL_BODY, listOf("Quadriceps", "Fessiers", "Ischio-jambiers", "Érecteurs du rachis", "Trapèze", "Deltoïdes")),
    ex("Épaulé-jeté (Clean & Jerk)",     ExerciseCategory.FULL_BODY, listOf("Quadriceps", "Fessiers", "Ischio-jambiers", "Érecteurs du rachis", "Trapèze", "Deltoïdes")),
    ex("Power clean",                    ExerciseCategory.FULL_BODY, listOf("Quadriceps", "Fessiers", "Ischio-jambiers", "Érecteurs du rachis", "Trapèze")),
    ex("Power snatch",                   ExerciseCategory.FULL_BODY, listOf("Quadriceps", "Fessiers", "Ischio-jambiers", "Érecteurs du rachis", "Trapèze")),
    ex("Kettlebell swing",               ExerciseCategory.FULL_BODY, listOf("Fessiers", "Ischio-jambiers", "Érecteurs du rachis", "Épaules")),
    ex("Turkish get-up",                 ExerciseCategory.FULL_BODY, listOf("Épaules", "Fessiers", "Abdominaux", "Quadriceps")),
    ex("Clean tiré (High pull)",         ExerciseCategory.FULL_BODY, listOf("Trapèze", "Fessiers", "Quadriceps", "Ischio-jambiers", "Deltoïdes")),
    ex("Landmine press",                 ExerciseCategory.SHOULDERS, listOf("Deltoïde antérieur", "Pectoraux", "Triceps")),
    ex("Landmine row",                   ExerciseCategory.BACK,      listOf("Grand dorsal", "Trapèze", "Biceps", "Rhomboïdes")),
    ex("Landmine squat",                 ExerciseCategory.LEGS,      listOf("Quadriceps", "Fessiers", "Ischio-jambiers")),
)
