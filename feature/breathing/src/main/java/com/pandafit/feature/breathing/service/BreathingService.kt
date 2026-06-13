package com.pandafit.feature.breathing.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.IBinder
import com.pandafit.feature.breathing.engine.BreathingSessionEngine
import com.pandafit.feature.breathing.engine.PhaseState
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * Service de premier plan qui maintient la session de respiration en vie
 * même quand l'app passe en arrière-plan.
 *
 * Communication via le singleton [BreathingSessionEngine] (StateFlow partagé).
 *
 * Lancer : startForegroundService(Intent(ctx, BreathingService::class.java).apply { action = ACTION_START })
 * Arrêter : startService(Intent(ctx, BreathingService::class.java).apply { action = ACTION_STOP })
 */
@AndroidEntryPoint
class BreathingService : Service() {

    companion object {
        const val ACTION_START = "com.pandafit.breathing.START"
        const val ACTION_STOP  = "com.pandafit.breathing.STOP"

        private const val CHANNEL_ID   = "breathing_channel"
        private const val NOTIFICATION_ID = 42

        fun startIntent(context: Context) =
            Intent(context, BreathingService::class.java).apply { action = ACTION_START }

        fun stopIntent(context: Context) =
            Intent(context, BreathingService::class.java).apply { action = ACTION_STOP }
    }

    @Inject lateinit var engine: BreathingSessionEngine

    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.Main)

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        startForeground(NOTIFICATION_ID, buildNotification("Respiration", "Session en cours…"))
        observeEngine()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP -> {
                engine.stop()
                stopSelf()
            }
        }
        return START_STICKY
    }

    override fun onDestroy() {
        serviceScope.cancel()
        super.onDestroy()
    }

    // ── Observe engine state → update notification ──────────────────────────────

    private fun observeEngine() {
        serviceScope.launch {
            engine.state.collect { state ->
                if (state.isCompleted) {
                    updateNotification("Respiration", "Session terminée ✓")
                    stopSelf()
                } else if (state.isActive) {
                    val text = buildNotificationText(state)
                    updateNotification("Respiration — ${state.phase.label}", text)
                }
            }
        }
    }

    private fun buildNotificationText(state: PhaseState): String {
        val cycleText = "Cycle ${state.currentCycle}/${state.totalCycles}"
        return "$cycleText — ${state.phase.instruction}"
    }

    // ── Notification ────────────────────────────────────────────────────────────

    private fun createNotificationChannel() {
        val channel = NotificationChannel(
            CHANNEL_ID,
            "Respiration guidée",
            NotificationManager.IMPORTANCE_LOW,
        ).apply {
            description = "Session de respiration en cours"
            setSound(null, null)
        }
        getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }

    private fun buildNotification(title: String, text: String): Notification {
        val stopPendingIntent = PendingIntent.getService(
            this,
            0,
            stopIntent(this),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

        return Notification.Builder(this, CHANNEL_ID)
            .setContentTitle(title)
            .setContentText(text)
            .setSmallIcon(android.R.drawable.ic_media_play)
            .setOngoing(true)
            .addAction(
                Notification.Action.Builder(
                    android.graphics.drawable.Icon.createWithResource(this, android.R.drawable.ic_media_pause),
                    "Arrêter",
                    stopPendingIntent,
                ).build()
            )
            .build()
    }

    private fun updateNotification(title: String, text: String) {
        val nm = getSystemService(NotificationManager::class.java)
        nm.notify(NOTIFICATION_ID, buildNotification(title, text))
    }
}
