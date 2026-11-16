// Arborescence des écrans : pour chaque écran, l'écran « du dessus » où le bouton Retour de la barre du haut ramène. Le retour monte d'un
// niveau dans l'application, il ne dépend pas de l'historique du navigateur (qui contient aussi les liens suivis depuis l'Accueil, les
// rappels, un lien enregistré…). Un écran racine d'un module (liste, tableau de bord) n'a pas de parent : la barre ne montre pas de retour.
//
// Règle de la table : la première règle qui reconnaît l'adresse l'emporte (les adresses fixes avant les adresses à paramètre).
// `concordanceModules.test.ts` vérifie que chaque route de l'application est couverte ici ou déclarée racine.

export interface Parent {
  /** Adresse de l'écran parent (peut porter une recherche, par exemple le jour du journal). */
  vers: string
  /** Nom de l'écran parent, pour le lecteur d'écran (« Retour : Nutrition »). */
  libelle: string
}

type Regle = [adresse: RegExp, parent: (recherche: URLSearchParams) => Parent]

const fixe = (vers: string, libelle: string) => (): Parent => ({ vers, libelle })
// Le journal de nutrition garde le jour consulté
const journal = (r: URLSearchParams): Parent => {
  const jour = r.get('date')
  return { vers: jour && /^\d{4}-\d{2}-\d{2}$/.test(jour) ? `/nutrition?date=${jour}` : '/nutrition', libelle: 'Journal de nutrition' }
}

const REGLES: Regle[] = [
  // Renforcement
  [/^\/strength\/(planned|done|new|catalog)$/, fixe('/strength', 'Renforcement')],
  [/^\/strength\/instance\/[^/]+\/edit$/, fixe('/strength/planned', 'Séances programmées')],
  [/^\/strength\/instance\/[^/]+\/correct$/, fixe('/strength/done', 'Séances terminées')],
  [/^\/strength\/instance\/[^/]+\/report$/, fixe('/strength/done', 'Séances terminées')],
  [/^\/strength\/instance\/[^/]+$/, fixe('/strength/planned', 'Séances programmées')],
  [/^\/strength\/[^/]+\/edit$/, fixe('/strength', 'Renforcement')],
  [/^\/strength\/[^/]+$/, fixe('/strength', 'Renforcement')],
  // Course et vélo
  [/^\/running\/(records|new)$/, fixe('/running', 'Course')],
  [/^\/running\/[^/]+\/edit$/, fixe('/running', 'Course')],
  [/^\/running\/[^/]+$/, fixe('/running', 'Course')],
  [/^\/cycling\/(records|new)$/, fixe('/cycling', 'Vélo')],
  [/^\/cycling\/[^/]+\/edit$/, fixe('/cycling', 'Vélo')],
  [/^\/cycling\/[^/]+$/, fixe('/cycling', 'Vélo')],
  // Plans
  [/^\/plans\/semaine\/[^/]+$/, fixe('/plans/semaine', 'Semaine du plan')],
  [/^\/plans\/.+$/, fixe('/plans', 'Plans')],
  // Hyrox
  [/^\/hyrox\/stations\/[^/]+$/, fixe('/hyrox/stations', 'Stations')],
  [/^\/hyrox\/.+$/, fixe('/hyrox', 'Hyrox')],
  // Nutrition
  [/^\/nutrition\/aliments\/[^/]+$/, fixe('/nutrition/aliments', 'Mes aliments')],
  [/^\/nutrition\/aliments$/, fixe('/nutrition', 'Journal de nutrition')],
  [/^\/nutrition\/(ajouter|photo|entree\/[^/]+)$/, journal],
  [/^\/nutrition\/.+$/, fixe('/nutrition', 'Journal de nutrition')],
  // Respiration, mobilité
  [/^\/breathing\/.+$/, fixe('/breathing', 'Respiration')],
  [/^\/mobility\/seance$/, fixe('/mobility/apercu', 'Aperçu de la séance')],
  [/^\/mobility\/.+$/, fixe('/mobility', 'Mobilité')],
  // Outils, profil, administration
  [/^\/outils\/.+$/, fixe('/outils', 'Outils')],
  [/^\/profile\/.+$/, fixe('/profile', 'Profil')],
  [/^\/admin\/.+$/, fixe('/admin', 'Administration')],
  [/^\/admin$/, fixe('/profile', 'Profil')],
  [/^\/debug\/.+$/, fixe('/', 'Accueil')],
]

/** Écran parent de l'adresse donnée, ou null pour un écran racine (Accueil, premier écran d'un module, page introuvable). */
export function parentDe(pathname: string, recherche = ''): Parent | null {
  const chemin = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  for (const [adresse, parent] of REGLES) if (adresse.test(chemin)) return parent(new URLSearchParams(recherche))
  return null
}
