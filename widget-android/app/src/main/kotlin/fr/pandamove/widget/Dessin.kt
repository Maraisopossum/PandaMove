package fr.pandamove.widget

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.RectF

/** Glance n'a pas de Canvas : l'anneau et les barres sont dessinés dans un Bitmap puis affichés comme une image. */
object Dessin {
    /** Anneau de progression : fond complet, puis arc de `ratio` (0 à 1) à partir de midi. */
    fun anneau(taillePx: Int, ratio: Float, couleur: Int, fond: Int): Bitmap {
        val bitmap = Bitmap.createBitmap(taillePx, taillePx, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        val epaisseur = taillePx * 0.13f
        val marge = epaisseur / 2f + 1f
        val zone = RectF(marge, marge, taillePx - marge, taillePx - marge)
        val trait = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            style = Paint.Style.STROKE
            strokeWidth = epaisseur
            strokeCap = Paint.Cap.ROUND
        }
        trait.color = fond
        canvas.drawArc(zone, 0f, 360f, false, trait)
        if (ratio > 0f) {
            trait.color = couleur
            canvas.drawArc(zone, -90f, 360f * ratio.coerceIn(0f, 1f), false, trait)
        }
        return bitmap
    }

    /** Barre horizontale arrondie, étirée à la largeur disponible par le widget. */
    fun barre(ratio: Float, couleur: Int, fond: Int, largeurPx: Int = 600, hauteurPx: Int = 24): Bitmap {
        val bitmap = Bitmap.createBitmap(largeurPx, hauteurPx, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        val peinture = Paint(Paint.ANTI_ALIAS_FLAG)
        val rayon = hauteurPx / 2f
        peinture.color = fond
        canvas.drawRoundRect(RectF(0f, 0f, largeurPx.toFloat(), hauteurPx.toFloat()), rayon, rayon, peinture)
        val rempli = (largeurPx * ratio.coerceIn(0f, 1f)).coerceAtLeast(if (ratio > 0f) hauteurPx.toFloat() else 0f)
        if (rempli > 0f) {
            peinture.color = couleur
            canvas.drawRoundRect(RectF(0f, 0f, rempli, hauteurPx.toFloat()), rayon, rayon, peinture)
        }
        return bitmap
    }
}
