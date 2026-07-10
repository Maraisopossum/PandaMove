# AI_INDEX — Navigation rapide fichiers (schema v25)
> **Démarrage rapide** : lis `CONTEXT_COMPACT.md` en premier (remplace 5 fichiers).  
> Tâches courantes : voir `PROMPT_TEMPLATES.md` pour les templates de prompts.

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
| Écran calendrier multi-sport | `feature/calendar/ui/CalendarScreen.kt` |
| VM calendrier | `feature/calendar/viewmodel/CalendarViewModel.kt` |
| Grille calendrier mensuelle réutilisable (designsystem) | `core/designsystem/components/AppCalendarView.kt` — ⚠ ne pas confondre avec l'écran ci-dessus |
| Prochaines séances (upcoming) | `CalendarViewModel` → `InstanceSeanceDao.observeUpcoming()` + `WorkoutDao.observeUpcoming()` |
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

## GPS Live Tracking (v20)
| Rôle | Fichier |
|---|---|
| Service ForegroundService GPS | `app/service/RunningTrackingService.kt` |
| Repository StateFlow live | `core/database/catalog/GpsTrackingRepository.kt` |
| State data class | `GpsTrackingRepository.kt` → `LiveTrackState` |
| Entité track point | `core/database/entities/GpsTrackPointEntity.kt` |
| DAO points GPS | `core/database/dao/GpsTrackPointDao.kt` |
| Screen avec carte OSMDroid | `feature/running/ui/RunningWorkoutExecuteScreen.kt` → `GpsTrackBlock` |
| VM avec GPS control | `feature/running/viewmodel/RunningExecuteViewModel.kt` |

## Base de données
| Rôle | Fichier |
|---|---|
| Database (v25) | `core/database/PandaFitDatabase.kt` |
| Migrations | `core/database/PandaFitDatabase.kt` — MIGRATION_3_4 … MIGRATION_24_25 |
| WorkoutDao | `core/database/dao/WorkoutDao.kt` |
| SeanceDao | `core/database/dao/SeanceDao.kt` |
| InstanceSeanceDao | `core/database/dao/InstanceSeanceDao.kt` |
| ExerciseDao | `core/database/dao/ExerciseDao.kt` |
| GpsTrackPointDao | `core/database/dao/GpsTrackPointDao.kt` |

## Navigation
| Rôle | Fichier |
|---|---|
| NavHost central | `app/navigation/PandaFitNavHost.kt` |
| Destinations + routes | `app/navigation/PandaFitDestination.kt` |
| Drawer navigation | `app/ui/AppDrawerNav.kt` |

## Timer
| Rôle | Fichier |
|---|---|
| Minuteur autonome | `feature/timer/` — modes COUNTDOWN|HIIT|TABATA|EMOM|AMRAP|FOR_TIME |
| Séparé du timer renforcement | `ActiveSessionManager` (@Singleton) pour le chrono session |

## Respiration (Breathing)
| Rôle | Fichier |
|---|---|
| Sélection méthode | `feature/breathing/ui/BreathingMethodSelectionScreen.kt` |
| Session respiration | `feature/breathing/ui/BreathingSessionScreen.kt` |
| Service foreground | `feature/breathing/service/BreathingService.kt` |
| Méthodes custom (DB) | `core/database/entities/CustomBreathingMethodEntity.kt` — table `custom_breathing_method` (v17) |
| Historique séances (DB) | `core/database/entities/BreathingSessionEntity.kt` — table `breathing_session` (v16) |

## Randonnée (Hiking)
| Rôle | Fichier |
|---|---|
| Écrans | `feature/hiking/` |

## Design System
| Rôle | Fichier |
|---|---|
| Composants partagés | `core/designsystem/components/` |
| Thème + couleurs | `core/designsystem/theme/` — PandaPurple, PandaGreen, PandaBlue, PandaOrange, PandaSubtext |

## Docs IA (ce dossier)
| Fichier | Contenu |
|---|---|
| `CONTEXT_COMPACT.md` | Contexte ultra-dense — lire EN PREMIER (remplace 5 fichiers) |
| `PROMPT_TEMPLATES.md` | Templates de prompts par tâche (économie tokens) |
| `ARCHITECTURE.md` | Patterns MVVM, Hilt, Room, GPS service, OSMDroid |
| `ROOM_SCHEMA_MIN.md` | Schéma Room complet v25 |
| `PROJECT_CONTEXT_MIN.md` | Contexte minimal v25 + flux critiques |
| `RUNNING_FLOW.md` | Flux running + GPS live tracking (feature introduite v20) |
| `STRENGTH_FLOW.md` | Flux renforcement + isolation template/instance |
| `CYCLING_FLOW.md` | Flux vélo |
| `WARMUP_FLOW.md` | Flux échauffement |
| `STATS_FLOW.md` | Flux stats + config DataStore + fun cards |
| `EXPORT_IMPORT_FLOW.md` | Export/import JSON v3.2 |
| `ASSIGN_FLOW.md` | Affectation calendrier détaillée |
| `CALENDAR_SYSTEM.md` | Système calendrier + dialogs affectation |
| `PROFILE_FLOW.md` | Profil + catalogue exercices + dark mode |
| `UI_CONVENTIONS.md` | Conventions Compose + OSMDroid + permissions runtime |
| `KNOWN_BUGS.md` | Bugs résolus + pièges architecturaux |
| `HOME_BANNER_IMAGES.md` | Guide images bannières HomeScreen |
