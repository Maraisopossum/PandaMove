package fr.pandamove.widget

import android.appwidget.AppWidgetManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.Toast
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.unit.DpSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.Button
import androidx.glance.ButtonDefaults
import androidx.glance.ColorFilter
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
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
import androidx.glance.color.ColorProvider as CouleurJourNuit
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
import androidx.glance.semantics.contentDescription
import androidx.glance.semantics.semantics
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextStyle
import androidx.glance.unit.ColorProvider
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.time.LocalDate

// Les trois tailles : 2×2 (anneau et panda), 4×1 (énergie, barre, boutons), 4×2 (anneau, macros, eau, trois boutons).
// Glance choisit la plus grande qui tient dans le widget. Maquettes validées sur Claude Design (2026-11-17).
private val PETIT = DpSize(110.dp, 110.dp)
private val BARRE = DpSize(250.dp, 40.dp)
private val GRAND = DpSize(250.dp, 140.dp)

// Palette fixe (maquette) : vert PandaMove et touches menthe / crème ; l'ambre signale un dépassement, jamais un reproche.
private object Couleurs {
    val texte = CouleurJourNuit(day = Color(0xFF1E1E22), night = Color(0xFFF2F2F5))
    val secondaire = CouleurJourNuit(day = Color(0xFF505059), night = Color(0xFFB9B9C3))
    val vert = CouleurJourNuit(day = Color(0xFF047857), night = Color(0xFF34D399))
    val surVert = CouleurJourNuit(day = Color(0xFFFFFFFF), night = Color(0xFF00382A))
    val ambre = CouleurJourNuit(day = Color(0xFFA64B06), night = Color(0xFFFBBF24))
    val bouton2 = CouleurJourNuit(day = Color(0xC7FFFFFF), night = Color(0x1FFFFFFF))
    val piste = CouleurJourNuit(day = Color(0x1F1E1E22), night = Color(0x29F2F2F5))
    val proteines = CouleurJourNuit(day = Color(0xFF7C5CBF), night = Color(0xFFB8A1F0))
    val glucides = CouleurJourNuit(day = Color(0xFFB45309), night = Color(0xFFFBBF24))
    val lipides = CouleurJourNuit(day = Color(0xFF0277BD), night = Color(0xFF7CC4F0))
    val eau = CouleurJourNuit(day = Color(0xFF0369A1), night = Color(0xFF38BDF8))

    fun pour(role: Role): ColorProvider = when (role) {
        Role.PROTEINES -> proteines
        Role.GLUCIDES -> glucides
        Role.LIPIDES -> lipides
        Role.EAU -> eau
        Role.AUCUN -> vert
    }
}

class PandaMoveWidget : GlanceAppWidget() {
    override val sizeMode = SizeMode.Responsive(setOf(PETIT, BARRE, GRAND))

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val stockage = Stockage(context)
        val (etat, site, variante) = withContext(Dispatchers.IO) { Triple(stockage.etatAffichage(), stockage.site, stockage.pandaVariante) }
        provideContent { Contenu(etat, site, variante) }
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

/** Bouton d'actualisation : relit les totaux tout de suite. */
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

/** Dessin du panda pour la variante choisie (res/drawable-nodpi/panda_{f|m}_*, faits avec Gemini). */
private fun pandaRes(variante: String, p: Panda): Int {
    val femme = variante != "male"
    return when (p) {
        Panda.DEJEUNER -> if (femme) R.drawable.panda_f_dejeuner else R.drawable.panda_m_dejeuner
        Panda.OBJECTIF -> if (femme) R.drawable.panda_f_objectif else R.drawable.panda_m_objectif
        Panda.COLLATION -> if (femme) R.drawable.panda_f_collation else R.drawable.panda_m_collation
        Panda.PHOTO -> if (femme) R.drawable.panda_f_photo else R.drawable.panda_m_photo
    }
}

@Composable
private fun Contenu(etat: Etat, site: String?, variante: String) {
    val context = LocalContext.current
    val taille = LocalSize.current
    val fond = GlanceModifier.fillMaxSize().background(ImageProvider(R.drawable.widget_fond_degrade)).cornerRadius(24.dp)
    when {
        !etat.aDesDonnees -> Message(etat, variante, fond, context)
        taille.width < 200.dp -> Petit(etat, site, variante, context, fond)
        taille.height < 110.dp -> Large(etat, site, context, fond)
        else -> Grand(etat, site, variante, context, fond)
    }
}

@Composable
private fun Message(etat: Etat, variante: String, fond: GlanceModifier, context: Context) {
    val action = if (etat.statut == Statut.EN_ATTENTE) actionRunCallback<RafraichirAction>() else ouvrirConfig(context)
    Box(modifier = fond.clickable(action), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Image(provider = ImageProvider(pandaRes(variante, etat.panda)), contentDescription = null, modifier = GlanceModifier.size(72.dp))
            Texte(etat.message ?: "", 13, gras = true)
            if (etat.statut != Statut.EN_ATTENTE) Texte("Touchez pour commencer", 11, couleur = Couleurs.secondaire)
        }
    }
}

@Composable
private fun Texte(texte: String, taille: Int, gras: Boolean = false, couleur: ColorProvider = Couleurs.texte) =
    Text(texte, style = TextStyle(color = couleur, fontSize = taille.sp, fontWeight = if (gras) FontWeight.Bold else FontWeight.Normal))

private fun accent(etat: Etat): ColorProvider = if (etat.depasse) Couleurs.ambre else Couleurs.vert

/** Date de mise à jour (« mis à jour 14:32 ») ou, pour des données anciennes, leur âge et l'invitation à actualiser. */
private fun libelleMaj(etat: Etat): String? = when {
    etat.statut == Statut.ANCIEN && etat.age != null -> "${etat.age} : actualisez"
    etat.misAJour != null -> "mis à jour ${etat.misAJour}"
    else -> null
}

/** Bouton d'actualisation : pictogramme dessiné (res/drawable/ic_actualiser), zone tactile de 44 dp. */
@Composable
private fun BoutonActualiser(hauteur: Int = 44) {
    Box(
        modifier = GlanceModifier.width(44.dp).height(hauteur.dp).clickable(actionRunCallback<RafraichirAction>()).semantics { contentDescription = "Actualiser" },
        contentAlignment = Alignment.Center,
    ) {
        Image(provider = ImageProvider(R.drawable.ic_actualiser), contentDescription = null, colorFilter = ColorFilter.tint(Couleurs.secondaire), modifier = GlanceModifier.size(18.dp))
    }
}

@Composable
private fun Anneau(etat: Etat, dp: Int, tailleNombre: Int, context: Context) {
    val taillePx = (dp * context.resources.displayMetrics.density).toInt().coerceAtLeast(64)
    val couleur = accent(etat).getColor(context).toArgb()
    val fond = Couleurs.piste.getColor(context).toArgb()
    val ancien = etat.statut == Statut.ANCIEN
    Box(modifier = GlanceModifier.size(dp.dp), contentAlignment = Alignment.Center) {
        Image(
            provider = ImageProvider(Dessin.anneau(taillePx, if (ancien) 0f else etat.ratio, couleur, fond)),
            contentDescription = "Énergie du jour : ${etat.grandNombre} ${etat.legende}",
            modifier = GlanceModifier.fillMaxSize(),
        )
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Texte(etat.grandNombre, tailleNombre, gras = true, couleur = if (etat.depasse) Couleurs.ambre else Couleurs.texte)
            Texte(etat.legende, 9, couleur = Couleurs.secondaire)
        }
    }
}

@Composable
private fun LigneBarre(b: Barre, context: Context, ancien: Boolean) {
    val role = Couleurs.pour(b.role)
    val couleur = (if (b.depasse && b.role != Role.EAU) Couleurs.ambre else role).getColor(context).toArgb()
    val fond = Couleurs.piste.getColor(context).toArgb()
    Column(modifier = GlanceModifier.fillMaxWidth().padding(bottom = 2.dp)) {
        Row(modifier = GlanceModifier.fillMaxWidth()) {
            Texte(b.libelle, 10, couleur = Couleurs.secondaire)
            Spacer(modifier = GlanceModifier.defaultWeight())
            Texte(b.texte, 10, gras = true)
        }
        Image(
            provider = ImageProvider(Dessin.barre(if (ancien) 0f else b.ratio, couleur, fond)),
            contentDescription = "${b.libelle} : ${b.texte}",
            contentScale = ContentScale.FillBounds,
            modifier = GlanceModifier.fillMaxWidth().height(5.dp),
        )
    }
}

@Composable
private fun BoutonAction(texte: String, action: Action, principal: Boolean, modifier: GlanceModifier = GlanceModifier) {
    Button(
        text = texte,
        onClick = action,
        modifier = modifier,
        style = TextStyle(fontSize = 12.sp, fontWeight = FontWeight.Bold, color = if (principal) Couleurs.surVert else Couleurs.texte),
        colors = ButtonDefaults.buttonColors(backgroundColor = if (principal) Couleurs.vert else Couleurs.bouton2, contentColor = if (principal) Couleurs.surVert else Couleurs.texte),
    )
}

// 2×2 : l'anneau et le panda ; toucher ouvre le journal.
@Composable
private fun Petit(etat: Etat, site: String?, variante: String, context: Context, fond: GlanceModifier) {
    Box(modifier = fond.clickable(ouvrir(context, site, "/nutrition")), contentAlignment = Alignment.Center) {
        Anneau(etat, 96, 22, context)
        Box(modifier = GlanceModifier.fillMaxSize(), contentAlignment = Alignment.BottomStart) {
            Image(provider = ImageProvider(pandaRes(variante, etat.panda)), contentDescription = null, modifier = GlanceModifier.size(50.dp))
        }
        Box(modifier = GlanceModifier.fillMaxSize(), contentAlignment = Alignment.TopEnd) { BoutonActualiser() }
        if (etat.statut == Statut.ANCIEN && etat.age != null) {
            Box(modifier = GlanceModifier.fillMaxSize().padding(end = 10.dp, bottom = 6.dp), contentAlignment = Alignment.BottomEnd) {
                Texte(etat.age, 10, couleur = Couleurs.secondaire)
            }
        }
    }
}

// 4×1 : énergie et barre à gauche, actualisation et deux boutons à droite.
@Composable
private fun Large(etat: Etat, site: String?, context: Context, fond: GlanceModifier) {
    val ancien = etat.statut == Statut.ANCIEN
    val couleur = accent(etat).getColor(context).toArgb()
    val piste = Couleurs.piste.getColor(context).toArgb()
    Row(modifier = fond.clickable(ouvrir(context, site, "/nutrition")).padding(start = 14.dp, end = 8.dp), verticalAlignment = Alignment.CenterVertically) {
        Column(modifier = GlanceModifier.defaultWeight()) {
            Row(verticalAlignment = Alignment.Bottom) {
                Texte(etat.grandNombre, 22, gras = true, couleur = if (etat.depasse) Couleurs.ambre else Couleurs.texte)
                Spacer(modifier = GlanceModifier.width(6.dp))
                Texte(etat.legende, 11, couleur = Couleurs.secondaire)
            }
            Spacer(modifier = GlanceModifier.height(4.dp))
            Image(
                provider = ImageProvider(Dessin.barre(if (ancien) 0f else etat.ratio, couleur, piste)),
                contentDescription = "Énergie du jour",
                contentScale = ContentScale.FillBounds,
                modifier = GlanceModifier.fillMaxWidth().height(6.dp),
            )
            libelleMaj(etat)?.let { Texte(it, 10, couleur = Couleurs.secondaire) }
        }
        BoutonActualiser()
        BoutonAction("Photo", ouvrir(context, site, "/nutrition/photo"), principal = false)
        Spacer(modifier = GlanceModifier.width(6.dp))
        BoutonAction("+ 250 ml", actionRunCallback<AjouterEauAction>(), principal = true)
    }
}

// 4×2 : anneau, trois macros et l'eau, le panda, la mise à jour et trois boutons.
@Composable
private fun Grand(etat: Etat, site: String?, variante: String, context: Context, fond: GlanceModifier) {
    val ancien = etat.statut == Statut.ANCIEN
    Column(modifier = fond.clickable(ouvrir(context, site, "/nutrition")).padding(horizontal = 12.dp, vertical = 8.dp)) {
        Row(modifier = GlanceModifier.fillMaxWidth().defaultWeight(), verticalAlignment = Alignment.CenterVertically) {
            Anneau(etat, 86, 21, context)
            Spacer(modifier = GlanceModifier.width(10.dp))
            Column(modifier = GlanceModifier.defaultWeight()) {
                etat.macros.forEach { LigneBarre(it, context, ancien) }
                etat.eau?.let { LigneBarre(it, context, ancien) }
            }
            Spacer(modifier = GlanceModifier.width(6.dp))
            Image(provider = ImageProvider(pandaRes(variante, etat.panda)), contentDescription = null, modifier = GlanceModifier.size(56.dp))
        }
        Row(modifier = GlanceModifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            libelleMaj(etat)?.let { Texte(it, 10, couleur = Couleurs.secondaire) }
            Spacer(modifier = GlanceModifier.defaultWeight())
            BoutonActualiser(hauteur = 32)
        }
        Row(modifier = GlanceModifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            BoutonAction("Photo", ouvrir(context, site, "/nutrition/photo"), principal = false, modifier = GlanceModifier.defaultWeight())
            Spacer(modifier = GlanceModifier.width(6.dp))
            BoutonAction("+ 250 ml", actionRunCallback<AjouterEauAction>(), principal = true, modifier = GlanceModifier.defaultWeight())
            Spacer(modifier = GlanceModifier.width(6.dp))
            BoutonAction("Aliment", ouvrir(context, site, "/nutrition/ajouter"), principal = false, modifier = GlanceModifier.defaultWeight())
        }
    }
}
