---
name: project-renforcement
description: Module renforcement — état d'implémentation des séances, timers et nouvelles fonctionnalités (2026-05-13)
metadata:
  type: project
---

Module renforcement complet avec instances calendrier, encodage avec historique, et nombreuses améliorations apportées le 2026-05-13.

**Why:** Application de fitness personnelle PandaMove (anciennement PandaFit).

**How to apply:** Référencer lors de modifications du module feature:strength ou feature:timer.

## Implémenté le 2026-05-13

### Renforcement
- `SeanceListScreen`: notes affichées sous le nom des séances types (style italic), séances planifiées/terminées séparées avec les 5 dernières terminées + bouton "Voir les X autres"
- `SeanceCreateScreen`: liste unifiée exercices libres + blocs dans l'ordre d'encodage, boutons haut/bas pour réordonner, sauvegarde intelligente (UPDATE in-place, pas delete+reinsert → préserve SerieRealiseeEntity)
- `SeanceDetailScreen`: sélection multi-dates (grille 4 semaines) + dialog de récurrence (tous les N jours × X occurrences)
- `InstanceExecuteScreen`: repos du bloc affiché pour superset (pas repos exercice), propagation KG aux séries suivantes non-validées, commentaire exercice + commentaire séance séparés, décompte 5-4-3-2-1 avant fin repos (bips), gong à la fin du repos

### Architecture
- `ActiveSessionManager` singleton Hilt dans `core:database` — timer survit à la navigation
- `InstanceExecuteViewModel` utilise `ActiveSessionManager` pour le chrono
- `PandaFitNavHost`: bandeau violet "séance en cours" en haut quand session active (hors écran execute)
- `HomeScreen`: carte "Séance en cours" avec chrono et bouton Reprendre

### Nouveau module feature:timer
- Onglet "Minuteur" dans la nav bar (icône Timer)
- Modes: COUNTDOWN, HIIT, TABATA, EMOM, AMRAP, FOR_TIME
- Décompte 5-4-3-2-1 + gong en fin de phase
- Presets: Tabata, HIIT 30/30, EMOM 10min, AMRAP 10min
- Timer survit à la navigation (ViewModel Activity-scoped)

### App
- Renommée PandaFit → PandaMove (AndroidManifest + textes visibles)
- Stats: fix chargement infini (flow.collect → .first())
- Profile: nom modifiable, thème sombre persistant via DataStore, export JSON fonctionnel
- Dark mode câblé dans MainActivity via ProfileViewModel.isDarkMode
