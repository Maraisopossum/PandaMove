# Conventions UI / Compose

## Structure écran standard
```kotlin
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FooScreen(
    onNavigateBack: () -> Unit,
    viewModel: FooViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    // dialogs avant le Scaffold
    Scaffold(topBar = { PandaTopBar(...) }) { innerPadding ->
        if (uiState.isLoading) { PandaLoadingIndicator(); return@Scaffold }
        LazyColumn(modifier = Modifier.fillMaxSize().padding(innerPadding)) { ... }
    }
}
```

## Composants partagés (designsystem)
| Composant | Usage |
|---|---|
| `PandaTopBar` | TopAppBar standard avec `onNavigateBack` ou `onOpenDrawer` |
| `PandaCard` | Card Material3 avec padding et elevation |
| `PandaButton` | Bouton primaire PandaPurple |
| `PandaEmptyState` | État vide avec icon + titre + description |
| `PandaLoadingIndicator` | Spinner centré |
| `PandaFilterChip` | Chip de filtre avec `selectedColor` |
| `SportIconBadge` | Badge icône sport coloré |
| `AssignSingleDatePickerDialog` | Picker date unique custom |
| `AssignMultiDatePickerDialog` | Picker multi-dates custom |
| `AssignRecurrenceDialog` | Dialog récurrence |
| `AssignMenuDialog` | Menu choix mode affectation |

## Couleurs thème
```kotlin
PandaPurple   // renforcement, actions primaires
PandaGreen    // running, FAB running
PandaBlue     // vélo
PandaOrange   // échauffement
PandaSubtext  // textes secondaires, labels
```

## Règles Compose
- `collectAsStateWithLifecycle()` **toujours** (lifecycle-aware)
- `Modifier.nestedScroll(scrollBehavior.nestedScrollConnection)` sur Scaffold si TopAppBar collapsible
- Clés `key = { item.id }` sur tous les `items {}` dans LazyColumn
- `@OptIn(ExperimentalMaterial3Api::class)` obligatoire pour : `ExposedDropdownMenuBox`, `DatePickerDialog`, `rememberTopAppBarState`, `SheetState`
- `Modifier.menuAnchor()` (sans paramètre, Material3 1.2.x)
- `imePadding()` sur les écrans avec champs de saisie

## Dialogs
- **Style unifié** : `Dialog(properties=DialogProperties(usePlatformDefaultWidth=false))` + `Surface(RoundedCornerShape(28.dp), tonalElevation=6.dp, fillMaxWidth().padding(horizontal=24.dp))`
- Boutons : `TextButton("Annuler")` + `Button(containerColor=PandaPurple, "Confirmer")`
- **Jamais** `AlertDialog` pour les dialogs custom (sauf menu simple)
- `DatePickerDialog` natif Material3 **supprimé** → remplacé par `AssignSingleDatePickerDialog`

## Conventions naming
- Screens : `XxxScreen.kt` — Composable public `fun XxxScreen(...)`
- ViewModels : `XxxViewModel.kt` — `class XxxViewModel : ViewModel()`
- UiState : `XxxUiState` — data class dans le même fichier que le VM ou `model/XxxUiState.kt`
- Composables privés : `private fun XxxCard(...)`, `private fun XxxRow(...)`

## Pratiques interdites
- ❌ `LiveData` (tout en Flow/StateFlow)
- ❌ `collectAsState()` sans lifecycle (memory leaks)
- ❌ Business logic dans les Composables
- ❌ Appels DAO sur le main thread
- ❌ `DatePickerDialog` natif Material3 pour l'affectation (utiliser `AssignSingleDatePickerDialog`)
- ❌ Clearer `assignTargetId` dans `onDismiss` du `AssignMenuDialog`
- ❌ `FLAG_ACTIVITY_NEW_TASK` sur l'intent fils (mettre sur le chooser uniquement)
- ❌ `rememberDatePickerState` dans les écrans d'affectation (supprimé)

## FAB et navigation drawer
- `AppDrawerNav` wrappe tout le `Scaffold` dans `PandaFitNavHost`
- `onOpenDrawer: () -> Unit` passé aux screens top-level via NavHost
- FABs sport : `containerColor = PandaGreen` (running/vélo), `PandaPurple` (renforcement)

## OSMDroid / AndroidView dans Compose
```kotlin
// Toujours remember(ctx) pour éviter de recréer la MapView à chaque recomposition
val mapView = remember(ctx) { MapView(ctx).apply { /* config */ } }
// Lifecycle : indispensable pour OSMDroid (gestion des tuiles téléchargées)
DisposableEffect(mapView) { mapView.onResume(); onDispose { mapView.onPause() } }
// update = {} est rappelé par Compose à chaque recomposition → idéal pour polyline live
AndroidView(factory = { mapView }, update = { mv -> /* redessiner overlays */ })
```
- Charger la config OSMDroid dans le factory : `Configuration.getInstance().load(ctx, prefs)`
- Utiliser `android.graphics.Color.parseColor(...)` pour la couleur polyline (évite le conflit avec `androidx.compose.ui.graphics.Color`)
- `clip(RoundedCornerShape(...))` sur le `Box` conteneur pour arrondir la carte

## Permissions runtime
```kotlin
var granted by remember { mutableStateOf(ContextCompat.checkSelfPermission(ctx, permission) == PERMISSION_GRANTED) }
val launcher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted = it }
// Appel : launcher.launch(Manifest.permission.ACCESS_FINE_LOCATION)
```
