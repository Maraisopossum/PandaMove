# Statistiques — Flux complet

## Fichiers
| Rôle | Fichier |
|---|---|
| UI | `feature/stats/ui/StatsScreen.kt` |
| VM principal | `feature/stats/viewmodel/StatsViewModel.kt` |
| Modèles | `feature/stats/model/StatsUiState.kt` |
| Config présets | `feature/stats/model/StatsConfig.kt` |
| Persistance config | `feature/stats/preferences/StatsPreferences.kt` |
| Écran config | `feature/stats/ui/StatsConfigScreen.kt` |
| VM config | `feature/stats/viewmodel/StatsConfigViewModel.kt` |

## Flux de calcul

### Entrée
```kotlin
StatsViewModel.setPeriod(period)
  → loadStats(period)
    → startDate = today.minus(WEEK|MONTH|THREE_MONTHS|YEAR)
    → statsConfig = statsPreferences.configFlow.first()  // lit DataStore
```

### Données Running / Vélo
```kotlin
workoutDao.observeByDateRange(startDate, today).first()
  .filter { !it.isTemplate }  // exclure les templates
```
⚠ Filtre sur `scheduled_date`, pas `completed_at` → séances planifiées hors-période ignorées

```kotlin
runningCyclingStats(WorkoutType.RUNNING) → SportStats
buildRunningDetail(runningCompleted, startDate, today) → RunningDetailStats
```

### Données Renforcement
```kotlin
instanceSeanceDao.countInRange(startDate, today)           → plannedCount
instanceSeanceDao.getCompletedWithSeriesInRange(...)       → instancesWithSeries
instanceSeanceDao.getExerciseStatsFull(startDate, today)   → exerciseStats
```

### buildStrengthDetail — points critiques
```kotlin
// 1. Mapping repsType (à faire AVANT le calcul tonnage)
val seanceIds = instancesWithSeries.map { it.instance.seanceId }.distinct()
val exerciceMappings = instanceSeanceDao.getExerciceMappingsForSeances(seanceIds)
val exerciceToRepsType = exerciceMappings.associate { it.id to it.repsType }

// 2. Tonnage (exclure DURATION)
val totalTonnage = allSeries.sumOf { s ->
    if (exerciceToRepsType[s.exerciceSeanceId] == RepsType.DURATION) 0.0
    else (s.chargeKg?.toDouble() ?: 0.0) * (s.repsRealisees ?: 0)
}

// 3. Exercices phares — ex-aequo
val maxCount = exerciseStats.firstOrNull()?.seriesCount ?: 0
val topExercises = exerciseStats.filter { it.seriesCount == maxCount }
                                .map { it.exerciseName to it.seriesCount }
```

### buildRunningDetail — points critiques
```kotlin
val totalElev = completed.sumOf { it.resultElevationM ?: 0 }  // dénivelé réel des rapports
val maxHr = completed.mapNotNull { it.resultHrMax }.filter { it > 0 }.maxOrNull()
    ?: hrs.maxOrNull() ?: 0                                    // FCmax = max des FCmax par séance
```

## Système de configuration (StatsConfig)

### Présets disponibles
```
DISTANCE_PRESETS (7) : Lille→NY (5821km), Lille→Lune (384400km), Paris→BXL, Paris→Lyon, Paris→Marseille, Tour Monde, Paris→Tokyo
SUMMIT_PRESETS (4)   : Mont Blanc (4808m), Everest (8849m), Kilimandjaro (5895m), Tour Eiffel (330m)
WEIGHT_PRESETS (6)   : Panda (70kg), Chaton (4kg), Éléphant (5000kg), Rhinocéros (2300kg), Voiture (1500kg), Baleine (150000kg)
MONUMENT_PRESETS (4) : Tour Eiffel (7.3M kg), Statue Liberté (225k kg), Big Ben cloche (13.7k kg), Grande Roue (800k kg)
```

### Défauts
```
runDist1Idx=0  → Lille→NY
runDist2Idx=1  → Lille→Lune
runSummitIdx=0 → Mont Blanc
strWeight1Idx=0 → Panda
strWeight2Idx=2 → Éléphant
strWeight3Idx=4 → Voiture
strMonumentIdx=0 → Tour Eiffel
```

### DataStore (StatsPreferences)
```kotlin
@StatsDataStore DataStore<Preferences>   // qualifier obligatoire
configFlow: Flow<StatsConfig>            // map des 7 clés intPreferencesKey
update(key, value): suspend             // mise à jour individuelle
```

### Accès depuis le profil
```
ProfileScreen → "Configuration des statistiques" → StatsConfigScreen
StatsConfigViewModel.setRunDist1(idx) / .setRunSummit(idx) / .setStrWeight1(idx)…
→ StatsPreferences.update(key, value)
→ StatsViewModel.loadStats() relit la config au prochain appel setPeriod()
```

## Fun cards — calcul

### FunRunningCard
```kotlin
val pct1 = distanceKm / config.runDist1.km * 100         // % distance 1
val pct2 = distanceKm / config.runDist2.km * 100         // % distance 2
val pctSummit = totalElevationM / config.runSummit.elevationM * 100  // ⚠ dénivelé réel, pas distance
```

### FunStrengthCard
```kotlin
val w1 = tonnageKg / config.strWeight1.kg
val w2 = tonnageKg / config.strWeight2.kg
val w3 = tonnageKg / config.strWeight3.kg
val mon = tonnageKg / config.strMonument.kg
```

## Périodes disponibles
```kotlin
enum class StatsPeriod { WEEK, MONTH, THREE_MONTHS, YEAR }
// Labels : "7j", "30j", "3m", "1an"
// Défaut au démarrage : MONTH
```

## StatsUiState — structure
```kotlin
data class StatsUiState(
    period, isLoading,
    runningStats: SportStats, cyclingStats: SportStats, strengthStats: SportStats,
    strengthDetail: StrengthDetailStats,   // topExercises: List<Pair<String,Int>> (ex-aequo)
    runningDetail: RunningDetailStats,
    weeklyVolume: List<DayVolume>,
    statsConfig: StatsConfig,             // injecté depuis DataStore
)
```

## Points sensibles
- `@Relation` dans `SeanceFull` non ordonnée → tri Kotlin obligatoire
- Filtre sur `scheduled_date` : séance planifiée 40j avant mais terminée aujourd'hui → absent des stats "30j"
- `topExercises` = liste (ex-aequo) et non plus `topExercise: String?` — affichage en `Column`
- `totalElevationM` dans fun card = somme des dénivelés réels saisis (pas estimé depuis distance)
