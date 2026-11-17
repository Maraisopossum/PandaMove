package fr.pandamove.widget

import android.app.Activity
import android.appwidget.AppWidgetManager
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.glance.appwidget.updateAll
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.time.LocalDate

/**
 * Relier le widget : coller l'adresse de la fonction, le jeton (Profil > Widget Android dans PandaMove) et l'adresse de PandaMove.
 * Lancée par le système à l'ajout d'un widget (APPWIDGET_CONFIGURE) ou depuis l'icône de l'application.
 * Le jeton est vérifié par une vraie lecture avant d'être gardé.
 */
class ConfigActivity : ComponentActivity() {
    private var idWidget = AppWidgetManager.INVALID_APPWIDGET_ID

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        idWidget = intent?.extras?.getInt(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID) ?: AppWidgetManager.INVALID_APPWIDGET_ID
        // Annulation par défaut : si l'utilisateur quitte sans relier, le système n'ajoute pas le widget.
        setResult(Activity.RESULT_CANCELED, Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, idWidget))
        setContent { Habillage { Ecran(Stockage(this), ::terminer) } }
    }

    private fun terminer() {
        if (idWidget != AppWidgetManager.INVALID_APPWIDGET_ID) setResult(Activity.RESULT_OK, Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, idWidget))
        finish()
    }
}

@Composable
private fun Habillage(contenu: @Composable () -> Unit) {
    val contexte = LocalContext.current
    val sombre = isSystemInDarkTheme()
    val couleurs = when {
        android.os.Build.VERSION.SDK_INT >= 31 -> if (sombre) dynamicDarkColorScheme(contexte) else dynamicLightColorScheme(contexte)
        sombre -> darkColorScheme(primary = Color(0xFF34D399), onPrimary = Color(0xFF00382A))
        else -> lightColorScheme(primary = Color(0xFF047857), onPrimary = Color.White)
    }
    MaterialTheme(colorScheme = couleurs) { Surface(modifier = Modifier.fillMaxSize()) { contenu() } }
}

private fun lirePressePapiers(contexte: Context): String =
    (contexte.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager).primaryClip?.takeIf { it.itemCount > 0 }?.getItemAt(0)?.coerceToText(contexte)?.toString()?.trim().orEmpty()

private fun messageErreur(e: ErreurWidget): String = when (e) {
    ErreurWidget.AdresseInvalide -> "L’adresse du serveur doit commencer par https:// (copiez-la depuis PandaMove > Profil > Widget Android)."
    ErreurWidget.JetonInvalide -> "Jeton inconnu : copiez-le de nouveau depuis PandaMove."
    ErreurWidget.JetonRevoque -> "Ce jeton a été révoqué : créez-en un nouveau dans PandaMove."
    ErreurWidget.Reseau -> "Pas de réseau, ou serveur injoignable."
    is ErreurWidget.TropVite -> "Trop rapide, réessayez dans ${e.retryApresS} secondes."
    ErreurWidget.VersionInconnue -> "Le serveur est plus récent que cette application : installez la dernière version."
    ErreurWidget.ReponseIllisible -> "Réponse inattendue : l’adresse est-elle bien celle de la fonction widget-nutrition ?"
    else -> "La liaison a échoué."
}

@Composable
private fun Ecran(stockage: Stockage, terminer: () -> Unit) {
    val contexte = LocalContext.current
    val portee = rememberCoroutineScope()
    var relie by remember { mutableStateOf(stockage.estRelie && !stockage.estRevoque) }
    var adresse by remember { mutableStateOf(stockage.adresse.orEmpty()) }
    var jeton by remember { mutableStateOf("") }
    var site by remember { mutableStateOf(stockage.site.orEmpty()) }
    var erreur by remember { mutableStateOf<String?>(null) }
    var occupe by remember { mutableStateOf(false) }

    fun relier() {
        erreur = null
        occupe = true
        portee.launch {
            val jetonUtilise = jeton.ifBlank { if (relie) stockage.jeton.orEmpty() else "" }
            val resultat = withContext(Dispatchers.IO) { ClientWidget(adresse, jetonUtilise).lireResume(LocalDate.now()) }
            occupe = false
            when (resultat) {
                is Resultat.Succes -> {
                    if (site.isNotBlank() && !adresseValide(site)) {
                        erreur = "L’adresse de PandaMove doit commencer par https:// (ex. https://pandamove.exemple.workers.dev)."
                        return@launch
                    }
                    stockage.relier(adresse, jetonUtilise, site)
                    stockage.enregistrerResume(resultat.valeur)
                    Planification.periodique(contexte)
                    PandaMoveWidget().updateAll(contexte)
                    terminer()
                }
                is Resultat.Echec -> erreur = messageErreur(resultat.erreur)
            }
        }
    }

    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text("Widget Nutrition PandaMove", style = MaterialTheme.typography.headlineSmall)
        Text(
            "Dans PandaMove, ouvrez Profil > Widget Android > « Relier un widget », puis copiez l’adresse du serveur et le jeton. " +
                "Le jeton ne sert qu’à lire vos totaux du jour (jamais un nom d’aliment) ; vous pouvez le révoquer à tout moment.",
            style = MaterialTheme.typography.bodyMedium,
        )
        if (relie) Text("Widget relié. Pour changer de jeton, collez le nouveau ci-dessous.", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.primary)

        OutlinedTextField(value = adresse, onValueChange = { adresse = it }, label = { Text("Adresse du serveur") }, singleLine = true, modifier = Modifier.fillMaxWidth(), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri))
        TextButton(onClick = { adresse = lirePressePapiers(contexte) }) { Text("Coller l’adresse") }

        OutlinedTextField(value = jeton, onValueChange = { jeton = it }, label = { Text(if (relie) "Nouveau jeton (facultatif)" else "Jeton") }, singleLine = true, visualTransformation = PasswordVisualTransformation(), modifier = Modifier.fillMaxWidth())
        TextButton(onClick = { jeton = lirePressePapiers(contexte) }) { Text("Coller le jeton") }

        OutlinedTextField(
            value = site, onValueChange = { site = it }, label = { Text("Adresse de PandaMove (boutons)") },
            supportingText = { Text("Pour ouvrir la photo, l’ajout d’aliment et le journal dans l’application installée.") },
            singleLine = true, modifier = Modifier.fillMaxWidth(), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri),
        )

        erreur?.let { Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodyMedium) }

        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(onClick = ::relier, enabled = !occupe && adresse.isNotBlank() && (jeton.isNotBlank() || relie)) { Text(if (occupe) "Vérification…" else "Relier") }
            if (relie) OutlinedButton(onClick = { stockage.delier(); Planification.arreter(contexte); relie = false; jeton = "" }) { Text("Délier") }
        }
    }
}
