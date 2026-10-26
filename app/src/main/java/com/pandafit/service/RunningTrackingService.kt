package com.pandafit.service

import android.Manifest
import android.annotation.SuppressLint
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Build
import android.os.IBinder
import android.os.Looper
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.pandafit.MainActivity
import com.pandafit.R
import com.pandafit.core.database.catalog.GpsTrackingRepository
import com.pandafit.navigation.RunningRoutes
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import javax.inject.Inject

@AndroidEntryPoint
class RunningTrackingService : Service() {

    @Inject lateinit var gpsTrackingRepository: GpsTrackingRepository

    private lateinit var fusedLocationClient: FusedLocationProviderClient
    private lateinit var locationCallback: LocationCallback
    private var sensorManager: SensorManager? = null
    private var stepDetectorListener: SensorEventListener? = null
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)
        sensorManager = getSystemService(SensorManager::class.java)
        createChannel()
        setupLocationCallback()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val workoutId = intent?.getLongExtra(EXTRA_WORKOUT_ID, -1L) ?: -1L
        when (intent?.action) {
            ACTION_START -> startTracking(workoutId, intent.getBooleanExtra(EXTRA_START_PAUSED, false))
            ACTION_STOP  -> stopTracking()
        }
        return START_NOT_STICKY
    }

    private fun startTracking(workoutId: Long, startPaused: Boolean) {
        if (workoutId < 0) return
        gpsTrackingRepository.startTracking(workoutId, startPaused)
        val notif = buildNotification(workoutId)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIF_ID, notif, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION)
        } else {
            @Suppress("DEPRECATION")
            startForeground(NOTIF_ID, notif)
        }
        requestLocationUpdates()
        registerStepDetector()
    }

    private fun stopTracking() {
        fusedLocationClient.removeLocationUpdates(locationCallback)
        unregisterStepDetector()
        gpsTrackingRepository.stopTracking()
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    /**
     * Cadence via le capteur matériel de pas — nécessite ACTIVITY_RECOGNITION depuis Android 10.
     * Si non accordée, on se contente silencieusement de ne pas remonter de cadence (comme
     * aujourd'hui) plutôt que de planter le service GPS pour autant.
     */
    private fun registerStepDetector() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACTIVITY_RECOGNITION) != PackageManager.PERMISSION_GRANTED) return
        val sensor = sensorManager?.getDefaultSensor(Sensor.TYPE_STEP_DETECTOR) ?: return
        val listener = object : SensorEventListener {
            override fun onSensorChanged(event: SensorEvent) {
                scope.launch { gpsTrackingRepository.addStep() }
            }
            override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}
        }
        stepDetectorListener = listener
        sensorManager?.registerListener(listener, sensor, SensorManager.SENSOR_DELAY_NORMAL)
    }

    private fun unregisterStepDetector() {
        stepDetectorListener?.let { sensorManager?.unregisterListener(it) }
        stepDetectorListener = null
    }

    private fun setupLocationCallback() {
        locationCallback = object : LocationCallback() {
            override fun onLocationResult(result: LocationResult) {
                result.lastLocation?.let { loc ->
                    if (loc.accuracy > MAX_ACCURACY_M) return  // filtre les points trop imprécis
                    scope.launch {
                        gpsTrackingRepository.addPoint(
                            lat       = loc.latitude,
                            lng       = loc.longitude,
                            altM      = if (loc.hasAltitude()) loc.altitude else null,
                            speedMps  = if (loc.hasSpeed()) loc.speed else 0f,
                            accuracyM = loc.accuracy,
                            timestampMs = loc.time,
                        )
                    }
                }
            }
        }
    }

    @SuppressLint("MissingPermission")
    private fun requestLocationUpdates() {
        val request = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, INTERVAL_MS)
            .setMinUpdateIntervalMillis(MIN_INTERVAL_MS)
            .setMaxUpdateDelayMillis(MAX_DELAY_MS)
            .build()
        fusedLocationClient.requestLocationUpdates(request, locationCallback, Looper.getMainLooper())
    }

    private fun buildNotification(workoutId: Long): Notification {
        val tapIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra(ActiveSessionService.EXTRA_ROUTE, RunningRoutes.execute(workoutId))
        }
        val pi = PendingIntent.getActivity(
            this, workoutId.toInt(), tapIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("GPS actif")
            .setContentText("Suivi en cours…")
            .setSmallIcon(R.drawable.ic_launcher_foreground)
            .setContentIntent(pi)
            .setOngoing(true)
            .setSilent(true)
            .build()
    }

    private fun createChannel() {
        NotificationChannel(CHANNEL_ID, "GPS tracking", NotificationManager.IMPORTANCE_LOW)
            .apply { description = "Suivi GPS de la séance running" }
            .also { getSystemService(NotificationManager::class.java).createNotificationChannel(it) }
    }

    override fun onDestroy() {
        runCatching { fusedLocationClient.removeLocationUpdates(locationCallback) }
        unregisterStepDetector()
        scope.cancel()
        super.onDestroy()
    }

    companion object {
        const val ACTION_START       = "ACTION_START_GPS"
        const val ACTION_STOP        = "ACTION_STOP_GPS"
        const val EXTRA_WORKOUT_ID   = "extra_workout_id"
        const val EXTRA_START_PAUSED = "extra_start_paused"
        private const val NOTIF_ID       = 4001
        private const val CHANNEL_ID     = "pandafit_gps"
        private const val INTERVAL_MS    = 1_000L
        private const val MIN_INTERVAL_MS = 500L
        private const val MAX_DELAY_MS   = 2_000L
        private const val MAX_ACCURACY_M = 30f  // filtre les fixes GPS > 30 m d'imprécision

        fun start(ctx: Context, workoutId: Long, startPaused: Boolean = false) {
            val intent = Intent(ctx, RunningTrackingService::class.java).apply {
                action = ACTION_START
                putExtra(EXTRA_WORKOUT_ID, workoutId)
                putExtra(EXTRA_START_PAUSED, startPaused)
            }
            // Peut être appelé alors que l'app vient de passer en arrière-plan (verrouillage
            // pendant le décompte de démarrage) : sur Android 12+, l'OS peut refuser de démarrer
            // un foreground service dans ce cas. On avale l'exception plutôt que de crasher —
            // le pire résultat est une séance sans tracking GPS, pas un crash de l'app.
            runCatching { ctx.startForegroundService(intent) }
        }

        fun stop(ctx: Context) {
            ctx.startService(
                Intent(ctx, RunningTrackingService::class.java).apply {
                    action = ACTION_STOP
                }
            )
        }
    }
}
