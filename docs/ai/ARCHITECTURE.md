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
- Version actuelle : **25** (migrations v3→25 dans `PandaFitDatabase.kt`)
- Migrations dans `PandaFitDatabase.kt` + `addMigrations(...)` dans `DatabaseModule.kt`
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

## Services foreground (pattern)
Tous les services sont dans `app/service/`, annotés `@AndroidEntryPoint` pour l'injection Hilt.
```kotlin
@AndroidEntryPoint
class XxxService : Service() {
    @Inject lateinit var repository: XxxRepository
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START -> start(...)
            ACTION_STOP  -> stop()
        }
        return START_NOT_STICKY
    }
    override fun onDestroy() { scope.cancel(); super.onDestroy() }
    override fun onBind(intent: Intent?): IBinder? = null

    companion object {
        fun start(ctx: Context, ...) { ctx.startForegroundService(Intent(ctx, XxxService::class.java).apply { action = ACTION_START; ... }) }
        fun stop(ctx: Context) { ctx.startService(Intent(ctx, XxxService::class.java).apply { action = ACTION_STOP }) }
    }
}
```
Déclaration AndroidManifest : `<service android:name=".service.XxxService" android:foregroundServiceType="location|dataSync" />`

## GpsTrackingRepository (pattern Singleton LiveTrack)
```kotlin
@Singleton
class GpsTrackingRepository @Inject constructor(private val dao: GpsTrackPointDao) {
    private val _state = MutableStateFlow(LiveTrackState())
    val state: StateFlow<LiveTrackState> = _state.asStateFlow()

    fun startTracking(wId: Long) { ... }
    suspend fun addPoint(lat, lng, altM, speedMps, accuracyM, timestampMs) { /* update state + dao.insertOne() */ }
    fun stopTracking() { _state.value = _state.value.copy(isTracking = false) }
    fun reset() { _state.value = LiveTrackState() }
}
// Exposition dans ViewModel :
val liveTrackState = gpsRepo.state.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), LiveTrackState())
```

## OSMDroid dans Compose
```kotlin
val mapView = remember(ctx) {
    MapView(ctx).apply {
        Configuration.getInstance().load(ctx, ctx.getSharedPreferences("osmdroid", Context.MODE_PRIVATE))
        setTileSource(TileSourceFactory.MAPNIK)
        setMultiTouchControls(true)
        controller.setZoom(16.0)
    }
}
DisposableEffect(mapView) { mapView.onResume(); onDispose { mapView.onPause() } }
AndroidView(
    factory = { mapView },
    update = { mv ->
        mv.overlays.clear()
        if (points.size >= 2) {
            mv.overlays.add(Polyline().apply {
                setPoints(points.map { (lat, lng) -> GeoPoint(lat, lng) })
                outlinePaint.color = android.graphics.Color.parseColor("#7C5CBF")
                outlinePaint.strokeWidth = 10f
            })
        }
        if (points.isNotEmpty()) mv.controller.animateTo(GeoPoint(points.last().first, points.last().second))
        mv.invalidate()
    },
    modifier = Modifier.fillMaxSize(),
)
```
