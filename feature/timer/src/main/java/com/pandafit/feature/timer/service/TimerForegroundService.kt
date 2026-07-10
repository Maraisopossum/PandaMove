package com.pandafit.feature.timer.service

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
import com.pandafit.core.designsystem.R as DesignSystemR

/**
 * Service de premier plan qui maintient le processus en vie pendant qu'un minuteur tourne.
 * La logique du timer reste dans le ViewModel ; ce service ne fait qu'afficher la notification
 * et empêcher Android de tuer le processus en arrière-plan.
 *
 * Cycle de vie :
 *  - Démarré via [start] → appelé dès le lancement du timer
 *  - Mis à jour via [update] → appelé à chaque seconde écoulée
 *  - Arrêté via [stop] → appelé au reset ou à la fin du décompte
 */
class TimerForegroundService : Service() {

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val time  = intent?.getStringExtra(EXTRA_TIME)  ?: "--:--"
        val label = intent?.getStringExtra(EXTRA_LABEL) ?: "Minuteur"
        val notification = buildNotification(this, time, label)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)
        } else {
            @Suppress("DEPRECATION")
            startForeground(NOTIFICATION_ID, notification)
        }
        return START_NOT_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    // ── Companion : factory + helpers ─────────────────────────────────────────

    companion object {

        const val NOTIFICATION_ID = 1337
        const val CHANNEL_ID     = "pandafit_timer"
        private const val EXTRA_TIME  = "extra_time"
        private const val EXTRA_LABEL = "extra_label"

        /** À appeler une seule fois (idempotent) avant tout [start]. */
        fun createChannel(context: Context) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Minuteur",
                NotificationManager.IMPORTANCE_LOW,
            ).apply {
                description = "Minuteur PandaFit en cours"
                setShowBadge(false)
            }
            context.getSystemService(NotificationManager::class.java)
                .createNotificationChannel(channel)
        }

        fun buildNotification(context: Context, time: String, label: String): Notification {
            val tapIntent = context.packageManager
                .getLaunchIntentForPackage(context.packageName)
                ?.apply { flags = Intent.FLAG_ACTIVITY_SINGLE_TOP }
            val pendingIntent = PendingIntent.getActivity(
                context, 0, tapIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
            return NotificationCompat.Builder(context, CHANNEL_ID)
                .setContentTitle(time)
                .setContentText(label)
                .setSmallIcon(DesignSystemR.drawable.ic_notification_brand)
                .setContentIntent(pendingIntent)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setSilent(true)
                .build()
        }

        /** Démarre le service (ou le met à jour s'il tourne déjà). */
        fun start(context: Context, time: String, label: String) {
            val intent = Intent(context, TimerForegroundService::class.java).apply {
                putExtra(EXTRA_TIME, time)
                putExtra(EXTRA_LABEL, label)
            }
            context.startForegroundService(intent)
        }

        /** Met à jour le contenu de la notification sans redémarrer le service. */
        fun update(context: Context, time: String, label: String) {
            context.getSystemService(NotificationManager::class.java)
                .notify(NOTIFICATION_ID, buildNotification(context, time, label))
        }

        /** Arrête le service et retire la notification. */
        fun stop(context: Context) {
            context.stopService(Intent(context, TimerForegroundService::class.java))
        }
    }
}
