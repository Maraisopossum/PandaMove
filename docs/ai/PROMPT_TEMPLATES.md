# PandaMove — Templates de prompts IA
> Copie-colle le template adapté à ta tâche. Remplace les [CROCHETS].
> Charge toujours `docs/ai/CONTEXT_COMPACT.md` au début d'une nouvelle session.

---

## 1. Nouvelle feature / écran

```
Contexte : lis docs/ai/CONTEXT_COMPACT.md.

Ajoute [DESCRIPTION FONCTIONNELLE] dans le module feature/[MODULE].

Contraintes :
- MVVM + UDF : tout dans le ViewModel, rien dans le Composable
- Hilt : @HiltViewModel + injection DAO(s) concerné(s)
- collectAsStateWithLifecycle() uniquement
- Commentaires en français
- Pas de BottomNav — navigation via AppDrawerNav

Fichiers à créer/modifier :
- feature/[module]/ui/[Nom]Screen.kt
- feature/[module]/viewmodel/[Nom]ViewModel.kt
- app/navigation/PandaFitDestination.kt (ajouter route)
- app/navigation/PandaFitNavHost.kt (câbler composable)
```

---

## 2. Migration Room

```
Contexte : lis docs/ai/CONTEXT_COMPACT.md.

Ajoute [DESCRIPTION DU CHANGEMENT DB] à la table [TABLE].
Schema actuel : v25.

À faire dans cet ordre :
1. Modifier l'Entity : core/database/entities/[Entity].kt
2. Écrire MIGRATION_25_26 dans PandaFitDatabase.kt
3. Ajouter MIGRATION_25_26 dans DatabaseModule.addMigrations()
4. Mettre à jour version = 26 dans PandaFitDatabase
5. Mettre à jour/ajouter méthodes DAO si besoin

Règle : ALTER TABLE uniquement (pas DROP/RECREATE sauf nécessaire absolu).
```

---

## 3. Fix bug

```
Contexte : lis docs/ai/CONTEXT_COMPACT.md. Lis aussi docs/ai/KNOWN_BUGS.md.

Bug : [DESCRIPTION SYMPTÔME]
Module concerné : feature/[module]
Fichier suspect : [fichier si connu]

Diagnostique d'abord la cause racine, propose le fix minimal, puis applique-le.
Ne refactorise pas le code environnant.
```

---

## 4. Ajout exercice / modification catalogue

```
Contexte : lis docs/ai/CONTEXT_COMPACT.md.

[Ajoute / Modifie] [EXERCICE(S)] dans le catalogue.

Fichiers concernés :
- core/database/catalog/ → exercices de base (si hard-coded)
- feature/profile/viewmodel/ExerciseCatalogViewModel.kt → logique recherche/filtrage
- feature/profile/ui/ExerciseCatalogScreen.kt → affichage

MuscleGroup disponibles (16) : PECTORAUX DOS EPAULES BICEPS TRICEPS QUADRICEPS
ISCHIO FESSIERS MOLLETS ABDOMINAUX TRAPEZES LOMBAIRES ADDUCTEURS OBLIQUES + AUTRE
```

---

## 5. Modification stats

```
Contexte : lis docs/ai/CONTEXT_COMPACT.md.

Modifie [DESCRIPTION] dans les stats.

⚠ Règles critiques stats :
- Filtre temporel sur scheduled_date (pas completed_at)
- DURATION series → repsRealisees = secondes, traiter comme 0 pour tonnage ET totalReps
- DataStore : @StatsDataStore qualifier obligatoire
- Config : StatsPreferences → StatsViewModel → StatsConfig dans UiState

Fichiers : feature/stats/viewmodel/StatsViewModel.kt · StatsScreen.kt · StatsConfig.kt
```

---

## 6. Ajout champ résultat running

```
Contexte : lis docs/ai/CONTEXT_COMPACT.md et docs/ai/RUNNING_FLOW.md.

Ajoute le champ [NOM_CHAMP] aux résultats running.

Checklist :
□ WorkoutEntity : ajouter le champ (nullable)
□ Migration Room vN→vN+1 (ALTER TABLE workouts ADD COLUMN ...) — v25 = version actuelle
□ WorkoutDao.saveResults() : ajouter le paramètre
□ RunningExecuteViewModel : updateOverallResult() + finishWorkout()
□ RunningExecuteUiState : ajouter le champ String
□ RunningWorkoutExecuteScreen : ResultInputCell ou ReadOnlyCell
□ RunningWorkoutReportScreen : GlobalResultsCard
□ RunningListViewModel.assignToDate() : nullifier le champ dans la copie template
□ RunningReportViewModel.duplicateForDate() : nullifier le champ
```

---

## 7. Service foreground (GPS ou autre)

```
Contexte : lis docs/ai/CONTEXT_COMPACT.md.

Crée/modifie un ForegroundService pour [DESCRIPTION].

Pattern à suivre (voir RunningTrackingService comme référence) :
- @AndroidEntryPoint dans app/service/
- Injection Hilt du Repository concerné
- onStartCommand : ACTION_START / ACTION_STOP
- startForeground avec foregroundServiceType approprié
- companion object : start(ctx) / stop(ctx)
- onDestroy : cleanup resources + scope.cancel()
- Déclarer dans AndroidManifest.xml : <service android:foregroundServiceType="...">
- Permission dans Manifest si nécessaire
```

---

## 8. Session de travail longue (nouvelle session Claude)

```
Nouvelle session sur PandaMove.

Lis d'abord : docs/ai/CONTEXT_COMPACT.md

[DESCRIPTION DE LA TÂCHE]

Contraintes projet :
- Commentaires en français
- Ne jamais modifier : google-services.json, app/keystore/, gradle/libs.versions.toml
- MVVM+UDF strict — pas de logique dans les Composables
- Room migration obligatoire si changement de schema (incrémenter version)
```

---

## 9. Audit / revue de code

```
Contexte : lis docs/ai/CONTEXT_COMPACT.md et docs/ai/KNOWN_BUGS.md.

Audite [FICHIER ou MODULE] pour :
□ Conformité MVVM (pas de logique dans Composables)
□ Pièges Room (@Relation non ordonnée, Dispatchers.IO, migrations)
□ Pièges navigation (assignTargetId, icône 📅 uniquement depuis liste)
□ collectAsStateWithLifecycle() (pas collectAsState())
□ Stats : filtre scheduled_date, tonnage DURATION=0
□ Isolation template/instance (instance_seance_id guard)
□ Imports inutilisés, dead code
```

---

## Tips économie tokens

| Situation | Action |
|---|---|
| Nouvelle session | Charge CONTEXT_COMPACT.md en 1 Read |
| Bug isolé | Lis seulement le fichier suspect + KNOWN_BUGS.md |
| Feature running | CONTEXT_COMPACT + RUNNING_FLOW.md |
| Feature strength | CONTEXT_COMPACT + STRENGTH_FLOW.md |
| Migration seule | Lis PandaFitDatabase.kt + DatabaseModule.kt uniquement |
| Design UI | CONTEXT_COMPACT + DESIGN.md |
| Pièges seulement | KNOWN_BUGS.md seul (liste pièges architecturaux) |
