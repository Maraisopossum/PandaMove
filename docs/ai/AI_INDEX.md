# AI_INDEX — Navigation rapide fichiers

## Renforcement (Strength)
| Rôle | Fichier |
|---|---|
| Liste séances types | `feature/strength/ui/SeanceListScreen.kt` |
| Création/édition séance | `feature/strength/ui/SeanceCreateScreen.kt` |
| VM création/édition | `feature/strength/viewmodel/SeanceCreateViewModel.kt` |
| Détail séance type (lecture) | `feature/strength/ui/SeanceDetailScreen.kt` |
| Exécution instance | `feature/strength/ui/InstanceExecuteScreen.kt` |
| VM exécution | `feature/strength/viewmodel/InstanceExecuteViewModel.kt` |
| Rapport instance terminée | `feature/strength/ui/InstanceReportScreen.kt` |
| Affectation (assign) | `feature/strength/viewmodel/SeanceListViewModel.assignToDate/Dates/Recurring()` |
| Ordre sélection multi-exercices | `SeanceCreateViewModel.confirmMultiSelection()` — utilise `multiSelectedIds.mapNotNull` |

## Échauffement (Warmup)
| Rôle | Fichier |
|---|---|
| Liste séances échauffement | `feature/warmup/ui/WarmupListScreen.kt` |
| VM liste | `feature/warmup/viewmodel/WarmupListViewModel.kt` |
| Catégories | `SeanceCategory.WARMUP_GENERAL | WARMUP_MOBILITY | WARMUP_ACTIVATION` |
| Routes | `WarmupRoutes.LIST / CREATE / DETAIL / EDIT` dans `PandaFitDestination.kt` |
| Création/édition | Réutilise `StrengthRoutes.CREATE` avec `category=WARMUP_*` |

## Running
| Rôle | Fichier |
|---|---|
| Liste workouts | `feature/running/ui/RunningScreen.kt` |
| Création/édition workout | `feature/running/ui/RunningWorkoutDetailScreen.kt` |
| VM détail | `feature/running/viewmodel/RunningDetailViewModel.kt` |
| Exécution + saisie résultats | `feature/running/ui/RunningWorkoutExecuteScreen.kt` |
| VM exécution + saveResults | `feature/running/viewmodel/RunningExecuteViewModel.finishWorkout()` |
| Calcul allure live | `RunningExecuteViewModel.computePaceStr(dist, dur)` — auto-calcul à la saisie |
| Rapport lecture seule | `feature/running/ui/RunningWorkoutReportScreen.kt` |
| VM rapport | `feature/running/viewmodel/RunningReportViewModel.kt` |
| Persistance résultats | `core/database/dao/WorkoutDao.saveResults()` |
| Duplication template | `RunningReportViewModel.duplicateForDate()` |

## Vélo
| Rôle | Fichier |
|---|---|
| Liste workouts | `feature/cycling/ui/CyclingScreen.kt` |
| Détail/édition | `feature/cycling/ui/CyclingWorkoutDetailScreen.kt` |
| VM liste (assign) | `feature/cycling/viewmodel/CyclingListViewModel.kt` |

## Calendrier / Affectation
| Rôle | Fichier |
|---|---|
| Dialog menu affectation | `core/designsystem/components/AssignSessionDialogs.kt` · `AssignMenuDialog` |
| Dialog une date | `AssignSessionDialogs.kt` · `AssignSingleDatePickerDialog` |
| Dialog plusieurs dates | `AssignSessionDialogs.kt` · `AssignMultiDatePickerDialog` |
| Dialog récurrence | `AssignSessionDialogs.kt` · `AssignRecurrenceDialog` |
| Vue calendrier multi-sport | `feature/calendar/ui/AppCalendarView.kt` |
| Bug connu onDismiss | Voir `KNOWN_BUGS.md` (résolu) |

## Stats
| Rôle | Fichier |
|---|---|
| Écran stats | `feature/stats/ui/StatsScreen.kt` |
| VM calculs | `feature/stats/viewmodel/StatsViewModel.kt` |
| Modèles | `feature/stats/model/StatsUiState.kt` · `StatsConfig.kt` |
| Config préférences (DataStore) | `feature/stats/preferences/StatsPreferences.kt` |
| Écran config | `feature/stats/ui/StatsConfigScreen.kt` |
| VM config | `feature/stats/viewmodel/StatsConfigViewModel.kt` |

## Profil / Export
| Rôle | Fichier |
|---|---|
| Profil UI | `feature/profile/ui/ProfileScreen.kt` |
| Export JSON | `core/database/export/DataExportManager.kt` |
| Import JSON | `core/database/export/DataImportManager.kt` |
| DTOs export | `core/database/export/ExportDtos.kt` |
| Catalogue exercices | `feature/profile/ui/ExerciseCatalogScreen.kt` |
| VM catalogue (recherche sans accents, édition custom) | `feature/profile/viewmodel/ExerciseCatalogViewModel.kt` |

## Base de données
| Rôle | Fichier |
|---|---|
| Database (v13) | `core/database/PandaFitDatabase.kt` |
| Migrations | `core/database/PandaFitDatabase.kt` — MIGRATION_3_4 … MIGRATION_12_13 |
| WorkoutDao | `core/database/dao/WorkoutDao.kt` |
| SeanceDao | `core/database/dao/SeanceDao.kt` |
| InstanceSeanceDao | `core/database/dao/InstanceSeanceDao.kt` |
| ExerciseDao | `core/database/dao/ExerciseDao.kt` |

## Navigation
| Rôle | Fichier |
|---|---|
| NavHost central | `app/navigation/PandaFitNavHost.kt` |
| Destinations + routes | `app/navigation/PandaFitDestination.kt` |
| Drawer navigation | `app/ui/AppDrawerNav.kt` |

## Design System
| Rôle | Fichier |
|---|---|
| Composants partagés | `core/designsystem/components/` |
| Thème + couleurs | `core/designsystem/theme/` — PandaPurple, PandaGreen, PandaBlue, PandaOrange, PandaSubtext |
