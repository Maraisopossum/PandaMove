# PandaMove web

Application web (PWA) de PandaMove : React + TypeScript + Vite, données locales SQLite (PowerSync) synchronisées avec Supabase. Elle fonctionne hors ligne ; les écritures partent vers Supabase au retour du réseau.

## Installation

Prérequis : Node.js 22.13 ou plus récent (voir `engines` dans `package.json`).

```bash
cd web
npm ci
cp .env.example .env.local   # puis renseigner les valeurs (voir plus bas)
npm run dev                  # http://localhost:5173
```

Commandes utiles :

| Commande | Rôle |
|---|---|
| `npm run lint` | ESLint |
| `npm run typecheck` | vérification TypeScript (`tsc -b`) |
| `npm test` | tests Vitest (unitaires, écrans, schéma Postgres sous PGlite) |
| `npm run build` | build de production dans `dist/` |
| `npm run preview` | sert `dist/` en local (le service worker et le hors-ligne n'existent qu'en build) |
| `npm run images` | régénère les images WebP du panda depuis `assets/` |
| `npm run test:e2e` | tests Playwright (voir « Tests de bout en bout ») |

## Variables d'environnement

Fichier `web/.env.local` (ignoré par git, ne jamais le committer) :

| Variable | Contenu |
|---|---|
| `VITE_SUPABASE_URL` | URL du projet Supabase |
| `VITE_SUPABASE_ANON_KEY` | clé publique (anon) du projet Supabase |
| `VITE_POWERSYNC_URL` | URL de l'instance PowerSync |

Sans ces variables, l'application affiche « Configuration manquante » au lieu d'une page blanche.

Variables des tests de bout en bout (dans le shell, jamais dans un fichier versionné) : `E2E_EMAIL`, `E2E_PASSWORD`, `E2E_EMAIL2`, `E2E_PASSWORD2`, `E2E_REQUIRED`.

## Supabase

Exécuter les migrations **dans l'ordre**, une seule fois chacune, dans l'éditeur SQL du tableau de bord Supabase :

1. `supabase/migrations/0001_schema.sql` : tables
2. `supabase/migrations/0002_rls.sql` : RLS
3. `supabase/migrations/0003_dark_mode_nullable.sql`
4. `supabase/migrations/0004_instance_clock.sql`
5. `supabase/migrations/0005_instance_progression.sql`
6. `supabase/migrations/0006_durcissement.sql` : droits, politiques RLS, index uniques, colonne `validated_at`
7. `supabase/migrations/0007_nom_instance_note_exercice.sql` : colonnes `instances_seance.nom` (renommer une séance jouée sans toucher au modèle) et `exercices_seance.notes` (note par exercice). Idempotente, sans défaut ni réécriture de ligne.
8. `supabase/migrations/0008_seances_cardio.sql` : tables `seances_course` et `seances_velo` (séances de cardio planifiées dans l'agenda)
9. `supabase/migrations/0009_respiration.sql` : tables `methodes_respiration` et `seances_respiration`
10. `supabase/migrations/0010_sorties.sql` : table `sorties` (activités de course et de vélo réellement faites, import de fichiers)
11. `supabase/migrations/0011_sorties_source_garmin.sql` : accepte la source `garmin` pour une sortie
12. `supabase/migrations/0012_mobilite_rappels.sql` : table `seances_mobilite` (historique de mobilité) et colonne `user_settings.rappels_json` (réglages des rappels)
13. `supabase/migrations/0013_rappels_push.sql` : tables `push_abonnements` et `rappels_push_envoyes` (rappels par notification push). **Hors synchronisation PowerSync** : rien à changer dans les règles. Facultative : sans elle et sans la fonction, l'application fonctionne comme avant.

Toutes sont idempotentes. Règle générale : une migration s'applique **avant** la fusion sur `main` du client qui l'utilise, puis les règles PowerSync (`powersync/sync-rules.yaml`) sont redéployées si de nouvelles tables apparaissent.

À propos de 0006 :

- **Exécuter 0006 AVANT de fusionner ou de pousser sur la branche de production** : Cloudflare (Workers Builds) déploie à chaque fusion sur `main`, et le nouveau client écrit `series_realisees.validated_at`. Sans 0006, Supabase répond PGRST204 (colonne inconnue) ; ce code est réessayé sans fin et, comme les envois partent dans l'ordre, **toute la file d'envoi de chaque appareil se bloque** (toutes tables), sans perte de données, jusqu'à la migration. Garde-fou du client : sur PGRST204 visant `validated_at`, il renvoie la ligne sans cette colonne (avertissement dans la console) ; la file avance, mais ces séries n'ont pas d'ancre de repos côté serveur. Ne pas compter sur ce repli.
- Elle retire tout droit au rôle `anon` et le DELETE physique au rôle `authenticated` (la suppression est logique, par `deleted_at`). Le rôle de réplication de PowerSync (`powersync_role` ou `postgres`) n'est pas touché.
- Elle s'interrompt sans rien modifier si des doublons empêchent la création des index uniques (`user_settings` vivantes en double pour un même utilisateur, ou blocs d'instance en double). Le message d'erreur donne la requête qui les repère.
- Elle est rejouable sans erreur.

À propos de 0007 : exécutez-la **avant de pousser** (comme 0006). Sans elle, Supabase répond PGRST204 sur `nom` / `notes` ; le client renvoie alors la ligne sans cette colonne (avertissement dans la console) pour ne pas bloquer la file d'envoi, mais le nom propre d'une séance jouée et les notes d'exercice ne sont pas synchronisés tant que la migration manque.

Authentification : ajouter l'origine du site (locale et Cloudflare) dans **Authentication → URL Configuration** pour les liens magiques.

## PowerSync

- **Connexion à la base** : rôle de réplication avec `replication` et `bypassrls`, `select` sur les tables de `public`, publication `powersync` (voir l'en-tête de `dev/docker-compose.powersync.yml`).
- **Client Auth** : activer l'authentification Supabase et ajouter l'audience **`authenticated`**. Sans elle, la connexion échoue (erreur `PSYNC_S2105`).
- **Sync Streams** : coller le contenu de `powersync/sync-rules.yaml` (format Sync Streams, `edition: 3`) dans l'éditeur du tableau de bord, puis déployer. Chaque utilisateur ne reçoit que ses lignes (`user_id = auth.user_id()`).

## Régions d'hébergement

À noter ici une fois vérifiées dans les tableaux de bord (données d'entraînement personnelles) :

- Supabase : région du projet = _à compléter_ (Project Settings → General)
- PowerSync : région de l'instance = _à compléter_

## Déploiement sur Cloudflare (Workers avec ressources statiques)

Cloudflare propose maintenant « Create application » avec Git (Workers Builds). `web/wrangler.jsonc` déclare le dossier `dist` comme ressources statiques et renvoie `index.html` pour toute URL inconnue (une URL profonde rechargée, ex. `/strength/catalog`, sert l'application au lieu d'une 404).

Étapes manuelles, dans le tableau de bord Cloudflare :

0. **Avant toute fusion qui déploie ce client** : toutes les migrations qu'il utilise exécutées dans Supabase (voir « Supabase » ; sinon la file d'envoi des appareils se bloque).
1. **Workers & Pages → Create application → Import a repository**, choisir le dépôt, nom du projet `pandamove`.
2. Réglages de build :
   - répertoire racine (Advanced settings → Root directory) : `web`
   - commande de build : `npm run build`
   - commande de déploiement : `npx wrangler deploy` (valeur par défaut ; lit `wrangler.jsonc`)
3. **Variables de build** (Settings → Build → Variables and secrets, côté *build*, pas seulement côté Worker) : `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_POWERSYNC_URL`, et `NODE_VERSION` = `22`. Elles sont intégrées au build : relancer un déploiement après toute modification.
4. **Branche de production** (Settings → Build → Branch control) : `main`.
5. Ajouter l'URL Cloudflare (`https://pandamove.<compte>.workers.dev` ou le domaine) dans Supabase Auth (URL Configuration).
6. Vérifier sur téléphone : ouverture, connexion, installation (« Ajouter à l'écran d'accueil »), puis rechargement en mode avion.

**En-têtes de sécurité** : `public/_headers` (copié dans `dist/`) applique une CSP (scripts et workers de l'application, `wasm-unsafe-eval` pour SQLite, tuiles OpenStreetMap, connexions vers `*.supabase.co` et `*.powersync.journeyapps.com`), `X-Frame-Options: DENY`, `Referrer-Policy` et `Permissions-Policy`. Toute nouvelle origine externe doit y être ajoutée, sinon le navigateur la bloque (message « Refused to … » dans la console). Test local avec les vrais en-têtes : `npm run build` puis `npx wrangler dev --local`.

**Hors ligne** : le service worker précache le shell (JS, CSS, HTML, polices, icônes, `wa-sqlite-async.wasm`, ~5,4 Mo). Les images du panda et de la mobilité sont mises en cache à leur première vue (`CacheFirst`, cache `images-panda`).

Alternative Cloudflare Pages : build `npm run build`, sortie `dist`, répertoire racine `web`, et un fichier `public/_redirects` contenant `/* /index.html 200`.

## Tests de bout en bout

Les tests Playwright (`e2e/*.spec.ts`) visent le vrai Supabase et le vrai PowerSync, avec deux comptes de test.

**En CI** : workflow `.github/workflows/e2e.yml`, sur chaque PR qui touche `web/` et à la demande (Actions → E2E → Run workflow). Il lit 7 secrets GitHub (Settings → Secrets and variables → Actions) : `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_POWERSYNC_URL` (mêmes valeurs que `.env.local`) et `E2E_EMAIL`, `E2E_PASSWORD`, `E2E_EMAIL2`, `E2E_PASSWORD2` (deux comptes de **test** distincts, jamais un compte personnel). Sans eux, le job s'arrête avec un avertissement, sans échec. Avec eux, `E2E_REQUIRED=1` : tout manque fait échouer. Un seul worker et une seule exécution à la fois (comptes partagés). Le dépôt étant public, aucune trace ni rapport HTML n'est publié (ils contiendraient les mots de passe saisis) : seulement les captures d'écran des échecs.

Le build des e2e est fait avec `VITE_E2E=1` (posé par `playwright.config.ts`) : il embarque l'écran `/debug/write` utilisé par `offline-sync` et `rls-live`, absent du build déployé.

**En local**, navigateur Playwright installé une fois (`npx playwright install chromium`) :

```bash
cd web
E2E_EMAIL=… E2E_PASSWORD=… E2E_EMAIL2=… E2E_PASSWORD2=… E2E_REQUIRED=1 npm run test:e2e
```

- Playwright sert le **build de production** (`npm run build` puis `npm run preview -- --port 4173 --strictPort`, http://localhost:4173) : le rechargement hors ligne exige le service worker, absent du serveur de dev. `web/.env.local` est lu par le build. Le parcours attend que le service worker contrôle la page avant de couper le réseau. Un serveur déjà lancé sur 4173 est réutilisé : le relancer après une modification du code.
- Sans les variables, chaque test est **sauté** avec la liste des variables manquantes ; avec `E2E_REQUIRED=1`, il **échoue** à la place (à utiliser avant une bascule).
- `rls-live.spec.ts` demande deux comptes de test distincts : le second ne doit voir ni modifier aucune ligne du premier, et le rôle anonyme doit être refusé (migration 0006 requise).
- Les comptes de test se créent dans Supabase (Authentication → Users). Ne jamais écrire leurs identifiants dans un fichier versionné.
- Développement entièrement local (facultatif, non validé) : `supabase start` puis `dev/docker-compose.powersync.yml` (images épinglées).

## Circuit automatique et minuteur d'exercice

Dans l'écran d'exécution d'une séance : un bloc **Circuit** (au moins un exercice en durée) propose « Démarrer le circuit » ; un exercice en durée hors circuit propose « Démarrer le minuteur ». Décompte 3-2-1, minuteur, série enregistrée automatiquement, repos entre exercices et en fin de tour. Réglages du circuit (tours, repos, durées) : édition de la séance. L'état du circuit n'est pas conservé au rechargement de la page ; les séries déjà enregistrées le restent.

**Retours** (réglages « Son », « Vibration », « Voix » dans l'encart de lancement et dans Profil → Séance, mémorisés par appareil dans `localStorage`, clé `pandamove.circuit.reglages`) :
- **Son** (activé par défaut) : bips comme sur Android, via Web Audio. Débloqué par le clic de lancement.
- **Vibration** (activée par défaut) : court au départ et chaque seconde des 5 dernières, long à la fin d'un exercice, double au repos et à la fin du circuit. `navigator.vibrate` : Chrome et Firefox sous Android ; **absente sur iOS Safari** (et sur ordinateur), sans effet ni erreur.
- **Voix** (désactivée par défaut, pour ne pas doubler un lecteur d'écran) : `speechSynthesis` en fr-FR, « Prochain exercice : … », « Allez ! », « Repos », « Circuit terminé », et compte à rebours 3-2-1 parlé en option. Disponibilité et voix françaises variables selon l'appareil ; silencieux si absente.
- Pendant le circuit l'écran est gardé allumé (Screen Wake Lock : Chrome, Edge, Safari 16.4+). Android ne vibre ni ne parle : ces deux retours sont une adaptation web.

## Outils de l'écran d'exécution

- **Repos** : le badge « Repos : mm:ss » ouvre un menu (allonger / écourter de 30 s, arrêter). La colonne « Repos » du tableau est saisissable : la durée saisie remplace celle de l'exercice pour le repos qui suit la validation. **Minuteur** : préréglages (30 s à 5 min), ± 5 s. Tout est basé sur des horodatages ; les réglages (+30 s, arrêt, minuteur manuel) sont gardés par séance dans `localStorage` (clé `pandamove.repos.<id de la séance>`) : un rechargement restitue le décompte.
- **Disques** : calculateur barre / haltère chargeable avec les disques de « Mon matériel » (algorithme glouton de l'Android, charge atteignable la plus proche sinon). **Montée en charge** : paliers d'échauffement (protocole débutant / standard / lourd) arrondis sur le matériel déclaré, à cocher dans l'ordre ; comme sur Android ce sont des paliers éphémères, ils ne créent pas de séries.
- **Note par exercice** : enregistrée à la sortie du champ dans `exercices_seance.notes` (migration 0007), sur la ligne de la séance jouée uniquement ; elle figure au rapport (détail de l'exercice), dans le résumé copié et dans l'export HTML / PNG. Sur Android elle n'est qu'en mémoire (`exerciceNotesLocal`) : c'est une amélioration web. Le commentaire de séance, lui, est enregistré avec l'instance.
- **Bandeau de progression** : pour un exercice en progression, objectif de la prochaine fois et séries qui atteignent déjà la cible. À l'ouverture d'une séance non terminée, charge et reps cibles sont alignées sur l'objectif de progression courant (comme l'Android).
- **Menu ⋮ de la séance** : « Modifier le nom » (renomme LA SÉANCE JOUÉE dans `instances_seance.nom`, migration 0007 ; l'Android renomme le modèle, ce qui viole l'isolation template / instance. Nom vide = nom de la séance type ; le nom propre s'affiche partout : exécution, rapport, listes, calendrier, reprise, export / import), « Modifier les exercices » (éditeur de séance appliqué à CETTE séance seulement, jamais au modèle ; retirer un exercice déjà travaillé demande confirmation et supprime ses séries) et « Supprimer la séance » (suppression logique avec confirmation).
- **Quitter l'exécution** : retour du navigateur, menu ou lien → dialogue de l'Android « Quitter la séance ? » : « Rester ici », « Aller dans le menu » (la séance reste en cours) ou « Quitter sans enregistrer » quand aucune série n'est validée (la séance redevient programmée), « Annuler la séance » (suppression logique de la séance jouée après confirmation, même vide ; l'Android remet seulement les séries à zéro). Pas de dialogue quand tout est déjà validé ni pour une séance terminée. Un seul bloqueur de navigation à la fois est possible dans le routeur : l'écran de correction a le sien.
- **Corriger une séance terminée** : bouton « Corriger la séance » du rapport (icône Modifier de l'Android) → `/strength/instance/:id/correct`. Séries validables, annulables, ajout / retrait ; enregistrement immédiat ; l'horloge et l'état « terminée » ne changent pas, la progression n'est pas ré-évaluée (le récap du rapport reste celui de la fin de séance). Sortie après modification : « Retourner au rapport ? ».
- **Bips de fin de repos** : un bip discret à chaque seconde des 5 dernières secondes du repos (réglage « Son » commun avec le circuit, débloqué au premier appui sur la page ; muet pendant un circuit, qui sonne lui-même).
- **Séance en cours** : le titre de l'onglet affiche chrono et repos, l'écran reste allumé (Wake Lock) et un bandeau « Reprendre » apparaît sur les autres écrans pour une séance démarrée depuis moins de 24 h et non terminée.

## Listes de séances et prise en main

- **Vocabulaire** : « séance type » (le modèle réutilisable), « séance programmée » (à faire, planifiée ou en cours), « séance terminée ». Le menu du module s'appelle « Renforcement », comme sur Android.
- **Sélection multiple** (Séances types, programmées, terminées) : bouton « Sélectionner » ou appui long (500 ms) sur une carte ; case par carte, barre « N sélectionnés » avec « Supprimer » (Android : la corbeille est la seule action groupée, pas de tri ni de favoris). Règle de l'Android : une séance type qui a des séances jouées est ARCHIVÉE (historique gardé), sinon supprimée ; une séance archivée est purgée pour de bon avec ses séances jouées. Suppressions logiques. L'écran Renforcement (`/strength`) regroupe, comme l'Android, les sections Séances types, programmées, terminées (5 puis « Voir les N autres ») et archivées ; une même sélection peut porter sur toutes les sections (types et séances jouées mélangés). Les entrées « Séances programmées » et « Séances terminées » du menu ouvrent les vues complètes de ces deux sections.
- **Pour commencer** : carte à trois étapes (importer l'export Android, ajouter le catalogue de base, créer sa première séance) sur l'accueil (l'écran Renforcement vide n'a qu'un bouton principal, « Créer ma première séance »). Elle se déduit des données (aucune séance type ni séance jouée), se masque à la main (`localStorage`, clé `pandamove.demarrage.masque`) et disparaît dès que la première séance existe.
- **Couleurs des groupes musculaires** : les couleurs de l'Android servent de repère (liseré, teinte de la puce choisie) dans le sélecteur d'exercices ; le texte garde la couleur du thème (contrastes AA vérifiés).
- **Export du rapport** : texte copiable, fichier HTML autonome, image PNG (dessinée sur un canvas, sans bibliothèque), partage natif.

## Design

La source de vérité visuelle est `web/DESIGN.md` (design system « PandaMove System » issu de Stitch) et `web/DESIGN.tokens.json`. Les jetons vivent dans `:root` de `src/app/app.css` : rayons (carte 16 px, bouton 12 px, grande carte 24 px, pilule), hauteurs (contrôle 48 px, cellule 44 px, barre 52 px), ombres, couleurs de module, accents d'écran.

- **Polices** : Plus Jakarta Sans (titres) et Inter (corps), hébergées avec l'application (`@fontsource-variable`, `src/app/polices.css`), avec repli sur la pile système ; aucune requête vers un CDN.
- **Échelle** : racine à 100 % (1 rem = 16 px) ; corps 16, petit 14, micro 13, titres 22 (mobile) / 20 / 18, titre d'écran 24, chiffre clé 24-26, chrono 40. Elle suit le réglage de taille de police de l'utilisateur.
- **Thème** : clair par défaut, sombre par choix explicite (Profil ou menu) ; contrastes AA vérifiés dans les deux thèmes (`src/app/contraste*.test.ts`).
- **Écarts assumés (accessibilité AA)** : barre du calendrier `#D24700` (au lieu de `#E65100`), vert et violet éclaircis en thème sombre, texte orange du calendrier `#B43C00`, barre du haut de 52 px, cellules tactiles de 44 px. Liste complète en tête de `DESIGN.md`.

## Importer des séances créées par une IA

Profil → « Importer des données » → onglet **Séances créées par une IA**. Ce flux n'a rien à voir avec l'import de l'export Android (onglet « Export Android », inchangé) : il ne crée que des **séances types** de renforcement (modèles), jamais de séances jouées.

1. **Télécharger la consigne** : « Télécharger la consigne pour l'IA (.md) » (ou « Copier la consigne »). Elle est générée sur l'appareil et contient le rôle de l'IA, la règle de sortie (« réponds uniquement par un bloc JSON »), le schéma complet (champs, valeurs autorisées, bornes, défauts), des règles de bon sens, un exemple de 2 séances (avec un superset et un circuit) et la liste des exercices disponibles (catalogue de base et vos exercices personnalisés, regroupés par muscle). « Télécharger l'exemple (.json) » et « Télécharger le schéma (.json) » existent pour les IA qui acceptent des pièces jointes.
2. **La donner à l'IA** (ChatGPT, Claude, Gemini…), avec votre demande à la fin (« Ma demande : … »).
3. **Enregistrer ou coller la réponse** : le fichier `.json`, ou le texte collé tel quel. Si l'IA répond avec du texte autour d'un bloc ```` ```json ````, le premier bloc JSON est extrait. Les guillemets typographiques (« “ ” ») et les virgules finales sont corrigés, et l'aperçu le signale ; toute autre erreur de syntaxe est refusée avec la ligne fautive.
4. **Vérifier l'aperçu** : pour chaque séance, nombre de blocs, d'exercices et de séries, durée estimée, exercices reconnus au catalogue ou « à créer », avertissements. Les erreurs bloquantes sont listées avec leur chemin (par exemple `seances[1].blocs[0].exercices[2].series : doit être un entier entre 1 et 20`) ; tant qu'il en reste, le bouton « Importer N séances » n'existe pas. Rien n'est écrit avant la confirmation.
5. **Importer** : « 3 séances importées, 2 exercices créés » et un lien vers « Séances types ». Tout le fichier est écrit en une seule transaction (tout ou rien).

**Format « PandaMove – séances IA » v1** : `{ format: "pandamove-seances-ia", version: 1, seances: [{ nom, notes?, blocs: [{ nom?, type, reposInterExercicesSec?, reposFinTourSec?, tours?, exercices: [{ exercice, series, reps?, dureeSec?, chargeKg? | charge: "PDC", reposSec?, tempo?, consigne?, bilateral?, typeExercice?, muscles?: { principal, secondaires? }, progression?: { activee, systeme?, repsMin?, repsMax?, incrementKg?, seuilDeload? } }] }] }] }`. De 1 à 20 séances par fichier. `type` vaut `LIBRE` (exercices hors bloc), `ECHAUFFEMENT`, `ACTIVATION`, `SUPERSET`, `CIRCUIT` ou `RECUPERATION`. Les valeurs omises prennent les défauts de l'éditeur (repos 90 s, +2,5 kg, double progression 8–12, circuit de 3 tours…). Les champs inconnus ne cassent pas l'import : ils sont ignorés et signalés. Le code de référence est `src/core/import-ia/format.ts` ; la consigne et le schéma en sont dérivés, donc toujours conformes.

**Exercices** : le nom est comparé sans tenir compte des accents ni de la casse, avec quelques alias (pluriels, parenthèses). Un exercice introuvable est **créé** comme exercice personnalisé (muscles fournis par l'IA, sinon déduits du nom, sinon « Autre ») et listé dans l'aperçu. Si son nom est très proche d'un exercice du catalogue (deux fautes de frappe au plus), l'aperçu propose le nom du catalogue, **sans jamais le substituer** : corrigez le fichier si c'est une faute.

**Sans doublon** : l'identifiant d'une séance dérive de son contenu (casse et accents ignorés) et de votre compte. Réimporter le même fichier ne crée rien (« Déjà présente : ignorée »). Une séance de même nom mais de contenu différent est ajoutée avec le suffixe « (2) », « (3)… » (signalé dans l'aperçu). Une séance importée puis supprimée est restaurée par un nouvel import.

**Limites** : fichier de 2 Mo au plus ; 20 séances, 20 blocs par séance, 30 exercices par bloc ; renforcement seulement (pas de course ni de vélo) ; l'application ne vérifie pas la pertinence sportive du programme, relisez l'aperçu ; les durées estimées suivent les hypothèses de l'éditeur.

**Sécurité et données personnelles** : le fichier modèle est produit localement et ne contient que des noms d'exercices (le catalogue de base et vos exercices personnalisés) : aucune donnée de profil, d'historique ni de santé. L'application n'envoie rien à une IA ; c'est vous qui collez la consigne dans l'outil de votre choix. N'ajoutez pas de données personnelles (poids, blessures, identité) à votre demande si vous ne voulez pas que l'IA les reçoive, et vérifiez les conditions d'utilisation de l'outil. Le contenu importé est traité comme des données (jamais exécuté) et validé champ par champ avant toute écriture.

## Séances de cardio dans l'agenda

L'agenda (écran Calendrier) accueille aussi des séances de **course** et de **vélo**. Ce n'est pas un module : pas d'écran d'exécution ni de statistiques, on pose la séance dans l'agenda, on la déplace, on la valide (une séance validée ne se déplace pas : la dévalider d'abord), on la supprime. Une séance peut être marquée « Optionnelle », porter un jalon (course importante, affichée avec un drapeau) et un lien `https://` vers ses statistiques (Strava, Suunto, MyWoosh).

- **Saisie** : bouton « Ajouter une séance de cardio » sur le jour choisi, puis « Modifier » sur la séance.
- **Programme 2027** : Profil → « Importer des données » → onglet **Programme 2027** → « Importer le programme 2027 » (113 séances, du 3 novembre 2026 au 6 juin 2027). Le bouton reste inactif (raison affichée) tant que l'appareil n'a pas fini sa première synchronisation, est hors ligne, synchronise ou a des modifications non envoyées : à lancer une seule fois, sur l'appareil à jour. Rejouable sans doublon ; une séance déplacée, validée ou supprimée n'est jamais modifiée. La source est `support/Programme_endurance_PandaMove_2027_Zwift_KICKR.html`, convertie une fois par `node scripts/extraire-programme-2027.mjs`.
- **Données** : tables `seances_course` et `seances_velo` (migration `0008_seances_cardio.sql`, à appliquer avant les règles PowerSync puis le client). Détail dans `src/features/calendar/README.md`.

## Respiration

Module repris de l'application Android : quatre méthodes intégrées (cohérence cardiaque, 4-7-8, respiration en boîte, Wim Hof), méthodes personnalisées (emoji, durées des quatre phases, cycles par défaut), durée réglée en cycles ou en minutes, décompte de 5 s, cercle qui suit le souffle, tonalités par phase (Web Audio, rien à télécharger), pause et reprise, écran de fin avec le panda, historique des 15 dernières séances.

- **Écran gardé allumé** pendant la séance (API Screen Wake Lock, quand le navigateur l'offre). Il n'y a pas de service d'arrière-plan comme sur Android : si l'onglet passe en arrière-plan, le temps continue de s'écouler mais les sons peuvent s'interrompre selon le navigateur.
- **Données** : tables `methodes_respiration` et `seances_respiration` (migration `0009_respiration.sql`, à appliquer avant les règles PowerSync puis le client). Une séance n'est enregistrée que menée jusqu'au bout. Détail dans `src/features/respiration/README.md`.
- La respiration est dans la sauvegarde JSON (complément `pandamoveWeb`, voir « Sauvegarde »).

## Rappels de séance

Écran Outils → Rappels : rappel la veille et le jour même, heures au choix (synchronisées entre appareils, voir la migration 0012 ; l'interrupteur reste propre à chaque appareil). Deux modes :

- **Notifications locales** (par défaut) : le planificateur de l'application vérifie chaque minute et notifie tant que PandaMove est ouvert ou en arrière-plan ; un rappel dû est envoyé à la prochaine ouverture.
- **Notifications push, application fermée** (option « Aussi quand l'application est fermée ») : le serveur envoie le rappel à l'heure locale de l'appareil, même application fermée. Il faut déployer une fonction Supabase et une tâche planifiée à la main : guide complet dans `supabase/functions/envoyer-rappels/README.md` (migration 0013, clés VAPID, secrets, `supabase functions deploy`, `pg_cron`, variable de build `VITE_VAPID_PUBLIC_KEY`). Sans cette variable, l'option n'est pas proposée. Quand le push est actif sur un appareil (drapeau local `pandamove.push.actif`), le planificateur local s'y met en retrait pour ne pas doubler la notification. Sur iPhone / iPad : iOS 16.4 ou plus, application installée sur l'écran d'accueil.

Les gestionnaires `push` et `notificationclick` sont dans `public/push-sw.js`, chargé par le service worker principal (`workbox.importScripts`). Le message est du JSON produit par notre serveur ; toute autre forme est ignorée.

## Course et vélo (sorties)

Écrans Course (`/running`) et Vélo (`/cycling`) : liste des sorties réellement faites (bilan, mini-carte par sortie), détail (tuiles, courbes, tracé sur fond OpenStreetMap), saisie manuelle et import de fichiers FIT (Suunto, Garmin, MyWoosh ; décodeur chargé à la demande). Une sortie peut être liée à une séance planifiée de l'agenda. Le module Statistiques a une vue Course et une vue Vélo (volumes, records, carte des sorties superposées, lieux de départ fréquents).

- **Données** : table `sorties` (migrations 0010 et 0011). Anti-doublon à l'import par empreinte (sport + début + durée). Les statistiques se calculent sur `sorties`, jamais sur les séances planifiées.

**Forme (charge d'entraînement)** : quatrième vue de Statistiques, calculée sur les sorties de course et de vélo ensemble (`src/features/endurance/calculCharge.ts`, aucun serveur ni table). Chaque sortie vaut des points de charge (100 points = une heure à l'intensité du seuil), avec la meilleure mesure disponible : puissance normalisée (avec la FTP), sinon fréquence cardiaque (TRIMP de Banister ramené à une heure au seuil, avec la FC max), sinon effort ressenti (RPE 7 ≈ seuil), sinon la durée seule. **Forme** = moyenne mobile exponentielle sur 42 jours, **fatigue** sur 7 jours, **fraîcheur** = forme de la veille − fatigue de la veille (repères : sous −30 très fatigué, −30 à −10 charge productive, −10 à 5 équilibre, 5 à 25 frais, au-delà désentraîné). La FC max et la FTP sont estimées depuis les sorties (FC la plus haute vue ; 95 % de la meilleure puissance normalisée sur 20 min ou plus) tant que l'utilisateur ne les règle pas ; les réglages restent sur l'appareil (`localStorage`, clé `pandamove.charge.reglages`). Estimation de tendance, pas une mesure de laboratoire. Le renforcement n'y entre pas.

## Mobilité

Module de séances d'étirement et de mobilité générées sur l'appareil : durée (5, 10, 15, 20 ou 30 min), séance type (course, vélo, renforcement, journée au bureau) qui pré-remplit les zones, zones à travailler et moment (avant le sport, après, libre). Aperçu de la séance (remplacer un exercice, retirer, nouveau tirage), puis exécution guidée : phases préparation / travail / changement de côté, chrono circulaire, consigne, illustration du panda par exercice (`public/mobilite/<id>-male|female.webp`, dans la variante du profil), bips et écran gardé allumé.

- **Données** : catalogue d'exercices dans le code (`src/features/mobilite/donnees.ts`). L'historique des séances terminées est synchronisé (table `seances_mobilite`, migration 0012) ; l'ancien historique du navigateur est repris en base une fois, sans doublon, puis effacé. Le dernier choix (temps, zones, moment) reste propre à l'appareil.
- `illustrations.test.ts` vérifie que chaque exercice a ses deux illustrations.

## Sauvegarde

Les données vivent dans Supabase et dans la base locale du navigateur. Pour ne pas dépendre seulement de ces services, faire régulièrement une sauvegarde locale.

**Exporter** : Profil → Sauvegarde → « Exporter mes données ». Le navigateur télécharge `pandamove-export-AAAA-MM-JJ.json` (rien n'est envoyé ailleurs). Ranger ce fichier sur l'appareil ou un support personnel ; il contient tout l'historique d'entraînement, ne pas le déposer dans un dépôt ni un service partagé.

Contenu : export « PandaMoveExport » v3.2, le format de l'application Android, limité au renforcement (séances, séances jouées avec blocs, exercices et séries, exercices du catalogue, objectifs de progression, « Mon matériel »). Seules les lignes non supprimées sont exportées, sauf ce qui porte l'historique : une séance supprimée avec « Garder l'historique » (exportée archivée, sans blocs ni exercices) et un exercice supprimé encore utilisé par une séance. Les identifiants numériques du format sont dérivés des UUID de la base web (stables d'un export à l'autre). Chaque élément garde aussi son UUID et les champs propres au web (`uuid`, `isArchived`, `deletedAt`, `progressionJson`, `startedAt`, `pausedJson`, `validatedAt`, `updatedAt`, `nombreSeriesCible`, `isFavorite`, `isBodyweight`, et, seulement quand ils existent, `nom` d'une séance jouée renommée et `notes` d'un exercice), et le fichier porte l'identifiant du compte (`webUserId`).

**Complément web (`pandamoveWeb`)** : le fichier porte aussi ce que le format Android ne sait pas décrire : sorties de course et de vélo, séances de cardio planifiées (course et vélo), méthodes et séances de respiration, historique de mobilité et réglages des rappels (heures et choix veille / jour même ; l'interrupteur reste propre à l'appareil). Les lignes vivantes de chaque table y sont recopiées telles que la base les stocke, sans `user_id`. Ce champ est ignoré par l'import Android et par les anciennes versions du web : le fichier reste un export v3.2 valide.

À l'import, dans la même transaction que le renforcement (tout ou rien) : même compte, ids conservés, une ligne supprimée depuis revient, réimporter ne crée aucun doublon ; autre compte, ids dérivés du compte et des ids d'origine (liens sortie → séance planifiée et séance de respiration → méthode recalculés), même absence de doublon. Une ligne invalide (colonne inconnue écartée, date ou valeur mal formée, id absent) est ignorée et comptée dans les remarques. Un fichier d'une version plus ancienne, sans ce champ, s'importe comme avant.

**Réimporter** : Profil → « Importer des données », choisir le fichier, vérifier l'aperçu puis confirmer.

- **Dans le même compte** (y compris sur un appareil effacé) : les UUID du fichier sont repris comme identifiants. Chaque élément du fichier reprend l'état sauvegardé (une séance supprimée par erreur revient), sans doublon. Les éléments créés après la sauvegarde sont gardés ; si le fichier apporte les lignes d'une séance jouée que vous avez rouverte et copiée ensuite, la copie locale du même exercice est remplacée par celle du fichier et ses séries y sont rattachées (valeurs intactes, signalé dans le résultat de l'import). Archivage, horloge de séance et heure de validation des séries sont restaurés ; les décisions de progression aussi, sauf pour une séance jouée qui a déjà des décisions sur l'appareil (celles de l'appareil sont gardées).
- **Dans un autre compte**, ou avec un export Android : les UUID ne sont pas repris, l'import calcule ses propres identifiants à partir des numéros du fichier (règles de l'import Android). Le même fichier réimporté deux fois ne crée pas de doublon.
- Les copies d'une séance supprimée avec historique perdent leur lien vers les lignes du modèle (supprimé), sans effet sur l'affichage ni les stats.
- Horodatages : écrits en UTC sans fuseau ; l'application Android, qui les lit en heure locale, les décale du fuseau horaire. Dans l'autre sens, les horodatages d'un export Android (heure locale sans fuseau) sont lus comme UTC par l'app web.
- Import dans l'application Android : non vérifié. Les champs propres au web y sont ignorés, et une séance supprimée gardée pour son historique y apparaîtrait comme une séance ordinaire.

## Limites connues de la version web

- **Dernier écrit gagne entre appareils** : deux appareils qui modifient la même ligne hors ligne gardent la version envoyée en dernier ; l'autre modification est perdue pour cette ligne. Même règle pour le marqueur de progression d'une instance : deux appareils qui décident des exercices différents hors ligne peuvent perdre une des décisions (les objectifs, eux, sont bien écrits).
- **Même série sur deux appareils** : si deux appareils saisissent la même série (même exercice, même numéro) de la même séance en parallèle, une seule des deux est affichée et comptée ; l'autre reste en base, non supprimée.
- **Import de JSON** : « l'export gagne ». Réimporter un export (Android, ou sauvegarde web du même compte) remplace les lignes de même identifiant, y compris des modifications faites depuis sur le web. Si le fichier apporte les lignes d'une séance jouée déjà ouverte sur le web, seules les copies web du même exercice (même ligne du modèle) passent en suppression logique, avant l'écriture des lignes du fichier ; leurs séries sont rattachées aux lignes du fichier, et les exercices ajoutés sur le web restent. Seul le marqueur de progression local d'une instance est conservé.
- **Données propres à l'appareil** : interrupteur des rappels (l'autorisation de notifier se donne par appareil), dernier choix de mobilité, réglages de circuit, de RPE et de son (`localStorage`, clés `pandamove.*`) ne sont pas synchronisés. Les heures et choix des rappels (veille, jour même) et l'historique de mobilité le sont depuis la migration 0012.
- **Pas de Docker en CI** : la CI lance lint, typecheck, tests Vitest (schéma et RLS vérifiés sous PGlite) et build. Les e2e, le test pgTAP (`supabase/tests/rls.test.sql`) et la vérification RLS sur le vrai Supabase se lancent à la main.
- **Envois rejetés par le serveur** : une modification refusée définitivement par Supabase (contrainte, droit, donnée invalide) est signalée par un message sous la barre du haut (« Une modification n'a pas pu être envoyée au serveur (code …) »), mais elle n'est pas rejouable : elle disparaît de l'appareil au point de synchro suivant. Le détail (table, opération, identifiant) est dans la console du navigateur.
- **Indicateur de synchro** : une coupure Wi-Fi peut mettre quelques secondes à apparaître ; le mode « Offline » des outils de développement ne coupe pas une connexion de synchro déjà ouverte.

## Différences connues avec Android

Le moteur de progression (`src/core/progression/engine.ts`) reproduit volontairement le Kotlin (`ProgressionEngine.kt`), y compris deux particularités qui ressemblent à des défauts côté Android. Elles ne sont pas corrigées dans le web, pour que les deux applications proposent la même chose.

- **Exercice bilatéral** : les côtés sont repérés par la présence de « G » ou « D » dans les notes de série (sans tenir compte de la casse). Le verdict retenu est le pire des deux côtés, mais à sévérité égale c'est le côté G qui l'emporte. Conséquences : si seul le côté D est noté, l'exercice est « non noté » ; si seul le côté G est noté, son verdict s'applique ; à égalité de sévérité, la valeur atteinte par G pilote la hausse de charge même si D a fait moins.
- **Exercice en durée (`DURATION`) hors système `TEMPORELLE`** : en double progression, la valeur atteinte (des secondes) est comparée à `repsMax` (des répétitions) pour décider du passage au palier de charge.

Vérifier la parité après une modification du moteur Kotlin : `./gradlew :core:database:testDebugUnitTest` (tests `ProgressionEngineTest`, `EquipmentInventoryTest`) côté Android, puis `npm test` côté web (fixtures `test-kotlin` de `engine.json`).

- **Correction d'une séance terminée et progression** : à l'ouverture du rapport d'une séance corrigée, la progression est recalculée depuis l'état d'avant l'évaluation d'origine (le marqueur `progression_json` garde, par exercice, la cible évaluée, l'objectif d'avant / écrit et la proposition ; aucune migration). Proposition inchangée : rien n'est réécrit, la décision de l'utilisateur est gardée. Proposition changée : l'objectif revient à son état d'avant, l'ancienne décision est annulée et l'issue est appliquée (échec simple) ou proposée de nouveau au récap. Si une séance plus récente a déjà fait évoluer l'objectif, il n'est pas touché. Les séances évaluées avant ce lot (marqueur sans base) ne sont pas recalculées. Android : la correction ne recalcule rien, un nouveau « Terminer » ré-évalue par-dessus l'objectif déjà modifié.
- **Fin de repos** : bips 5 à 1 puis signal de fin (Android `restFinishedEvent`) ; l'Android ne navigue pas automatiquement après le repos (la navigation est immédiate à la validation de la série, déjà reprise dans `apresSerie`).
