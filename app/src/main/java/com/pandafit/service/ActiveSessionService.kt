package com.pandafit.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import com.pandafit.MainActivity
import com.pandafit.R
import com.pandafit.core.database.ActiveSessionManager
import com.pandafit.core.database.entities.WorkoutType
import com.pandafit.navigation.CyclingRoutes
import com.pandafit.navigation.RunningRoutes
import com.pandafit.navigation.StrengthRoutes
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * Service persistant qui affiche une notification "session active" quand
 * l'utilisateur quitte l'app en cours de séance (renforcement, running, cyclisme).
 * Tap sur la notification → retour direct à l'écran de la session via NavigationRouter.
 *
 * Démarré depuis PandaFitApp.onCreate() via startService() (non-foreground).
 * Se promeut en foreground uniquement quand une session est détectée.
 */
@AndroidEntryPoint
class ActiveSessionService : Service() {

    @Inject lateinit var sessionManager: ActiveSessionManager

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private var isForeground = false

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        createChannel()
        observeSessions()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int = START_STICKY

    override fun onDestroy() {
        scope.cancel()
        super.onDestroy()
    }

    private fun observeSessions() {
        scope.launch {
            combine(
                sessionManager.activeInstanceId,
                sessionManager.activeSeanceName,
                sessionManager.activeWorkoutId,
                sessionManager.activeWorkoutName,
                sessionManager.activeWorkoutType,
            ) { instanceId, instanceName, workoutId, workoutName, workoutType ->
                when {
                    instanceId != null -> ActiveInfo(
                        title = "Renforcement en cours",
                        text  = instanceName ?: "Séance",
                        route = StrengthRoutes.instanceExecute(instanceId),
                    )
                    workoutId != null -> ActiveInfo(
                        title = "${typeName(workoutType)} en cours",
                        text  = workoutName ?: "Séance",
                        route = routeFor(workoutType, workoutId),
                    )
                    else -> null
                }
            }.collect { info ->
                if (info != null) showNotification(info)
                else             hideNotification()
            }
        }
    }

    private fun showNotification(info: ActiveInfo) {
        val notif = buildNotification(info.title, info.text, info.route)
        if (!isForeground) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(NOTIF_ID, notif, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)
            } else {
                @Suppress("DEPRECATION")
                startForeground(NOTIF_ID, notif)
            }
            isForeground = true
        } else {
            getSystemService(NotificationManager::class.java).notify(NOTIF_ID, notif)
        }
    }

    private fun hideNotification() {
        if (isForeground) {
            stopForeground(STOP_FOREGROUND_REMOVE)
            isForeground = false
        }
    }

    private fun buildNotification(title: String, text: String, route: String): Notification {
        val tapIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra(EXTRA_ROUTE, route)
        }
        val pendingIntent = PendingIntent.getActivity(
            this,
            route.hashCode(),
            tapIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(title)
            .setContentText(text)
            .setSmallIcon(R.drawable.ic_launcher_foreground)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setSilent(true)
            .build()
    }

    private fun createChannel() {
        NotificationChannel(CHANNEL_ID, "Session active", NotificationManager.IMPORTANCE_LOW)
            .apply { description = "Retour rapide vers la séance en cours" }
            .also { getSystemService(NotificationManager::class.java).createNotificationChannel(it) }
    }

    private fun typeName(type: WorkoutType?) = when (type) {
        WorkoutType.RUNNING  -> "Running"
        WorkoutType.CYCLING  -> "Cyclisme"
        WorkoutType.HIKING   -> "Randonnée"
        else                 -> "Séance"
    }

    private fun routeFor(type: WorkoutType?, id: Long) = when (type) {
        WorkoutType.RUNNING -> RunningRoutes.execute(id)
        WorkoutType.CYCLING -> CyclingRoutes.execute(id)
        else                -> "home"
    }

    private data class ActiveInfo(val title: String, val text: String, val route: String)

    companion object {
        const val EXTRA_ROUTE   = "navigate_to"
        private const val NOTIF_ID    = 3001
        private const val CHANNEL_ID  = "pandafit_session"

        fun start(ctx: Context) =
            ctx.startService(Intent(ctx, ActiveSessionService::class.java))
    }
}
