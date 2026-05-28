# Architecture PandaFit

## Pattern MVVM + UDF
- Un seul `StateFlow<XxxUiState>` par ViewModel
- L'UI ne contient **aucune logique métier** — uniquement des lambdas qui délèguent au VM
- Les events UI → ViewModel → State → Recompose (flux unidirectionnel)
- Pas de `LiveData`, pas de `MutableState` global

## Structure ViewModel type
```kotlin
@HiltViewModel
class FooViewModel @Inject constructor(
    private val dao: FooDao,
    savedStateHandle: SavedStateHandle,  // si paramètre de route
) : ViewModel() {
    private val _uiState = MutableStateFlow(FooUiState())
    val uiState: StateFlow<FooUiState> = _uiState.asStateFlow()

    init { load() }

    private fun load() {
        viewModelScope.launch {
            dao.observeAll().collect { _uiState.value = ... }
        }
    }
}
```

## Hilt
- `@HiltViewModel` sur tous les ViewModels
- `@Singleton` + `@Provides` dans `@Module @InstallIn(SingletonComponent::class)`
- Qualifiers (`@Retention(BINARY) annotation class XxxQualifier`) si plusieurs instances du même type
- `DatabaseModule` : fournit la DB Room + tous les DAOs
- `StatsPreferencesModule` : fournit le DataStore stats avec `@StatsDataStore`

## Room
- Version actuelle : **13** (migrations v3→13 dans `PandaFitDatabase.kt`)
- Migrations dans `PandaFitDatabase.kt` (ne pas oublier `addMigrations(...)` dans `.build()`)
- `@Relation` sans `ORDER BY` → toujours re-trier en Kotlin après récupération
- `TypeConverters` pour `LocalDate`, `LocalDateTime`, enums
- Jamais d'appel DAO sur le thread principal → `Dispatchers.IO` ou `suspend` dans coroutine
- **Isolation template/instance (v13)** : `blocs_seance` et `exercices_seance` ont un champ `instance_seance_id` nullable. `NULL` = appartient au template ; non-null = copie liée à une instance. Toujours filtrer par `instance_seance_id IS NULL` pour lire un template.

## Navigation Compose
```
NavHost (PandaFitNavHost.kt)
  AppDrawerNav (DrawerState partagé)
    Scaffold
      [contenu de chaque composable]
```
- Routes définies dans `PandaFitDestination.kt` (objects compagnons)
- Arguments : passés en String dans la route, lus via `SavedStateHandle` dans le VM
- Back : `navController.popBackStack()`
- Drawer : `drawerState.open()` / `.close()` via coroutine

## Compose conventions
- `collectAsStateWithLifecycle()` (pas `collectAsState()`)
- `@OptIn(ExperimentalMaterial3Api::class)` si `ExposedDropdownMenuBox`, `DatePickerDialog`, etc.
- `Modifier.menuAnchor()` sans paramètre (Material3 1.2.x)
- Dialog custom : `Dialog(usePlatformDefaultWidth=false)` + `Surface(RoundedCornerShape(28.dp), tonalElevation=6.dp)`
- `LazyColumn` avec `key` sur chaque `items {}` pour éviter les recompositions inutiles

## Gestion de l'état UI
- `rememberModalBottomSheetState()` + `ModalBottomSheet` pour les sheets
- État local UI (dialog visible, etc.) : `var showXxx by remember { mutableStateOf(false) }`
- Jamais `mutableStateOf` pour des données venant du ViewModel (utiliser le StateFlow)
- Dialogs d'affectation : `assignTargetId` reste non-null jusqu'à confirmation (ne pas le clearer dans `onDismiss` du menu)
