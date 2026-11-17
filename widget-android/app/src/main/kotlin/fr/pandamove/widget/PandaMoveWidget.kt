package fr.pandamove.widget

import android.appwidget.AppWidgetManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.widget.Toast
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.unit.DpSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.glance.ButtonDefaults
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.GlanceTheme
import androidx.glance.Image
import androidx.glance.ImageProvider
import androidx.glance.LocalContext
import androidx.glance.LocalSize
import androidx.glance.action.Action
import androidx.glance.action.ActionParameters
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import androidx.glance.appwidget.SizeMode
import androidx.glance.appwidget.action.ActionCallback
import androidx.glance.appwidget.action.actionRunCallback
import androidx.glance.appwidget.action.actionStartActivity
import androidx.glance.appwidget.cornerRadius
import androidx.glance.appwidget.provideContent
import androidx.glance.background
import androidx.glance.Button
import androidx.glance.layout.Alignment
import androidx.glance.layout.Box
import androidx.glance.layout.Column
import androidx.glance.layout.ContentScale
import androidx.glance.layout.Row
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.height
import androidx.glance.layout.padding
import androidx.glance.layout.size
import androidx.glance.layout.width
import androidx.glance.material3.ColorProviders
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextStyle
import androidx.glance.color.ColorProvider as CouleurJourNuit
import androidx.glance.unit.ColorProvider
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.time.LocalDate

// Les trois tailles : 2×2 (anneau), 4×1 (barre + boutons), 4×2 (anneau, barres, boutons). Glance choisit la plus grande qui tient dans le widget.
private val PETIT = DpSize(110.dp, 110.dp)
private val BARRE = DpSize(250.dp, 40.dp)
private val GRAND = DpSize(250.dp, 140.dp)

// Vert PandaMove (module Nutrition) pour Android 11 et moins ; dès Android 12 le widget suit les couleurs dynamiques du fond d'écran.
private val CouleursPanda = ColorProviders(
    light = lightColorScheme(primary = Color(0xFF047857), onPrimary = Color.White, surface = Color(0xFFF6F6F8), onSurface = Color(0xFF1B1B1F), background = Color(0xFFF6F6F8)),
    dark = darkColorScheme(primary = Color(0xFF34D399), onPrimary = Color(0xFF00382A), surface = Color(0xFF1E1E22), onSurface = Color(0xFFE6E6EA), background = Color(0xFF1E1E22)),
)

// Ambre : objectif d'énergie dépassé (même teinte dans les deux thèmes pour rester lisible).
private val Ambre = CouleurJourNuit(day = Color(0xFFB45309), night = Color(0xFFFBBF24))

class PandaMoveWidget : GlanceAppWidget() {
    override val sizeMode = SizeMode.Responsive(setOf(PETIT, BARRE, GRAND))

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val stockage = Stockage(context)
        val (etat, site) = withContext(Dispatchers.IO) { stockage.etatAffichage() to stockage.site }
        provideContent {
            GlanceTheme(colors = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) GlanceTheme.colors else CouleursPanda) {
                Contenu(etat, site)
            }
        }
    }
}

class PandaMoveReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = PandaMoveWidget()

    override fun onEnabled(context: Context) {
        super.onEnabled(context)
        Planification.periodique(context)
        Planification.ponctuelle(context)
    }

    // Appelé par le système (toutes les 30 min au plus) et à l'ouverture de l'écran d'accueil après un redémarrage : on relit les totaux.
    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        super.onUpdate(context, appWidgetManager, appWidgetIds)
        Planification.periodique(context)
        Planification.ponctuelle(context)
    }

    override fun onDisabled(context: Context) {
        Planification.arreter(context)
        super.onDisabled(context)
    }
}

/** Bouton « + 250 ml » : écrit directement via la fonction (clé d'appel conservée tant que le serveur n'a pas confirmé), puis actualise. */
class AjouterEauAction : ActionCallback {
    override suspend fun onAction(context: Context, glanceId: GlanceId, parameters: ActionParameters) {
        val stockage = Stockage(context)
        val resultat: Resultat<Int>? = withContext(Dispatchers.IO) {
            val adresse = stockage.adresse
            val jeton = stockage.jeton
            if (adresse.isNullOrBlank() || jeton.isNullOrBlank()) return@withContext null
            val r = ClientWidget(adresse, jeton).ajouterEau(LocalDate.now(), PAS_EAU_ML, stockage.cleEau())
            if (!garderLaCle(r)) stockage.cleEauConfirmee()
            when (r) {
                is Resultat.Succes -> stockage.majEau(r.valeur)
                is Resultat.Echec -> if (r.erreur == ErreurWidget.JetonRevoque || r.erreur == ErreurWidget.JetonInvalide) stockage.marquerRevoque()
            }
            r
        }
        resultat?.let(::messagePourEau)?.let { texte -> withContext(Dispatchers.Main) { Toast.makeText(context, texte, Toast.LENGTH_LONG).show() } }
        PandaMoveWidget().update(context, glanceId)
        // Le total exact (et les repas saisis ailleurs) revient 2 minutes plus tard.
        Planification.ponctuelle(context, 2)
    }
}

/** Toucher le message « Chargement… » relit les totaux. */
class RafraichirAction : ActionCallback {
    override suspend fun onAction(context: Context, glanceId: GlanceId, parameters: ActionParameters) {
        actualiser(context)
    }
}

private fun ouvrir(context: Context, site: String?, chemin: String): Action =
    if (site.isNullOrBlank()) actionStartActivity(Intent(context, ConfigActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    else actionStartActivity(Intent(Intent.ACTION_VIEW, Uri.parse(site + chemin)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))

private fun ouvrirConfig(context: Context): Action =
    actionStartActivity(Intent(context, ConfigActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))

@Composable
private fun Contenu(etat: Etat, site: String?) {
    val context = LocalContext.current
    val taille = LocalSize.current
    val fond = GlanceModifier.fillMaxSize().background(GlanceTheme.colors.widgetBackground).cornerRadius(20.dp).padding(10.dp)
    when {
        !etat.aDesDonnees -> Message(etat, fond, context)
        taille.width < 200.dp -> Petit(etat, site, context, fond)
        taille.height < 110.dp -> Large(etat, site, context, fond)
        else -> Grand(etat, site, context, fond)
    }
}

@Composable
private fun Message(etat: Etat, fond: GlanceModifier, context: Context) {
    val action = when (etat.statut) {
        Statut.EN_ATTENTE -> actionRunCallback<RafraichirAction>()
        else -> ouvrirConfig(context)
    }
    Box(modifier = fond.clickable(action), contentAlignment = Alignment.Center) {
        Text(etat.message ?: "", style = TextStyle(color = GlanceTheme.colors.onSurface, fontSize = 13.sp, fontWeight = FontWeight.Medium))
    }
}

/** Couleur de l'anneau et des barres : accent du thème, ambre si l'objectif d'énergie est dépassé. */
@Composable
private fun accent(etat: Etat, depasse: Boolean = etat.depasse): ColorProvider = if (depasse) Ambre else GlanceTheme.colors.primary

@Composable
private fun Texte(texte: String, taille: Int, gras: Boolean = false, couleur: ColorProvider = GlanceTheme.colors.onSurface) =
    Text(texte, style = TextStyle(color = couleur, fontSize = taille.sp, fontWeight = if (gras) FontWeight.Bold else FontWeight.Normal))

@Composable
private fun Age(etat: Etat) {
    etat.age?.let { Texte(it, 10, couleur = GlanceTheme.colors.onSurfaceVariant) }
}

@Composable
private fun Anneau(etat: Etat, dp: Int, context: Context) {
    val taillePx = (dp * context.resources.displayMetrics.density).toInt().coerceAtLeast(64)
    val couleur = accent(etat).getColor(context).toArgb()
    val fond = GlanceTheme.colors.onSurface.getColor(context).copy(alpha = 0.14f).toArgb()
    Box(modifier = GlanceModifier.size(dp.dp), contentAlignment = Alignment.Center) {
        Image(provider = ImageProvider(Dessin.anneau(taillePx, if (etat.statut == Statut.ANCIEN) 0f else etat.ratio, couleur, fond)), contentDescription = "Énergie du jour : ${etat.grandNombre} ${etat.legende}", modifier = GlanceModifier.fillMaxSize())
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Texte(etat.grandNombre, if (dp >= 90) 20 else 17, gras = true, couleur = if (etat.depasse) Ambre else GlanceTheme.colors.onSurface)
            Texte(etat.legende, 9, couleur = GlanceTheme.colors.onSurfaceVariant)
        }
    }
}

@Composable
private fun LigneBarre(b: Barre, context: Context, etatAncien: Boolean) {
    val couleur = (if (b.depasse) Ambre else GlanceTheme.colors.primary).getColor(context).toArgb()
    val fond = GlanceTheme.colors.onSurface.getColor(context).copy(alpha = 0.14f).toArgb()
    Column(modifier = GlanceModifier.fillMaxWidth().padding(bottom = 3.dp)) {
        Row(modifier = GlanceModifier.fillMaxWidth()) {
            Texte(b.libelle, 10, couleur = GlanceTheme.colors.onSurfaceVariant)
            Spacer(modifier = GlanceModifier.defaultWeight())
            Texte(b.texte, 10, gras = true, couleur = if (b.depasse) Ambre else GlanceTheme.colors.onSurface)
        }
        Image(
            provider = ImageProvider(Dessin.barre(if (etatAncien) 0f else b.ratio, couleur, fond)),
            contentDescription = "${b.libelle} : ${b.texte}",
            contentScale = ContentScale.FillBounds,
            modifier = GlanceModifier.fillMaxWidth().height(5.dp),
        )
    }
}

@Composable
private fun BoutonAction(texte: String, action: Action, modifier: GlanceModifier = GlanceModifier) {
    Button(
        text = texte,
        onClick = action,
        modifier = modifier,
        style = TextStyle(fontSize = 11.sp, fontWeight = FontWeight.Medium, color = GlanceTheme.colors.onPrimary),
        colors = ButtonDefaults.buttonColors(backgroundColor = GlanceTheme.colors.primary, contentColor = GlanceTheme.colors.onPrimary),
    )
}

// 2×2 : l'anneau seul ; toucher ouvre le journal.
@Composable
private fun Petit(etat: Etat, site: String?, context: Context, fond: GlanceModifier) {
    Box(modifier = fond.clickable(ouvrir(context, site, "/nutrition")), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Anneau(etat, 84, context)
            Age(etat)
        }
    }
}

// 4×1 : énergie à gauche, deux boutons à droite.
@Composable
private fun Large(etat: Etat, site: String?, context: Context, fond: GlanceModifier) {
    Row(modifier = fond.clickable(ouvrir(context, site, "/nutrition")), verticalAlignment = Alignment.CenterVertically) {
        Column(modifier = GlanceModifier.defaultWeight()) {
            Row(verticalAlignment = Alignment.Bottom) {
                Texte(etat.grandNombre, 20, gras = true, couleur = if (etat.depasse) Ambre else GlanceTheme.colors.onSurface)
                Spacer(modifier = GlanceModifier.width(4.dp))
                Texte(etat.legende, 11, couleur = GlanceTheme.colors.onSurfaceVariant)
            }
            Spacer(modifier = GlanceModifier.height(3.dp))
            LigneBarreSeule(etat, context)
            Age(etat)
        }
        Spacer(modifier = GlanceModifier.width(8.dp))
        BoutonAction("Photo", ouvrir(context, site, "/nutrition/photo"))
        Spacer(modifier = GlanceModifier.width(6.dp))
        BoutonAction("+ 250 ml", actionRunCallback<AjouterEauAction>())
    }
}

@Composable
private fun LigneBarreSeule(etat: Etat, context: Context) {
    val couleur = accent(etat).getColor(context).toArgb()
    val fond = GlanceTheme.colors.onSurface.getColor(context).copy(alpha = 0.14f).toArgb()
    Image(
        provider = ImageProvider(Dessin.barre(if (etat.statut == Statut.ANCIEN) 0f else etat.ratio, couleur, fond)),
        contentDescription = "Énergie du jour",
        contentScale = ContentScale.FillBounds,
        modifier = GlanceModifier.fillMaxWidth().height(6.dp),
    )
}

// 4×2 : anneau, trois macros et l'eau, trois boutons.
@Composable
private fun Grand(etat: Etat, site: String?, context: Context, fond: GlanceModifier) {
    val ancien = etat.statut == Statut.ANCIEN
    Column(modifier = fond.clickable(ouvrir(context, site, "/nutrition"))) {
        Row(modifier = GlanceModifier.fillMaxWidth().defaultWeight(), verticalAlignment = Alignment.CenterVertically) {
            Anneau(etat, 76, context)
            Spacer(modifier = GlanceModifier.width(10.dp))
            Column(modifier = GlanceModifier.defaultWeight()) {
                etat.macros.forEach { LigneBarre(it, context, ancien) }
                etat.eau?.let { LigneBarre(it, context, ancien) }
            }
        }
        Age(etat)
        Row(modifier = GlanceModifier.fillMaxWidth().padding(top = 4.dp), verticalAlignment = Alignment.CenterVertically) {
            BoutonAction("Photo", ouvrir(context, site, "/nutrition/photo"), GlanceModifier.defaultWeight())
            Spacer(modifier = GlanceModifier.width(6.dp))
            BoutonAction("+ 250 ml", actionRunCallback<AjouterEauAction>(), GlanceModifier.defaultWeight())
            Spacer(modifier = GlanceModifier.width(6.dp))
            BoutonAction("Aliment", ouvrir(context, site, "/nutrition/ajouter"), GlanceModifier.defaultWeight())
        }
    }
}
