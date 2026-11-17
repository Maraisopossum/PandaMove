package fr.pandamove.widget

/** Quantité ajoutée par le bouton « + 250 ml » du widget. */
const val PAS_EAU_ML = 250

/** Texte du message (toast) après un appui sur « + 250 ml », ou null quand l'affichage du widget suffit. */
fun messagePourEau(r: Resultat<Int>): String? = when (r) {
    is Resultat.Succes -> null
    is Resultat.Echec -> when (val e = r.erreur) {
        ErreurWidget.EcritureRefusee -> "Ce widget n’a pas le droit d’ajouter de l’eau : cochez l’option dans PandaMove > Profil."
        ErreurWidget.PlafondEau -> "Plafond d’eau du jour atteint (5 000 ml)."
        ErreurWidget.JetonRevoque, ErreurWidget.JetonInvalide -> "Jeton refusé : reliez de nouveau le widget."
        is ErreurWidget.TropVite -> "Trop rapide : réessayez dans ${e.retryApresS} s."
        ErreurWidget.Reseau -> "Pas de réseau : appuyez de nouveau, l’eau ne sera comptée qu’une fois."
        ErreurWidget.AdresseInvalide -> "Adresse du serveur invalide : reliez de nouveau le widget."
        else -> "L’eau n’a pas pu être ajoutée."
    }
}

/**
 * Faut-il garder la clé d'appel pour un nouvel essai ? Oui quand on ne sait pas si le serveur a traité l'appel (réseau coupé, 5xx, trop vite) :
 * renvoyer la même clé évite de compter l'eau deux fois. Non quand la réponse est définitive.
 */
fun garderLaCle(r: Resultat<Int>): Boolean = when (r) {
    is Resultat.Succes -> false
    is Resultat.Echec -> when (val e = r.erreur) {
        ErreurWidget.Reseau, ErreurWidget.ReponseIllisible, is ErreurWidget.TropVite -> true
        is ErreurWidget.Serveur -> e.statut >= 500
        else -> false
    }
}
