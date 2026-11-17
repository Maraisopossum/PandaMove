package fr.pandamove.widget

import android.content.Context
import androidx.glance.appwidget.updateAll
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.time.LocalDate
import java.util.concurrent.TimeUnit

/**
 * Relit les totaux du jour sur le serveur, les garde en cache, puis redessine le widget.
 * Hors ligne, serveur en panne ou « trop vite » : le dernier résumé reste affiché (avec son âge s'il est ancien).
 * Jeton révoqué ou inconnu : le cache est effacé et le widget propose de relier de nouveau.
 */
suspend fun actualiser(context: Context): Resultat<Resume>? {
    val stockage = Stockage(context)
    val resultat: Resultat<Resume>? = withContext(Dispatchers.IO) {
        val adresse = stockage.adresse
        val jeton = stockage.jeton
        if (adresse.isNullOrBlank() || jeton.isNullOrBlank()) return@withContext null
        val r = ClientWidget(adresse, jeton).lireResume(LocalDate.now())
        when (r) {
            is Resultat.Succes -> stockage.enregistrerResume(r.valeur)
            is Resultat.Echec -> if (r.erreur == ErreurWidget.JetonRevoque || r.erreur == ErreurWidget.JetonInvalide) stockage.marquerRevoque()
        }
        r
    }
    PandaMoveWidget().updateAll(context)
    return resultat
}

class ActualisationWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result {
        actualiser(applicationContext)
        return Result.success()
    }
}

object Planification {
    private const val PERIODIQUE = "pandamove-widget-periodique"
    private const val PONCTUEL = "pandamove-widget-ponctuel"
    private val reseau = Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()

    /** Toutes les 30 minutes (minimum d'Android), avec réseau. */
    fun periodique(context: Context) {
        val travail = PeriodicWorkRequestBuilder<ActualisationWorker>(30, TimeUnit.MINUTES).setConstraints(reseau).build()
        WorkManager.getInstance(context).enqueueUniquePeriodicWork(PERIODIQUE, ExistingPeriodicWorkPolicy.KEEP, travail)
    }

    /** Une actualisation unique : à l'ajout du widget, à la mise à jour système, ou quelques minutes après un geste sur un bouton. */
    fun ponctuelle(context: Context, delaiMinutes: Long = 0) {
        val travail = OneTimeWorkRequestBuilder<ActualisationWorker>().setConstraints(reseau).setInitialDelay(delaiMinutes, TimeUnit.MINUTES).build()
        WorkManager.getInstance(context).enqueueUniqueWork(PONCTUEL, ExistingWorkPolicy.REPLACE, travail)
    }

    fun arreter(context: Context) {
        WorkManager.getInstance(context).cancelUniqueWork(PERIODIQUE)
        WorkManager.getInstance(context).cancelUniqueWork(PONCTUEL)
    }
}
