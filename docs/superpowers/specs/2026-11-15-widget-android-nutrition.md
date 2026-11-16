# Proposition : widget Android pour la nutrition (2026-11-15)

Statut : **proposition à valider**, rien n'est codé. Maquettes : canvas Claude Design « Widget Android Nutrition PandaMove »
(https://claude.ai/artifact/X88oA9WL8x3Sip3X231uCZ) : vue d'ensemble, écran d'accueil, widget 4×2 clair et sombre, six états, architecture,
écran du Profil, raccourcis et partage.

L'application Android (Kotlin, racine du dépôt) est abandonnée (CLAUDE.md) : cette proposition n'y touche pas. Le widget serait une **petite application
séparée**, qui ne reprend ni Room ni le code existant.

## Contrainte de départ
PandaMove est une **PWA** (React + PowerSync dans le navigateur). Android ne propose pas de widget aux applications web : l'API « Web Widgets » n'existe que sous
Windows (Edge). Les données du journal vivent dans la base SQLite du navigateur et dans Supabase ; une application native ne peut lire que Supabase.

## Trois voies

| Voie | Ce que ça donne | Code natif | Effort |
| --- | --- | --- | --- |
| **1. Raccourcis et partage** (PWA) | appui long sur l'icône : photo, +250 ml, ajout, journal ; partager une photo vers PandaMove | non | 1 à 2 jours |
| **2. Widget natif compagnon** | énergie restante, macros, eau sur l'écran d'accueil ; boutons vers la PWA | oui (Kotlin, Glance) | 5 à 7 jours |
| 3. Widget web | n'existe pas sur Android | | écartée |

**Recommandation** : faire la voie 1 maintenant (elle sert de base : les liens profonds de la voie 1 sont ceux des boutons du widget), puis décider de la voie 2.

## Voie 1 : raccourcis et partage (web)

- `manifest` (vite-plugin-pwa) : `shortcuts` (4 au plus) : `/nutrition/photo`, `/nutrition?action=eau`, `/nutrition/ajouter`, `/nutrition`.
- `/nutrition?action=eau` : ajoute 250 ml au jour courant puis affiche « 250 ml ajoutés · Annuler » (annuler = suppression logique de la ligne). Un double appui ajoute 500 ml :
  l'annulation reste à un toucher. Le paramètre est retiré de l'adresse après traitement (un rechargement ne réajoute rien).
- `share_target` : `POST /nutrition/photo` en `multipart/form-data`, champ `image`. Le service worker (Workbox : `importScripts` d'un petit fichier, ou `injectManifest`) garde la
  photo dans un cache, redirige vers `/nutrition/photo?partage=1` ; l'écran la lit, la supprime du cache et lance l'analyse comme pour une photo prise sur place.
- Tests : le manifeste (motifs verrouillés par `pwa.config.test.ts`), l'écran (action eau idempotente au rechargement, partage lu une seule fois).
- Limite connue : le partage n'existe que pour l'application installée (WebAPK) ; à vérifier sur un téléphone avant de promettre.

## Voie 2 : widget natif compagnon

### Principe
Le widget affiche des **totaux** lus sur le serveur avec un **jeton en lecture seule** créé dans le Profil. Il n'utilise jamais le mot de passe ni la session de l'utilisateur
(donc pas de double authentification à contourner), et ne voit **aucun nom d'aliment** : seulement des nombres. Ses boutons ouvrent la PWA par des liens profonds
(voie 1) : une seule voie d'écriture, hors ligne comprise.

### Serveur (Supabase)
- Migration `0021_jetons_widget.sql` : table `jetons_widget` (`id`, `user_id`, `nom`, `hash` unique, `ecriture_eau` bool, `created_at`, `derniere_lecture_at`, `revoque_at`). RLS `<table>_proprietaire`
  en lecture (la liste des widgets du Profil), insertion et révocation par fonction SQL ; **non synchronisée** par PowerSync ; ajoutée à `TABLES_UTILISATEUR` (suppression de compte).
- Création du jeton : fonction SQL `creer_jeton_widget(nom, ecriture_eau)` (`security definer`) qui tire 32 octets, renvoie `pmw_<base64url>` **une seule fois** et ne stocke que son SHA-256.
- Fonction Edge `resume-nutrition` (déployée avec `--no-verify-jwt` : le jeton du widget n'est pas un JWT) : `GET ?date=YYYY-MM-DD`, en-tête `Authorization: Bearer pmw_…` ; compare l'empreinte, refuse
  un jeton révoqué (401), limite à une lecture toutes les 20 s par jeton (429), vérifie que la date est à ±1 jour de celle du serveur, lit `repas_entrees` et `objectifs_nutrition`
  avec la clé de service **filtrée sur le `user_id` du jeton**, met à jour `derniere_lecture_at`.
- Réponse (contrat, versionné par `v`) :
  ```json
  { "v": 1, "date": "2026-11-15", "genereLe": "2026-11-15T12:40:03Z",
    "objectifs": { "kcal": 2400, "proteinesG": 150, "glucidesG": 280, "lipidesG": 75, "eauMl": 2500 },
    "consomme": { "kcal": 1240, "proteines": 98.0, "glucides": 148.0, "lipides": 41.0, "eauMl": 1250 },
    "repas": { "petit_dejeuner": 281, "dejeuner": 960, "collation": 0, "diner": 0 } }
  ```
  `objectifs` vaut `null` sans objectif défini. Aucun nom, aucune photo, aucun autre jour.
- Option « eau » (case dans le Profil) : fonction `ajouter-eau` (`POST {date, ml, cle}`) qui exige `ecriture_eau`, insère une ligne `repas = 'eau'` (id dérivé de `cle` : un double appui ne double pas),
  limite à 5 000 ml par jour. La ligne redescend vers la PWA par la synchro habituelle.
- Tests : fonctions pures (`resume.ts`, `jeton.ts`) sous Vitest comme `admin-comptes` ; migration sous PGlite (RLS, empreinte unique, révocation).

### PWA (Profil)
Section « Widget Android » (maquette « Profil ») : liste des widgets reliés (nom, création, dernière lecture), « Relier un widget » (jeton affiché une fois, copie, code QR), « Révoquer »,
case « Ajouter de l'eau depuis le widget ».

### Application Android (nouveau dépôt ou dossier `widget-android/`, jamais `app/`)
- Kotlin, Jetpack Glance, `minSdk` 26 (couleurs dynamiques dès Android 12, vert PandaMove sinon), une activité de configuration en Compose (coller ou scanner le jeton).
- `SizeMode.Responsive` : 2×2 (anneau), 4×1 (barre + 2 boutons), 4×2 (anneau, 4 barres, 3 boutons) ; clair et sombre.
- Jeton dans `EncryptedSharedPreferences` ; dernier résumé en cache (DataStore) pour l'affichage hors ligne.
- `WorkManager` : toutes les 30 minutes (contrainte réseau), à l'ouverture de l'écran d'accueil, et 2 minutes après un geste sur un bouton.
- Boutons : `ACTION_VIEW` vers `https://<domaine>/nutrition/photo`, `/nutrition?action=eau`, `/nutrition/ajouter` ; toucher le reste ouvre `/nutrition`. Android ouvre l'application installée (WebAPK) quand
  elle déclare cette portée : à valider sur le téléphone, sinon repli sur Chrome.
- États (maquette « États ») : à jour, objectif dépassé (ambre, « en trop »), données de plus de 2 h (estompé, âge affiché), non relié, sans objectif, jeton révoqué (401 : efface le cache et propose de relier).
- Distribution : APK signé avec une clé personnelle (hors dépôt, comme `app/keystore/`), installé à la main ; pas de Google Play dans un premier temps.
- Tests : JUnit sur le calcul d'état (anneau, ambre, ancienneté, formats français) et le client (réponses 200/401/429/réseau) ; aperçus Glance pour les 3 tailles en clair et sombre.

## Sécurité et vie privée
- Un jeton perdu ne donne accès qu'à des totaux du jour ; la révocation est immédiate (Profil) et le serveur la vérifie à chaque lecture.
- Rien de lisible par l'administrateur : la table ne contient que des empreintes, et l'administration ne lit aucune donnée de nutrition (principe du Profil > Confidentialité).
- L'écran verrouillé peut afficher le widget : seuls des nombres y figurent, jamais un nom d'aliment ; une case « masquer sur l'écran verrouillé » reste possible (Android 12+).
- Pas de nouvelle origine pour la CSP (le widget n'est pas une page web).

## Effort et ordre
| Étape | Contenu | Estimation |
| --- | --- | --- |
| 1 | raccourcis, action eau, partage de photo (PWA) | 1 à 2 jours |
| 2 | migration 0021, fonctions `resume-nutrition` (+ `ajouter-eau`), section Profil | 2 jours |
| 3 | application Android : widget 3 tailles, configuration, WorkManager, tests | 3 à 4 jours |
Déploiement manuel par Benoît, dans l'ordre : migration, fonctions (`--no-verify-jwt` pour `resume-nutrition`), client web, puis APK.

## Décisions à prendre
1. Lancer l'étape 1 seule, ou 1 et 2 d'un bloc ?
2. « +250 ml » depuis le widget : écrire directement (option « eau », étape 2 plus longue d'une demi-journée) ou ouvrir PandaMove ?
3. APK installé à la main, ou test interne Google Play (compte développeur payant, mises à jour automatiques) ?
4. Faut-il un 4×3 avec la liste des quatre repas ? Les données (`repas`) sont déjà dans le contrat.

## Risques
- Le lien profond ouvre Chrome au lieu de la PWA installée sur certains lanceurs : repli acceptable (la PWA reste utilisable), à tester sur le téléphone cible.
- Android limite les mises à jour d'un widget (économie de batterie) : l'affichage peut avoir jusqu'à 30 minutes de retard, d'où l'âge affiché au-delà de 2 h et l'ouverture du journal en un toucher.
- Dérive entre l'application Android et le contrat JSON : champ `v` et tests de contrat côté serveur.
