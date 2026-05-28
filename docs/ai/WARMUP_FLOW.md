# Échauffement (Warmup) — Flux complet

## Contexte
Module dédié aux séances d'échauffement, séparé du renforcement.  
Utilise les **mêmes entités** que le renforcement (`SeanceEntity`, `BlocSeanceEntity`, `ExerciceSeanceEntity`, `InstanceSeanceEntity`) discriminées par `SeanceCategory`.

## Catégories
```kotlin
SeanceCategory.WARMUP_GENERAL     // Échauffement général
SeanceCategory.WARMUP_MOBILITY    // Mobilité
SeanceCategory.WARMUP_ACTIVATION  // Activation
```

## Fichiers
| Rôle | Fichier |
|---|---|
| UI liste | `feature/warmup/ui/WarmupListScreen.kt` |
| VM liste | `feature/warmup/viewmodel/WarmupListViewModel.kt` |
| Routes | `WarmupRoutes` dans `app/navigation/PandaFitDestination.kt` |
| Création/édition | Réutilise `feature/strength/ui/SeanceCreateScreen.kt` avec `category=WARMUP_*` |

## WarmupListUiState
```kotlin
data class WarmupListUiState(
    val isLoading: Boolean = true,
    val selectedCategory: SeanceCategory = SeanceCategory.WARMUP_GENERAL,
    val warmupsByCategory: Map<SeanceCategory, List<SeanceEntity>> = emptyMap(),
    val instances: List<InstanceSeanceEntity> = emptyList(),
)
```

## Flux liste
```
WarmupListViewModel.load()
  → seanceDao.observeAllWarmups()         // WHERE seance_category IN (WARMUP_*)
  → instanceSeanceDao.observeAll()
  → groupBy { seanceCategory } → warmupsByCategory
WarmupListViewModel.selectCategory(cat) → filtre l'affichage par onglet
```

## Routes
```
WarmupRoutes.LIST              = "warmup"
WarmupRoutes.CREATE            = "warmup/create/{category}"
WarmupRoutes.DETAIL            = "warmup/{seanceId}"
WarmupRoutes.EDIT              = "warmup/{seanceId}/edit"
WarmupRoutes.create(category)  = "warmup/create/${category.name}"
WarmupRoutes.detail(id)        = "warmup/$id"
WarmupRoutes.edit(id)          = "warmup/$id/edit"
```

## Points sensibles
- `SeanceCategory.WARMUP_GENERAL` est la catégorie par défaut à la création
- L'exécution d'une instance warmup passe par `InstanceExecuteScreen` (même VM que renforcement)
- `seanceDao.observeAllWarmups()` filtre sur les 3 catégories WARMUP_* (pas STRENGTH)
