package com.pandafit.feature.stats.model

data class DistancePreset(val emoji: String, val label: String, val km: Double)
data class SummitPreset(val emoji: String, val label: String, val elevationM: Int)
data class WeightPreset(val emoji: String, val label: String, val kg: Double)

val DISTANCE_PRESETS = listOf(
    DistancePreset("🗽", "Lille→NY", 5821.0),
    DistancePreset("🌕", "Lille→Lune", 384400.0),
    DistancePreset("🇧🇪", "Paris→BXL", 315.0),
    DistancePreset("🦁", "Paris→Lyon", 465.0),
    DistancePreset("📍", "Paris→Marseille", 773.0),
    DistancePreset("🌍", "Tour du Monde", 40075.0),
    DistancePreset("🇯🇵", "Paris→Tokyo", 9700.0),
)

val SUMMIT_PRESETS = listOf(
    SummitPreset("⛰️", "Mont Blanc", 4808),
    SummitPreset("🏔️", "Everest", 8849),
    SummitPreset("🌋", "Kilimandjaro", 5895),
    SummitPreset("🗼", "Tour Eiffel", 330),
)

val WEIGHT_PRESETS = listOf(
    WeightPreset("🐼", "Panda", 70.0),
    WeightPreset("🐱", "Chaton", 4.0),
    WeightPreset("🐘", "Éléphant", 5000.0),
    WeightPreset("🦏", "Rhinocéros", 2300.0),
    WeightPreset("🚗", "Voiture", 1500.0),
    WeightPreset("🐋", "Baleine bleue", 150000.0),
)

val MONUMENT_PRESETS = listOf(
    WeightPreset("🗼", "Tour Eiffel", 7_300_000.0),
    WeightPreset("🗽", "Statue de la Liberté", 225_000.0),
    WeightPreset("🏛️", "Big Ben (cloche)", 13_700.0),
    WeightPreset("🎡", "Grande Roue Paris", 800_000.0),
)

// Un seul équivalent configurable par discipline (distance/poids) + le sommet/monument associé,
// pour limiter le bruit visuel des "fun cards" (au lieu de 2-3 équivalents par discipline avant).
data class StatsConfig(
    val runDistIdx: Int = 0,    // défaut Lille→NY
    val runSummitIdx: Int = 0,  // défaut Mont Blanc
    val strWeightIdx: Int = 0,  // défaut Panda
    val strMonumentIdx: Int = 0, // défaut Tour Eiffel
    val cycDistIdx: Int = 2,    // défaut Paris→BXL (315 km)
    val cycSummitIdx: Int = 0,  // défaut Mont Blanc
) {
    val runDist get() = DISTANCE_PRESETS[runDistIdx.coerceIn(DISTANCE_PRESETS.indices)]
    val runSummit get() = SUMMIT_PRESETS[runSummitIdx.coerceIn(SUMMIT_PRESETS.indices)]
    val strWeight get() = WEIGHT_PRESETS[strWeightIdx.coerceIn(WEIGHT_PRESETS.indices)]
    val strMonument get() = MONUMENT_PRESETS[strMonumentIdx.coerceIn(MONUMENT_PRESETS.indices)]
    val cycDist get() = DISTANCE_PRESETS[cycDistIdx.coerceIn(DISTANCE_PRESETS.indices)]
    val cycSummit get() = SUMMIT_PRESETS[cycSummitIdx.coerceIn(SUMMIT_PRESETS.indices)]
}
