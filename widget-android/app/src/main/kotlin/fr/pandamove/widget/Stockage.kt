package fr.pandamove.widget

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import java.time.Instant
import java.time.LocalDate

/**
 * Ce que le widget garde sur le téléphone.
 * - Jeton, adresse du serveur et adresse de PandaMove : SharedPreferences chiffrées (clé dans l'Android Keystore).
 * - Dernier résumé (des totaux, jamais un nom d'aliment) et état : SharedPreferences ordinaires, pour l'affichage hors ligne.
 */
class Stockage(context: Context) {
    private val app = context.applicationContext

    private val secrets: SharedPreferences by lazy {
        val cle = MasterKey.Builder(app).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build()
        EncryptedSharedPreferences.create(
            app, "pandamove_secrets", cle,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
        )
    }
    // Réglage d'apparence (pas un secret, conservé quand on délie le widget)
    private val reglages: SharedPreferences by lazy { app.getSharedPreferences("pandamove_reglages", Context.MODE_PRIVATE) }

    /** Variante du panda affichée : « male » (défaut) ou « female ». */
    var pandaVariante: String
        get() = if (reglages.getString("panda", "male") == "female") "female" else "male"
        set(v) = reglages.edit().putString("panda", if (v == "male") "male" else "female").apply()

    private val etat: SharedPreferences by lazy { app.getSharedPreferences("pandamove_etat", Context.MODE_PRIVATE) }

    /** Adresse de la fonction `widget-nutrition` (https://<projet>.supabase.co/functions/v1/widget-nutrition). */
    val adresse: String? get() = secrets.getString(CLE_ADRESSE, null)
    val jeton: String? get() = secrets.getString(CLE_JETON, null)

    /** Adresse de la PWA PandaMove (https://…), pour les liens des boutons. */
    val site: String? get() = secrets.getString(CLE_SITE, null)

    val estRelie: Boolean get() = !adresse.isNullOrBlank() && !jeton.isNullOrBlank()
    val estRevoque: Boolean get() = etat.getBoolean(CLE_REVOQUE, false)

    fun relier(adresse: String, jeton: String, site: String?) {
        secrets.edit().putString(CLE_ADRESSE, adresse.trim()).putString(CLE_JETON, jeton.trim()).putString(CLE_SITE, site?.trim()?.trimEnd('/')?.ifBlank { null }).apply()
        etat.edit().clear().apply()
    }

    fun delier() {
        secrets.edit().clear().apply()
        etat.edit().clear().apply()
    }

    /** Jeton révoqué : on efface les totaux (ils ne seraient plus autorisés) et on propose de relier de nouveau. */
    fun marquerRevoque() {
        etat.edit().remove(CLE_RESUME).remove(CLE_EAU_CLE).putBoolean(CLE_REVOQUE, true).apply()
    }

    fun resume(): Resume? = etat.getString(CLE_RESUME, null)?.let(::decoderResume)

    fun enregistrerResume(r: Resume) {
        etat.edit().putString(CLE_RESUME, encoderResume(r)).putBoolean(CLE_REVOQUE, false).apply()
    }

    /** Après un ajout d'eau : le total d'eau rendu par le serveur remplace celui du cache (affichage immédiat). */
    fun majEau(ml: Int) {
        val r = resume() ?: return
        enregistrerResume(r.copy(consomme = r.consomme.copy(eauMl = ml.toDouble())))
    }

    /**
     * Clé d'appel de l'ajout d'eau en cours. Conservée tant que le serveur n'a pas confirmé, pour qu'un nouvel appui
     * (réseau coupé au premier essai) renvoie la MÊME clé : le serveur ne compte alors l'eau qu'une fois. Une clé de plus de 10 min est jetée.
     */
    fun cleEau(maintenant: Instant = Instant.now(), nouvelle: () -> String = ::nouvelleCle): String {
        val existante = etat.getString(CLE_EAU_CLE, null)
        val creeLe = etat.getLong(CLE_EAU_LE, 0L)
        if (existante != null && maintenant.toEpochMilli() - creeLe < 10 * 60_000L) return existante
        val cle = nouvelle()
        etat.edit().putString(CLE_EAU_CLE, cle).putLong(CLE_EAU_LE, maintenant.toEpochMilli()).apply()
        return cle
    }

    fun cleEauConfirmee() {
        etat.edit().remove(CLE_EAU_CLE).remove(CLE_EAU_LE).apply()
    }

    fun etatAffichage(maintenant: Instant = Instant.now(), aujourdhui: LocalDate = LocalDate.now()): Etat =
        construireEtat(estRelie, estRevoque, resume(), maintenant, aujourdhui)

    private companion object {
        const val CLE_ADRESSE = "adresse"
        const val CLE_JETON = "jeton"
        const val CLE_SITE = "site"
        const val CLE_REVOQUE = "revoque"
        const val CLE_RESUME = "resume"
        const val CLE_EAU_CLE = "eau_cle"
        const val CLE_EAU_LE = "eau_le"
    }
}
