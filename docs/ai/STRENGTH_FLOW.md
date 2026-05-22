# Renforcement — Flux complet

## Entités principales
| Entité | Table | Rôle |
|---|---|---|
| `SeanceEntity` | `seances` | Template séance (type STRENGTH ou WARMUP) |
| `BlocSeanceEntity` | `blocs_seance` | Bloc d'exercices (SUPERSET, CIRCUIT…) |
| `ExerciceSeanceEntity` | `exercices_seance` | Exercice dans une séance avec paramètres cibles |
| `InstanceSeanceEntity` | `instances_seance` | Session planifiée ou terminée |
| `SerieRealiseeEntity` | `series_realisees` | Série réellement effectuée |
| `ExerciseEntity` | `exercises` | Catalogue d'exercices |

## Champs critiques ExerciceSeanceEntity
```
id PK
seance_id FK
exercise_id FK           → lien vers ExerciseEntity (nom via JOIN)
bloc_id FK (nullable)    → null = exercice libre, non-null = dans un bloc
position: Int            → ordre dans la séance / dans le bloc
reps_type: REPS|DURATION → ⚠ DURATION = repsRealisees sont des secondes, pas des reps
reps_cibles: String      → "10", "8-12", "30s"
charge_cible: String     → "PDC", "Élastique", "20 kg"
nombre_series_prevues: Int
temps_repos_sec: Int
```

## Champs critiques SerieRealiseeEntity
```
instance_seance_id FK
exercice_seance_id FK    → lien vers ExerciceSeanceEntity (pas vers ExerciseEntity directement)
numero_serie: Int        → 1-based
reps_realisees: Int?     → ⚠ = secondes si repsType == DURATION
charge_kg: Float?        → valeur numérique (null si PDC/Élastique)
charge_label: String?    → "PDC", "20 kg"
is_completed: Boolean
rpe: Float?
```

## Flux création séance type
```
SeanceListScreen → FAB → SeanceCreateScreen (nouveau)
SeanceListScreen → icône édition → SeanceCreateScreen (édition, seanceId dans route)

SeanceCreateViewModel.save()
  → si isNew : saveNewSeanceContent()
      → seanceDao.insertSeance()
      → pour chaque item : insertBloc() puis insertExerciceSeance()
  → si édition : updateExistingSeanceContent()
      → updateBloc() / insertBloc() pour blocs
      → updateExerciceSeance() / insertExerciceSeance() pour exercices
      → deleteExerciceSeance() pour les exercices supprimés (id absent des drafts)
      → deleteBloc() pour les blocs supprimés
```

## Sélection multi-exercices — point sensible
```kotlin
// ⚠ Utiliser l'ordre d'insertion de multiSelectedIds (LinkedHashSet), PAS l'ordre alphabétique DB
val exercisesById = state.availableExercises.associateBy { it.id }
val selected = state.multiSelectedIds.mapNotNull { id -> exercisesById[id] }
// Raison : ORDER BY name ASC en UTF-8 binaire → "É" (0xC3) > "F" (0x46) → ordre inversé
```

## Chargement séance en édition — point sensible
```kotlin
// SeanceFull @Relation est NON ORDONNÉE → toujours re-trier
exercices = (exercicesByBloc[bloc.id] ?: emptyList())
    .sortedBy { it.exerciceSeance.position }   // ⚠ obligatoire
    .map { toExerciceDraft(it) }
```

## Flux affectation séance type → instance planifiée
```
SeanceListScreen → icône 📅 sur carte → assignTargetId = seance.id; showAssignMenu = true
AssignMenuDialog.onDismiss = { showAssignMenu = false }  // ⚠ NE PAS nullifier assignTargetId
→ SeanceListViewModel.assignToDate(id, date)
    → instanceSeanceDao.insertInstance(InstanceSeanceEntity(seanceId=id, date=date))
→ SeanceListViewModel.assignToDates(id, dates)       → batch insertInstance
→ SeanceListViewModel.assignRecurring(id, start, intervalDays, occurrences) → repeat inserts
```

## Flux exécution instance
```
SeanceListScreen → carte "planifiée" → InstanceExecuteScreen
InstanceExecuteViewModel.load()
  → instanceSeanceDao.getWithSeries(instanceId)
  → seanceDao.getSeanceFull(seanceId)
  → buildOrderedExercises(seanceFull)   // trie par bloc.position puis exercice.position
  → chargement historique pour pré-remplissage

Saisie série → saveSerie()
  → instanceSeanceDao.insertSerie(SerieRealiseeEntity(...))
  → ou updateSerie() si existante

Terminer → InstanceExecuteViewModel.finish()
  → instanceSeanceDao.updateCompletion(id, true, completedAt, durationSeconds)
  → navController → InstanceReportScreen
```

## Rapport instance terminée (InstanceReportScreen)
- VM : `SeanceDetailViewModel` ou `InstanceReportViewModel` (charge instance + séries + template)
- Affiche : résumé par exercice (séries réalisées, charges, RPE)
- Navigation depuis : `SeanceListScreen` (clic sur instance terminée) ou fin d'exécution

## Calcul tonnage — règle critique
```kotlin
// Dans StatsViewModel.buildStrengthDetail()
val exerciceToRepsType = exerciceMappings.associate { it.id to it.repsType }

val totalTonnage = allSeries.sumOf { s ->
    if (exerciceToRepsType[s.exerciceSeanceId] == RepsType.DURATION) 0.0  // ⚠ DURATION → 0
    else (s.chargeKg?.toDouble() ?: 0.0) * (s.repsRealisees ?: 0)
}
val totalReps = allSeries.sumOf { s ->
    if (exerciceToRepsType[s.exerciceSeanceId] == RepsType.DURATION) 0  // ⚠ idem
    else s.repsRealisees ?: 0
}
```

## Duplication séance type
```kotlin
// SeanceListViewModel.duplicateSeance(id)
seanceDao.insertSeance(full.seance.copy(id=0, nom="${nom} (copie)"))
// Copie blocs avec remapping bloc.id → nouveau bloc.id
// Copie exercices avec nouveau seanceId + nouveau blocId mappé
```

## Points sensibles
- `ExerciceDraft.position` ≠ index de sauvegarde → position sauvegardée = `eIdx` dans `forEachIndexed`
- `SeanceFull.exercices` non ordonnée (Room @Relation) → toujours `.sortedBy { position }`
- Exercices libres (sans bloc) : `bloc_id = null` → gérés séparément dans `exercicesByBloc[null]`
- `supersetGroupe` : champ optionnel pour sous-grouper dans un CIRCUIT/SUPERSET
